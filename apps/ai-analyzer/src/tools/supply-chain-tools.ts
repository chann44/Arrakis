import { tool } from 'ai'
import { z } from 'zod'
import { runLoggedTool } from './logging'

const SUSPICIOUS_SCRIPT_TOKENS = [
	'curl ',
	'wget ',
	'nc ',
	'netcat ',
	'powershell',
	'bash -c',
	'sh -c',
	'eval(',
	'new function(',
	'child_process',
	'process.env',
	'fs.readfile',
	'~/.ssh',
	'/etc/passwd'
]

const COMMON_PACKAGES = [
	'react',
	'lodash',
	'express',
	'axios',
	'typescript',
	'webpack',
	'vite',
	'next',
	'vue',
	'svelte',
	'rxjs',
	'moment',
	'debug',
	'commander',
	'chalk'
]

type NpmVersionPayload = {
	name?: string
	version?: string
	main?: string
	bin?: string | Record<string, string>
	scripts?: Record<string, string>
	dependencies?: Record<string, string>
	dist?: {
		tarball?: string
	}
}

type NpmRegistryPayload = {
	name?: string
	versions?: Record<string, NpmVersionPayload>
	'dist-tags'?: {
		latest?: string
	}
}

function clamp(min: number, max: number, value: number): number {
	if (value < min) return min
	if (value > max) return max
	return value
}

function levenshtein(a: string, b: string): number {
	const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
	for (let i = 0; i <= a.length; i++) dp[i][0] = i
	for (let j = 0; j <= b.length; j++) dp[0][j] = j

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
		}
	}

	return dp[a.length][b.length]
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

function severityRank(severity: 'low' | 'medium' | 'high' | 'critical'): number {
	switch (severity) {
		case 'critical':
			return 4
		case 'high':
			return 3
		case 'medium':
			return 2
		default:
			return 1
	}
}

function detectTyposquatRisk(name: string): { package: string; distance: number } | null {
	const lower = name.toLowerCase()
	for (const candidate of COMMON_PACKAGES) {
		const distance = levenshtein(lower, candidate)
		if (distance > 0 && distance <= 2) {
			return { package: candidate, distance }
		}
	}
	return null
}

function assessVersionSignals(name: string, version: NpmVersionPayload) {
	const scripts = version.scripts ?? {}
	const dependencies = version.dependencies ?? {}

	const signals: Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; code: string; reason: string }> = []

	for (const [scriptNameRaw, scriptRaw] of Object.entries(scripts)) {
		const scriptName = scriptNameRaw.toLowerCase().trim()
		if (!['preinstall', 'install', 'postinstall', 'prepare'].includes(scriptName)) {
			continue
		}

		const script = scriptRaw.toLowerCase()
		for (const token of SUSPICIOUS_SCRIPT_TOKENS) {
			if (!script.includes(token)) {
				continue
			}

			const severe =
				token.includes('curl') ||
				token.includes('wget') ||
				token.includes('child_process') ||
				token.includes('powershell')

			signals.push({
				severity: severe ? 'high' : 'medium',
				code: 'suspicious-install-script',
				reason: `${scriptNameRaw} script contains token '${token}'`
			})
			break
		}
	}

	if (Object.keys(dependencies).length === 0) {
		signals.push({
			severity: 'low',
			code: 'no-dependencies',
			reason: 'Package has no direct dependencies; this is informational only.'
		})
	}

	const typosquat = detectTyposquatRisk(name)
	if (typosquat) {
		signals.push({
			severity: 'high',
			code: 'typosquat-risk',
			reason: `Package name is similar to '${typosquat.package}' (distance ${typosquat.distance}).`
		})
	}

	return { signals, scripts, dependencies }
}

function summarizeRiskLevel(signals: Array<{ severity: 'low' | 'medium' | 'high' | 'critical' }>) {
	if (signals.length === 0) return 'clean'
	const topRank = signals.reduce((max, signal) => Math.max(max, severityRank(signal.severity)), 1)
	if (topRank >= 4) return 'critical'
	if (topRank === 3) return 'high'
	if (topRank === 2) return 'medium'
	return 'low'
}

