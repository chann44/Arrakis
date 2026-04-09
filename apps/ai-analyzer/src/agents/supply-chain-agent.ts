import { generateText } from 'ai'
import { z } from 'zod'
import { getSupplyChainPrompt } from '../prompts'
import { createDBFindingTools } from '../tools/db-finding-tools'
import { createSupplyChainTools } from '../tools/supply-chain-tools'
import type { AIFinding, DependencyInput } from '../types'
import { formatAgentError } from './error'
import { getAIModel, getModelDebugInfo, hasAIModelConfig } from './model'

const outputSchema = z.object({
	findings: z
		.array(
			z.object({
				severity: z.enum(['low', 'medium', 'high', 'critical']),
				title: z.string().min(1),
				summary: z.string().min(1),
				indicator: z.string().min(1),
				reason: z.string().min(1),
				confidence: z.number().min(0).max(1).optional(),
				referenceURL: z.string().optional()
			})
		)
		.default([])
})

function extractJSON(text: string): unknown {
	const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i)
	const candidate = fencedMatch ? fencedMatch[1] : text
	const start = candidate.indexOf('{')
	const end = candidate.lastIndexOf('}')
	if (start === -1 || end === -1 || end <= start) {
		throw new Error('model did not return a JSON object')
	}
	return JSON.parse(candidate.slice(start, end + 1))
}

function sanitizeID(input: string): string {
	return input.toUpperCase().replace(/[^A-Z0-9]+/g, '-')
}

function fallbackFinding(dep: DependencyInput): AIFinding[] {
	const lower = dep.name.toLowerCase()
	if (!lower.includes('internal') && !lower.includes('private') && !lower.includes('corp')) {
		return []
	}

	return [
		{
			agent: 'supply_chain',
			severity: 'high',
			confidence: 0.72,
			advisoryId: `AI-SUPPLY-CONFUSION-${sanitizeID(dep.name)}`,
			title: `Potential dependency confusion risk: ${dep.name}`,
			summary:
				'Dependency name suggests internal/private use while fetched from a public registry.',
			packageName: dep.name,
			manager: dep.manager,
			registry: dep.registry,
			versionSpec: dep.versionSpec,
			resolvedVersion: dep.resolvedVersion,
			referenceURL: '',
			evidence: {
				reason: 'Name pattern indicates potential internal package naming style.',
				indicator: 'dependency-confusion-pattern'
			}
		}
	]
}

export async function runSupplyChainAgent(dep: DependencyInput, repositoryID: number): Promise<AIFinding[]> {
	if (!hasAIModelConfig()) {
		return fallbackFinding(dep)
	}

	const debug = getModelDebugInfo()
	let responseText = ''

	try {
		const response = await generateText({
			model: getAIModel(),
			system: getSupplyChainPrompt(dep),
			prompt: [
			`Analyze package ${dep.name}@${dep.resolvedVersion || dep.versionSpec}.`,
			'First call check_existing_ai_findings to see prior AI advisories for this dependency.',
			'When calling tools, always send every parameter explicitly (including version, registryURL, maxDepth, maxNodes, limit).',
			'Use registryURL=https://registry.npmjs.org and numeric defaults maxDepth=2, maxNodes=200, limit=25 when unsure.',
			'Use tools before finalizing your verdict.',
				'Return strict JSON with shape: {"findings":[{severity,title,summary,indicator,reason,confidence,referenceURL}]}.',
				'If there are no issues, return {"findings":[]}.',
				`Registry: ${dep.registry}`,
				`Manager: ${dep.manager}`,
				`Repository ID: ${repositoryID}`
			].join('\n'),
			tools: {
				...createSupplyChainTools(),
				...createDBFindingTools({ repositoryId: repositoryID })
			},
			maxSteps: 8,
			temperature: 0
		})

		responseText = response.text
	} catch (err) {
		throw new Error(
			`Provider call failed (agent=supply_chain provider=${debug.provider} model=${debug.model}): ${formatAgentError(err)}`
		)
	}

	let parsed: z.infer<typeof outputSchema>
	try {
		parsed = outputSchema.parse(extractJSON(responseText))
	} catch (err) {
		throw new Error(
			`Model output parse failed (agent=supply_chain provider=${debug.provider} model=${debug.model}): ${formatAgentError(err)}`
		)
	}

	return parsed.findings.map((finding, index) => ({
		agent: 'supply_chain',
		severity: finding.severity,
		confidence: finding.confidence ?? 0.7,
		advisoryId: `AI-SUPPLY-${sanitizeID(dep.name)}-${String(index + 1).padStart(3, '0')}`,
		title: finding.title,
		summary: finding.summary,
		packageName: dep.name,
		manager: dep.manager,
		registry: dep.registry,
		versionSpec: dep.versionSpec,
		resolvedVersion: dep.resolvedVersion,
		referenceURL: finding.referenceURL ?? '',
		evidence: {
			reason: finding.reason,
			indicator: finding.indicator
		}
	}))
}
