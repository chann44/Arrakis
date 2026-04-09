import { tool } from 'ai'
import { Pool } from 'pg'
import { z } from 'zod'
import { runLoggedTool } from './logging'

type ExistingFindingRow = {
	id: number
	repository_id: number
	package_name: string
	manager: string
	registry: string
	resolved_version: string
	advisory_id: string
	severity: string
	title: string
	summary: string
	reference_url: string
	status: string
	updated_at: string
	seen_in_repository: boolean
	repository_count: string
}

export type ExistingAIFinding = {
	id: number
	repositoryId: number
	packageName: string
	manager: string
	registry: string
	resolvedVersion: string
	advisoryId: string
	agent: 'supply_chain' | 'code_vuln' | 'unknown'
	severity: string
	title: string
	summary: string
	referenceURL: string
	status: string
	updatedAt: string
	seenInRepository: boolean
	repositoryCount: number
}

export type ExistingAIFindingResult = {
	available: boolean
	error?: string
	hasExistingAIFindings: boolean
	total: number
	repositoryId: number | null
	findings: ExistingAIFinding[]
}

let pool: Pool | null = null

function getPool(): Pool {
	if (pool) {
		return pool
	}

	const connectionString =
		(process.env.AI_ANALYZER_DATABASE_URL ?? '').trim() || (process.env.DATABASE_URL ?? '').trim()
	if (connectionString === '') {
		throw new Error('database connection is not configured (set AI_ANALYZER_DATABASE_URL or DATABASE_URL)')
	}

	pool = new Pool({ connectionString })
	return pool
}

export function createDBFindingTools(defaults?: { repositoryId?: number }) {
	return {
		check_existing_ai_findings: tool({
			description:
				'Check Postgres for existing AI findings for a dependency from the dependency graph.',
			parameters: z.object({
				repositoryId: z.number().int().nonnegative(),
				name: z.string().min(1),
				manager: z.string().min(1),
				registry: z.string().min(1),
				resolvedVersion: z.string(),
				limit: z.number().int().min(1).max(200)
			}),
			execute: async ({ repositoryId, name, manager, registry, resolvedVersion, limit }) => {
				try {
					return await runLoggedTool(
						'check_existing_ai_findings',
						{ repositoryId, name, manager, registry, resolvedVersion, limit },
						async () =>
							queryExistingAIFindings({
								repositoryId: repositoryId ?? defaults?.repositoryId,
								name,
								manager,
								registry,
								resolvedVersion,
								limit
							})
					)
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err)
					console.error(`[ai-tool] fallback check_existing_ai_findings unavailable error=${message}`)
					return {
						available: false,
						error: message,
						hasExistingAIFindings: false,
						total: 0,
						repositoryId: repositoryId ?? defaults?.repositoryId ?? null,
						findings: []
					} satisfies ExistingAIFindingResult
				}
			}
		})
	}
}

export async function queryExistingAIFindings(input: {
	repositoryId?: number
	name: string
	manager: string
	registry: string
	resolvedVersion?: string
	limit?: number
}): Promise<ExistingAIFindingResult> {
	const effectiveRepositoryID = input.repositoryId ?? 0
	const db = getPool()
	const limit = input.limit ?? 25

	const query = `
		SELECT
			f.id,
			f.repository_id,
			f.package_name,
			f.manager,
			f.registry,
			f.resolved_version,
			f.advisory_id,
			f.severity::text AS severity,
			f.title,
			f.summary,
			f.reference_url,
			f.status,
			f.updated_at::text AS updated_at,
			CASE
				WHEN $5::bigint > 0 THEN EXISTS (
					SELECT 1
					FROM repository_finding_occurrences rfo
					WHERE rfo.repository_id = $5
					  AND rfo.finding_id = f.id
				)
				ELSE false
			END AS seen_in_repository,
			(
				SELECT COUNT(*)
				FROM repository_finding_occurrences rfo2
				WHERE rfo2.finding_id = f.id
			)::text AS repository_count
		FROM repository_scan_findings f
		WHERE f.manager = $1
		  AND f.registry = $2
		  AND f.package_name = $3
		  AND (
			f.resolved_version = $4
			OR ($4 = '' AND f.resolved_version = '')
		  )
		  AND f.advisory_id LIKE 'AI-%'
		ORDER BY f.updated_at DESC
		LIMIT $6
	`

	const result = await db.query<ExistingFindingRow>(query, [
		input.manager.trim(),
		input.registry.trim(),
		input.name.trim(),
		(input.resolvedVersion ?? '').trim(),
		effectiveRepositoryID,
		limit
	])

	const total = result.rowCount ?? 0

	return {
		available: true,
		hasExistingAIFindings: total > 0,
		total,
		repositoryId: effectiveRepositoryID > 0 ? effectiveRepositoryID : null,
		findings: result.rows.map((row) => ({
			id: row.id,
			repositoryId: row.repository_id,
			packageName: row.package_name,
			manager: row.manager,
			registry: row.registry,
			resolvedVersion: row.resolved_version,
			advisoryId: row.advisory_id,
			agent:
				row.advisory_id.startsWith('AI-SUPPLY-')
					? 'supply_chain'
					: row.advisory_id.startsWith('AI-CODE-')
						? 'code_vuln'
						: 'unknown',
			severity: row.severity,
			title: row.title,
			summary: row.summary,
			referenceURL: row.reference_url,
			status: row.status,
			updatedAt: row.updated_at,
			seenInRepository: row.seen_in_repository,
			repositoryCount: Number(row.repository_count)
		}))
	}
}