export function createSupplyChainTools() {
	return {
		analyze_npm_package: tool({
			description:
				'Fetch npm metadata for one package/version and return scripts, dependencies, and risk signals.',
			parameters: z.object({
				name: z.string().min(1),
				version: z.string(),
				registryURL: z.string().min(1)
			}),
			execute: async ({ name, version, registryURL }) =>
				runLoggedTool('analyze_npm_package', { name, version, registryURL }, async () => {
					const payload = await fetchRegistryDoc(name, coerceRegistryURL(registryURL))
					const resolvedVersion = resolveVersion(payload, version)
					if (resolvedVersion === '') {
						throw new Error(`unable to resolve version for package '${name}'`)
					}

					const targetVersion = payload.versions?.[resolvedVersion]
					if (!targetVersion) {
						throw new Error(`version '${resolvedVersion}' not found for package '${name}'`)
					}

					const analysis = assessVersionSignals(name, targetVersion)

					return {
						package: name,
						version: resolvedVersion,
						riskLevel: summarizeRiskLevel(analysis.signals),
						scripts: analysis.scripts,
						dependencies: analysis.dependencies,
						signals: analysis.signals,
						tarballURL: targetVersion.dist?.tarball ?? ''
					}
				}),
		}),

		check_dependency_chain: tool({
			description:
				'Recursively inspect direct and transitive dependencies and return risky nodes with short reasons.',
			parameters: z.object({
				name: z.string().min(1),
				version: z.string(),
				registryURL: z.string().min(1),
				maxDepth: z.number().int().min(1).max(5),
				maxNodes: z.number().int().min(1).max(1000)
			}),
			execute: async ({ name, version, registryURL, maxDepth, maxNodes }) =>
				runLoggedTool('check_dependency_chain', { name, version, registryURL, maxDepth, maxNodes }, async () => {
				type QueueItem = { depName: string; depVersion: string; depth: number }
				const queue: QueueItem[] = [{ depName: name, depVersion: version, depth: 0 }]
				const visited = new Set<string>()
				const flagged: Array<{ name: string; version: string; depth: number; riskLevel: string; reason: string }> = []

				let scanned = 0
				while (queue.length > 0 && scanned < maxNodes) {
					const current = queue.shift()
					if (!current) break

					const id = `${current.depName}@${current.depVersion || 'latest'}`
					if (visited.has(id)) {
						continue
					}
					visited.add(id)

					const payload = await fetchRegistryDoc(current.depName, coerceRegistryURL(registryURL))
					const resolvedVersion = resolveVersion(payload, current.depVersion)
					const item = payload.versions?.[resolvedVersion]
					if (!item) {
						continue
					}

					scanned += 1
					const { signals, dependencies } = assessVersionSignals(current.depName, item)
					const riskLevel = summarizeRiskLevel(signals)

					if (riskLevel === 'critical' || riskLevel === 'high') {
						flagged.push({
							name: current.depName,
							version: resolvedVersion,
							depth: current.depth,
							riskLevel,
							reason: signals[0]?.reason ?? 'High-risk heuristic triggered.'
						})
					}

					if (current.depth >= maxDepth) {
						continue
					}

					for (const [depName, depVersion] of Object.entries(dependencies)) {
						if (queue.length + visited.size >= maxNodes) {
							break
						}
						queue.push({ depName, depVersion, depth: current.depth + 1 })
					}
				}

				return {
					root: `${name}@${version || 'latest'}`,
					nodesScanned: scanned,
					maxDepthReached: Math.max(0, ...flagged.map((item) => item.depth)),
					flagged
				}
			})
		}),

		compare_versions: tool({
			description:
				'Compare two npm versions and return script, dependency, and entry-point differences.',
			parameters: z.object({
				name: z.string().min(1),
				fromVersion: z.string().min(1),
				toVersion: z.string().min(1),
				registryURL: z.string().min(1)
			}),
			execute: async ({ name, fromVersion, toVersion, registryURL }) =>
				runLoggedTool('compare_versions', { name, fromVersion, toVersion, registryURL }, async () => {
				const payload = await fetchRegistryDoc(name, coerceRegistryURL(registryURL))
				const from = payload.versions?.[fromVersion]
				const to = payload.versions?.[toVersion]

				if (!from) {
					throw new Error(`fromVersion '${fromVersion}' not found for '${name}'`)
				}
				if (!to) {
					throw new Error(`toVersion '${toVersion}' not found for '${name}'`)
				}

				const fromScripts = from.scripts ?? {}
				const toScripts = to.scripts ?? {}
				const fromDeps = from.dependencies ?? {}
				const toDeps = to.dependencies ?? {}

				const addedDependencies = Object.keys(toDeps).filter((dep) => !(dep in fromDeps))
				const removedDependencies = Object.keys(fromDeps).filter((dep) => !(dep in toDeps))
				const changedDependencies = Object.keys(toDeps)
					.filter((dep) => dep in fromDeps && fromDeps[dep] !== toDeps[dep])
					.map((dep) => ({
						name: dep,
						from: fromDeps[dep],
						to: toDeps[dep]
					}))

				const addedScripts = Object.keys(toScripts).filter((script) => !(script in fromScripts))
				const removedScripts = Object.keys(fromScripts).filter((script) => !(script in toScripts))
				const changedScripts = Object.keys(toScripts)
					.filter((script) => script in fromScripts && fromScripts[script] !== toScripts[script])
					.map((script) => ({
						name: script,
						from: fromScripts[script],
						to: toScripts[script]
					}))

				const entryPointsChanged = {
					main: {
						from: from.main ?? '',
						to: to.main ?? '',
						changed: (from.main ?? '') !== (to.main ?? '')
					},
					binChanged: JSON.stringify(from.bin ?? {}) !== JSON.stringify(to.bin ?? {})
				}

				const riskDelta = clamp(0, 100, addedScripts.length * 20 + addedDependencies.length * 8)

				return {
					package: name,
					fromVersion,
					toVersion,
					addedDependencies,
					removedDependencies,
					changedDependencies,
					addedScripts,
					removedScripts,
					changedScripts,
					entryPointsChanged,
					riskDelta
				}
			})
		})
	}
}
