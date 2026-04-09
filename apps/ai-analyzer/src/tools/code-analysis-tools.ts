import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { tool } from 'ai'
import { z } from 'zod'
import { runLoggedTool } from './logging'

const MAX_FILE_BYTES = 1024 * 1024
let latestSourceRoot = ''

type NpmVersionPayload = {
	name?: string
	version?: string
	main?: string
	exports?: unknown
	bin?: string | Record<string, string>
	scripts?: Record<string, string>
	dependencies?: Record<string, string>
	dist?: {
		tarball?: string
	}
}

type NpmRegistryPayload = {
	versions?: Record<string, NpmVersionPayload>
	'dist-tags'?: {
		latest?: string
	}
}

const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org'

type ListedFile = {
	path: string
	size: number
	extension: string
	isDirectory: boolean
}

function normalizeRegistryURL(url: string): string {
	return url.replace(/\/+$/, '')
}

function coerceRegistryURL(input: string): string {
	const trimmed = input.trim()
	if (trimmed === '' || trimmed.toLowerCase() === 'npm') {
		return 'https://registry.npmjs.org'
	}
	if (!/^https?:\/\//i.test(trimmed)) {
		return `https://${trimmed}`
	}
	return trimmed
}

async function fetchRegistryDoc(name: string, registryURL: string): Promise<NpmRegistryPayload> {
	const endpoint = `${normalizeRegistryURL(registryURL)}/${encodeURIComponent(name)}`
	const response = await fetch(endpoint, {
		method: 'GET',
		headers: { accept: 'application/json' }
	})

	if (!response.ok) {
		throw new Error(`npm registry returned status ${response.status}`)
	}

	return (await response.json()) as NpmRegistryPayload
}

function resolveVersion(payload: NpmRegistryPayload, requestedVersion: string): string {
	if (requestedVersion.trim() !== '') {
		return requestedVersion.trim().replace(/^v/, '')
	}
	return payload['dist-tags']?.latest?.trim() ?? ''
}

async function collectFiles(rootPath: string, limit: number): Promise<ListedFile[]> {
	const files: ListedFile[] = []

	async function walk(currentPath: string) {
		if (files.length >= limit) {
			return
		}

		const entries = await readdir(currentPath, { withFileTypes: true })
		for (const entry of entries) {
			if (files.length >= limit) {
				return
			}

			const absolutePath = path.join(currentPath, entry.name)
			const info = await stat(absolutePath)
			const relativePath = path.relative(rootPath, absolutePath) || '.'

			files.push({
				path: relativePath,
				size: info.size,
				extension: path.extname(entry.name),
				isDirectory: entry.isDirectory()
			})

			if (entry.isDirectory()) {
				await walk(absolutePath)
			}
		}
	}

	await walk(rootPath)
	return files
}

async function pathExists(targetPath: string): Promise<boolean> {
	try {
		await access(targetPath)
		return true
	} catch {
		return false
	}
}

async function resolveSourceRoot(candidate: string): Promise<string> {
	if (await pathExists(candidate)) {
		return candidate
	}

	if (latestSourceRoot !== '' && (await pathExists(latestSourceRoot))) {
		console.warn(
			`[ai-tool] rootPath '${candidate}' not found, using latestSourceRoot '${latestSourceRoot}'`
		)
		return latestSourceRoot
	}

	throw new Error(`source root does not exist: ${candidate}`)
}

function isPathInsideRoot(rootPath: string, targetPath: string): boolean {
	const relative = path.relative(rootPath, targetPath)
	if (relative === '') return true
	return !relative.startsWith('..') && !path.isAbsolute(relative)
}

function calculateEntropy(value: string): number {
	if (value.length === 0) return 0

	const counts = new Map<string, number>()
	for (const char of value) {
		counts.set(char, (counts.get(char) ?? 0) + 1)
	}

	let entropy = 0
	for (const count of counts.values()) {
		const p = count / value.length
		entropy -= p * Math.log2(p)
	}

	return Number(entropy.toFixed(2))
}

function decodeMaybeEncoded(value: string): string {
	const normalized = value.trim()
	if (normalized === '') return ''

	try {
		if (/^[A-Za-z0-9+/=]+$/.test(normalized) && normalized.length % 4 === 0) {
			return Buffer.from(normalized, 'base64').toString('utf8')
		}
	} catch {
		// no-op
	}

	try {
		if (/^(?:[0-9a-fA-F]{2})+$/.test(normalized)) {
			return Buffer.from(normalized, 'hex').toString('utf8')
		}
	} catch {
		// no-op
	}

	return normalized
}

