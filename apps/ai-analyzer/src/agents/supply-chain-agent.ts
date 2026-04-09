import { generateText } from 'ai'
import { z } from 'zod'
import { getSupplyChainPrompt } from '../prompts'
import { createSupplyChainTools } from '../tools/supply-chain-tools'
import type { AIFinding, DependencyInput } from '../types'
import { getAIModel, hasAIModelConfig } from './model'

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

export async function runSupplyChainAgent(dep: DependencyInput): Promise<AIFinding[]> {
	if (!hasAIModelConfig()) {
		return fallbackFinding(dep)
	}

	const response = await generateText({
		model: getAIModel(),
		system: getSupplyChainPrompt(dep),
		prompt: [
			`Analyze package ${dep.name}@${dep.resolvedVersion || dep.versionSpec}.`,
			'Use tools before finalizing your verdict.',
			'Return strict JSON with shape: {"findings":[{severity,title,summary,indicator,reason,confidence,referenceURL}]}.',
			'If there are no issues, return {"findings":[]}.',
			`Registry: ${dep.registry}`,
			`Manager: ${dep.manager}`
		].join('\n'),
		tools: createSupplyChainTools(),
		maxSteps: 8,
		temperature: 0
	})

	const parsed = outputSchema.parse(extractJSON(response.text))

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
