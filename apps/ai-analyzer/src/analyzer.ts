import { runCodeAnalysisAgent } from './agents/code-analysis-agent'
import { getModelDebugInfo, hasAIModelConfig } from './agents/model'
import { runSupplyChainAgent } from './agents/supply-chain-agent'
import { initializeSandbox, teardownSandbox } from './snadbox'
import type { ToolTraceEvent } from './tools/logging'
import { withToolTrace } from './tools/logging'
import type {
	AILogStep,
	AnalyzeRepositoryRequest,
	AnalyzeRepositoryResponse
} from './types'

function nowISO() {
	return new Date().toISOString()
}

function addStep(
	steps: AILogStep[],
	step: Omit<AILogStep, 'createdAt'> & { createdAt?: string }
) {
	steps.push({
		...step,
		createdAt: step.createdAt ?? nowISO()
	})
}

function addToolTraceSteps(
	steps: AILogStep[],
	stage: 'supply_chain' | 'code_analysis',
	packageName: string,
	events: ToolTraceEvent[]
) {
	for (const event of events) {
		const status = event.phase === 'error' ? 'error' : 'progress'
		const detail =
			event.phase === 'start'
				? `tool ${event.name} started`
				: event.phase === 'success'
					? `tool ${event.name} succeeded in ${event.durationMs ?? 0}ms`
					: `tool ${event.name} failed: ${event.error ?? 'unknown error'}`

		addStep(steps, {
			stage,
			status,
			packageName,
			message: detail,
			metadata: {
				tool: event.name,
				phase: event.phase,
				durationMs: event.durationMs ?? 0,
				args: event.args ? JSON.stringify(event.args).slice(0, 300) : '',
				result: event.result ? JSON.stringify(event.result).slice(0, 300) : '',
				error: event.error ?? ''
			}
		})
	}
}

export async function analyzeRepository(
	request: AnalyzeRepositoryRequest
): Promise<AnalyzeRepositoryResponse> {
	const deps = [...request.dependencies]
	const maxDependencies = request.maxDependencies && request.maxDependencies > 0 ? request.maxDependencies : 100
	const selected = deps.slice(0, maxDependencies)

	const steps: AILogStep[] = []
	const findings = [] as AnalyzeRepositoryResponse['findings']

	addStep(steps, {
		stage: 'queued',
		status: 'start',
		message: `analysis queued for repo ${request.repoId}`,
		metadata: {
			scanRunId: request.scanRunId,
			repoId: request.repoId,
			dependencyCount: selected.length
		}
	})

	const modelDebug = getModelDebugInfo()
	addStep(steps, {
		stage: 'queued',
		status: 'progress',
		message: `ai provider config provider=${modelDebug.provider} model=${modelDebug.model} hasModelKey=${hasAIModelConfig()}`,
		metadata: {
			hasOpenAIKey: modelDebug.hasOpenAIKey,
			hasOpenRouterKey: modelDebug.hasOpenRouterKey
		}
	})

	addStep(steps, {
		stage: 'sandbox',
		status: 'start',
		message: 'initializing analysis sandbox'
	})

	const sandbox = await initializeSandbox({
		prefix: `scan-${request.scanRunId}-`,
		createDirs: ['input', 'output'],
		metadata: {
			scanRunId: String(request.scanRunId),
			repoId: String(request.repoId)
		}
	})

	addStep(steps, {
		stage: 'sandbox',
		status: 'success',
		message: `sandbox ready (${sandbox.id})`
	})
	try {
		addStep(steps, {
			stage: 'supply_chain',
			status: 'start',
			message: `running supply-chain agent for ${selected.length} dependencies`
		})

		for (const dep of selected) {
			addStep(steps, {
				stage: 'supply_chain',
				status: 'progress',
				packageName: dep.name,
				message: `supply-chain analysis started for ${dep.name}`
			})

			try {
				const traced = await withToolTrace(() => runSupplyChainAgent(dep, request.repoId))
				addToolTraceSteps(steps, 'supply_chain', dep.name, traced.events)
				const supplyFindings = traced.result
				findings.push(...supplyFindings)
				addStep(steps, {
					stage: 'supply_chain',
					status: 'progress',
					packageName: dep.name,
					message: `supply-chain analysis completed for ${dep.name} with ${supplyFindings.length} findings`
				})
			} catch (err) {
				addStep(steps, {
					stage: 'supply_chain',
					status: 'error',
					packageName: dep.name,
					message: `supply-chain agent failed for ${dep.name}: ${err instanceof Error ? err.message : 'unknown error'}`
				})
			}
		}

		addStep(steps, {
			stage: 'supply_chain',
			status: 'success',
			message: 'supply-chain agent completed'
		})

		addStep(steps, {
			stage: 'code_analysis',
			status: 'start',
			message: 'running code-vulnerability reasoning pass'
		})

		for (const dep of selected) {
			addStep(steps, {
				stage: 'code_analysis',
				status: 'progress',
				packageName: dep.name,
				message: `code analysis started for ${dep.name}`
			})

			try {
				const traced = await withToolTrace(() => runCodeAnalysisAgent(dep, request.repoId))
				addToolTraceSteps(steps, 'code_analysis', dep.name, traced.events)
				const codeFindings = traced.result
				findings.push(...codeFindings)
				addStep(steps, {
					stage: 'code_analysis',
					status: 'progress',
					packageName: dep.name,
					message: `code analysis completed for ${dep.name} with ${codeFindings.length} findings`
				})
			} catch (err) {
				addStep(steps, {
					stage: 'code_analysis',
					status: 'error',
					packageName: dep.name,
					message: `code-analysis agent failed for ${dep.name}: ${err instanceof Error ? err.message : 'unknown error'}`
				})
			}
		}

		addStep(steps, {
			stage: 'code_analysis',
			status: 'success',
			message: 'code-vulnerability agent completed'
		})

		addStep(steps, {
			stage: 'finalize',
			status: 'success',
			message: `analysis completed with ${findings.length} findings`
		})
	} finally {
		await teardownSandbox(sandbox)
		addStep(steps, {
			stage: 'sandbox',
			status: 'success',
			message: `sandbox torn down (${sandbox.id})`
		})
	}

	const supplyChainFindings = findings.filter((item) => item.agent === 'supply_chain').length
	const codeFindings = findings.filter((item) => item.agent === 'code_vuln').length

	return {
		findings,
		steps,
		stats: {
			dependenciesScanned: selected.length,
			findingsTotal: findings.length,
			supplyChainFindings,
			codeFindings
		}
	}
}
