import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export type SandboxInitOptions = {
	baseDir?: string
	prefix?: string
	createDirs?: string[]
	metadata?: Record<string, string>
}

export type SandboxTeardownOptions = {
	preserve?: boolean
}

export type SandboxContext = {
	id: string
	rootPath: string
	workPath: string
	logsPath: string
	createdAt: string
	metadata: Record<string, string>
}

export async function initializeSandbox(options: SandboxInitOptions = {}): Promise<SandboxContext> {
	const parentDir = options.baseDir ?? path.join(os.tmpdir(), 'arrakis-ai-sandboxes')
	const prefix = options.prefix ?? 'sandbox-'
	const createDirs = options.createDirs ?? []

	await mkdir(parentDir, { recursive: true })
	const rootPath = await mkdtemp(path.join(parentDir, prefix))
	const workPath = path.join(rootPath, 'work')
	const logsPath = path.join(rootPath, 'logs')

	await mkdir(workPath, { recursive: true })
	await mkdir(logsPath, { recursive: true })

	for (const dir of createDirs) {
		const cleaned = dir.trim()
		if (cleaned === '') {
			continue
		}
		await mkdir(path.join(rootPath, cleaned), { recursive: true })
	}

	return {
		id: randomUUID(),
		rootPath,
		workPath,
		logsPath,
		createdAt: new Date().toISOString(),
		metadata: options.metadata ?? {}
	}
}

export async function teardownSandbox(
	sandbox: SandboxContext,
	options: SandboxTeardownOptions = {}
): Promise<void> {
	if (options.preserve) {
		return
	}

	await rm(sandbox.rootPath, {
		recursive: true,
		force: true
	})
}