export function createCodeAnalysisTools() {
	return {
		fetch_package_manifest: tool({
			description: 'Fetch package manifest metadata without downloading full source.',
			parameters: z.object({
				name: z.string().min(1),
				version: z.string(),
				registryURL: z.string().min(1)
			}),
			execute: async ({ name, version, registryURL }) =>
				runLoggedTool('fetch_package_manifest', { name, version, registryURL }, async () => {
				const payload = await fetchRegistryDoc(name, coerceRegistryURL(registryURL))
				const resolvedVersion = resolveVersion(payload, version)
				if (!resolvedVersion) {
					throw new Error(`unable to resolve version for '${name}'`)
				}

				const manifest = payload.versions?.[resolvedVersion]
				if (!manifest) {
					throw new Error(`version '${resolvedVersion}' not found for '${name}'`)
				}

				return {
					name: manifest.name ?? name,
					version: manifest.version ?? resolvedVersion,
					scripts: manifest.scripts ?? {},
					dependencies: manifest.dependencies ?? {},
					entryPoints: {
						main: manifest.main ?? '',
						exports: manifest.exports ?? null,
						bin: manifest.bin ?? null
					},
					tarballURL: manifest.dist?.tarball ?? ''
				}
			})
		}),

		fetch_package_source: tool({
			description: 'Download and extract npm package source into a temp workspace.',
			parameters: z.object({
				name: z.string().min(1),
				version: z.string()
			}),
			execute: async ({ name, version }) => runLoggedTool('fetch_package_source', { name, version }, async () => {
				const workspace = path.join(os.tmpdir(), 'arrakis-ai-analyzer', `${Date.now()}`)
				await mkdir(workspace, { recursive: true })
				const payload = await fetchRegistryDoc(name, DEFAULT_NPM_REGISTRY)
				const resolvedVersion = resolveVersion(payload, version)
				if (!resolvedVersion) {
					throw new Error(`unable to resolve version for '${name}'`)
				}

				const manifest = payload.versions?.[resolvedVersion]
				const tarballURL = manifest?.dist?.tarball?.trim() ?? ''
				if (!manifest || tarballURL === '') {
					throw new Error(`tarball not found for '${name}@${resolvedVersion}'`)
				}

				const tarballResponse = await fetch(tarballURL, {
					method: 'GET'
				})
				if (!tarballResponse.ok) {
					throw new Error(`tarball download failed with status ${tarballResponse.status}`)
				}

				const tarballBuffer = Buffer.from(await tarballResponse.arrayBuffer())
				const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '-')
				const tarballName = `${safeName}-${resolvedVersion}.tgz`
				await writeFile(path.join(workspace, tarballName), tarballBuffer)

				const extractPath = path.join(workspace, 'source')
				await mkdir(extractPath, { recursive: true })

				const extract = Bun.spawn(['tar', '-xzf', tarballName, '-C', extractPath], {
					cwd: workspace,
					stdout: 'pipe',
					stderr: 'pipe'
				})

				const [extractExitCode, extractStderr] = await Promise.all([
					extract.exited,
					new Response(extract.stderr).text()
				])

				if (extractExitCode !== 0) {
					throw new Error(`tar extraction failed: ${extractStderr.trim() || 'unknown error'}`)
				}

				const sourceRoot = path.join(extractPath, 'package')
				latestSourceRoot = sourceRoot
				const files = await collectFiles(sourceRoot, 5000)

				return {
					workspace,
					sourceRoot,
					fileCount: files.length,
					files
				}
			})
		}),

		list_files: tool({
			description: 'List files recursively under a source root.',
			parameters: z.object({
				rootPath: z.string().min(1),
				limit: z.number().int().min(1).max(10000)
			}),
			execute: async ({ rootPath, limit }) => runLoggedTool('list_files', { rootPath, limit }, async () => {
				const resolvedRoot = await resolveSourceRoot(rootPath)
				const files = await collectFiles(resolvedRoot, limit)
				return {
					rootPath: resolvedRoot,
					count: files.length,
					files
				}
			})
		}),

		read_file: tool({
			description: 'Read a file from the extracted workspace safely.',
			parameters: z.object({
				rootPath: z.string().min(1),
				filePath: z.string().min(1),
				maxBytes: z.number().int().min(1).max(5 * 1024 * 1024)
			}),
			execute: async ({ rootPath, filePath, maxBytes }) =>
				runLoggedTool('read_file', { rootPath, filePath, maxBytes }, async () => {
				const resolvedRoot = await resolveSourceRoot(rootPath)
				const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(resolvedRoot, filePath)
				if (!isPathInsideRoot(resolvedRoot, absolutePath)) {
					throw new Error('file path is outside of rootPath')
				}

				const content = await readFile(absolutePath, 'utf8')
				const truncated = content.length > maxBytes
				return {
					filePath: path.relative(resolvedRoot, absolutePath),
					truncated,
					content: truncated ? content.slice(0, maxBytes) : content
				}
			})
		}),

		search_source: tool({
			description: 'Search source files with a regex or literal pattern.',
			parameters: z.object({
				rootPath: z.string().min(1),
				pattern: z.string().min(1),
				isRegex: z.boolean(),
				maxMatches: z.number().int().min(1).max(5000)
			}),
			execute: async ({ rootPath, pattern, isRegex, maxMatches }) =>
				runLoggedTool('search_source', { rootPath, pattern, isRegex, maxMatches }, async () => {
				const resolvedRoot = await resolveSourceRoot(rootPath)
				const files = await collectFiles(resolvedRoot, 4000)
				const matcher = isRegex ? new RegExp(pattern, 'g') : null
				const matches: Array<{ file: string; line: number; text: string }> = []

				for (const file of files) {
					if (file.isDirectory) continue
					if (file.size > MAX_FILE_BYTES) continue

					const absolutePath = path.join(resolvedRoot, file.path)
					const content = await readFile(absolutePath, 'utf8')
					const lines = content.split('\n')

					for (let index = 0; index < lines.length; index++) {
						const lineText = lines[index]
						const hit = matcher ? matcher.test(lineText) : lineText.includes(pattern)
						if (!hit) continue

						matches.push({ file: file.path, line: index + 1, text: lineText.trim().slice(0, 250) })
						if (matches.length >= maxMatches) {
							return { rootPath: resolvedRoot, pattern, totalMatches: matches.length, matches }
						}
					}
				}

				return { rootPath: resolvedRoot, pattern, totalMatches: matches.length, matches }
			})
		}),

		scan_binary_content: tool({
			description: 'Detect potentially encoded or high-entropy blobs in files.',
			parameters: z.object({
				rootPath: z.string().min(1),
				maxFiles: z.number().int().min(1).max(10000)
			}),
			execute: async ({ rootPath, maxFiles }) =>
				runLoggedTool('scan_binary_content', { rootPath, maxFiles }, async () => {
				const resolvedRoot = await resolveSourceRoot(rootPath)
				const files = await collectFiles(resolvedRoot, maxFiles)
				const suspicious: Array<{
					file: string
					entropy: number
					reason: string
				}> = []

				for (const file of files) {
					if (file.isDirectory || file.size > MAX_FILE_BYTES) continue

					const absolutePath = path.join(resolvedRoot, file.path)
					const text = await readFile(absolutePath, 'utf8').catch(() => '')
					if (text === '') continue

					const entropy = calculateEntropy(text.slice(0, 8000))
					if (entropy > 5.2) {
						suspicious.push({
							file: file.path,
							entropy,
							reason: 'High text entropy may indicate obfuscation or encoded payloads.'
						})
					}
				}

				return {
					rootPath: resolvedRoot,
					suspicious,
					scannedFiles: files.length
				}
			})
		}),

		decode_and_analyze: tool({
			description: 'Decode base64 or hex strings and provide lightweight analysis metadata.',
			parameters: z.object({
				value: z.string().min(1)
			}),
			execute: async ({ value }) => runLoggedTool('decode_and_analyze', { value }, async () => {
				const decoded = decodeMaybeEncoded(value)
				return {
					decoded,
					length: decoded.length,
					entropy: calculateEntropy(decoded.slice(0, 12000)),
					containsURL: /https?:\/\//i.test(decoded),
					containsShellLikeTokens: /(curl|wget|bash|powershell|nc\s)/i.test(decoded)
				}
			})
		})
	}
}
