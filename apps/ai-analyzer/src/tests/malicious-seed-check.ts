import { Pool } from 'pg'
import { queryExistingAIFindings } from '../tools/db-finding-tools'

type SeededRows = {
	userID: number
	repoID: number
	scanRunID: number
	findingID: number
}

function getConnectionString(): string {
	const connectionString =
		(process.env.AI_ANALYZER_DATABASE_URL ?? '').trim() || (process.env.DATABASE_URL ?? '').trim()
	if (connectionString === '') {
		throw new Error('set AI_ANALYZER_DATABASE_URL or DATABASE_URL before running this test')
	}
	return connectionString
}

async function seedMaliciousFixture(pool: Pool): Promise<SeededRows> {
	const suffix = Date.now()
	const client = await pool.connect()

	try {
		const userRes = await client.query<{ id: number }>(
			`INSERT INTO users (github_id, login, name, email, avatar_url)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id`,
			[8000000000 + suffix, `algo-${suffix}`, 'Algo Test', `algo-${suffix}@example.dev`, '']
		)
		const userID = userRes.rows[0].id

		const repoRes = await client.query<{ id: number }>(
			`INSERT INTO repositories (user_id, github_repo_id, name, full_name, private, default_branch, html_url)
			 VALUES ($1, $2, $3, $4, FALSE, 'main', $5)
			 RETURNING id`,
			[userID, 9000000000 + suffix, 'algo', `algo-${suffix}`, `https://example.dev/algo-${suffix}`]
		)
		const repoID = repoRes.rows[0].id

		const runRes = await client.query<{ id: number }>(
			`INSERT INTO repository_scan_runs (repository_id, trigger, status)
			 VALUES ($1, 'manual', 'success')
			 RETURNING id`,
			[repoID]
		)
		const scanRunID = runRes.rows[0].id

		const findingRes = await client.query<{ id: number }>(
			`INSERT INTO repository_scan_findings (
				scan_run_id,
				repository_id,
				package_name,
				manager,
				registry,
				version_spec,
				resolved_version,
				advisory_id,
				title,
				summary,
				severity,
				reference_url,
				status
			) VALUES (
				$1, $2, 'event-stream', 'npm', 'npm', '^3.3.4', '3.3.6',
				'AI-SUPPLY-EVENT-STREAM-001',
				'Known malicious campaign package detected: event-stream',
				'Fixture finding for malicious supply-chain validation.',
				'critical',
				'https://example.dev/advisories/AI-SUPPLY-EVENT-STREAM-001',
				'open'
			)
			ON CONFLICT (manager, registry, package_name, resolved_version, advisory_id)
			DO UPDATE SET
				title = EXCLUDED.title,
				summary = EXCLUDED.summary,
				severity = EXCLUDED.severity,
				reference_url = EXCLUDED.reference_url,
				updated_at = NOW()
			RETURNING id`,
			[scanRunID, repoID]
		)
		const findingID = findingRes.rows[0].id

		await client.query(
			`INSERT INTO repository_finding_occurrences (repository_id, finding_id, status)
			 VALUES ($1, $2, 'open')
			 ON CONFLICT (repository_id, finding_id)
			 DO UPDATE SET
				status = 'open',
				last_seen_at = NOW(),
				updated_at = NOW()`,
			[repoID, findingID]
		)

		return { userID, repoID, scanRunID, findingID }
	} finally {
		client.release()
	}
}

async function cleanupFixture(pool: Pool, rows: SeededRows) {
	const client = await pool.connect()
	try {
		await client.query('DELETE FROM repository_finding_occurrences WHERE finding_id = $1', [rows.findingID])
		await client.query('DELETE FROM repository_scan_findings WHERE id = $1', [rows.findingID])
		await client.query('DELETE FROM repository_scan_runs WHERE id = $1', [rows.scanRunID])
		await client.query('DELETE FROM repositories WHERE id = $1', [rows.repoID])
		await client.query('DELETE FROM users WHERE id = $1', [rows.userID])
	} finally {
		client.release()
	}
}

async function main() {
	const pool = new Pool({ connectionString: getConnectionString() })
	let seeded: SeededRows | null = null

	try {
		seeded = await seedMaliciousFixture(pool)
		const result = await queryExistingAIFindings({
			repositoryId: seeded.repoID,
			name: 'event-stream',
			manager: 'npm',
			registry: 'npm',
			resolvedVersion: '3.3.6',
			limit: 10
		})

		if (!result.hasExistingAIFindings || result.total === 0) {
			throw new Error('expected existing AI finding for event-stream but got none')
		}

		console.log('malicious seed check passed')
		console.log(JSON.stringify(result, null, 2))
	} finally {
		if (seeded) {
			await cleanupFixture(pool, seeded)
		}
		await pool.end()
	}
}

main().catch((err) => {
	console.error(`malicious seed check failed: ${err instanceof Error ? err.message : String(err)}`)
	process.exit(1)
})
