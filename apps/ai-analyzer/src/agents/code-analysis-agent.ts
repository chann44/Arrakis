import { generateText } from 'ai'
import { z } from 'zod'
import { getCodeAnalysisPrompt } from '../prompts'
import { createCodeAnalysisTools } from '../tools/code-analysis-tools'
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
				referenceURL: z.string().optional(),
				scriptName: z.string().optional(),
				scriptValue: z.string().optional()
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

export async function runCodeAnalysisAgent(dep: DependencyInput): Promise<AIFinding[]> {
	if (!hasAIModelConfig()) {
		return []
	}

	const response = await generateText({
		model: getAIModel(),
		system: getCodeAnalysisPrompt(dep),
		prompt: [
			`Analyze package ${dep.name}@${dep.resolvedVersion || dep.versionSpec}.`,
			'Use the provided tools to fetch manifest/source and inspect risky patterns.',
			'Return strict JSON with shape: {"findings":[{severity,title,summary,indicator,reason,confidence,referenceURL,scriptName,scriptValue}]}.',
			'If no findings are present, return {"findings":[]}.',
			`Registry: ${dep.registry}`,
			`Manager: ${dep.manager}`
		].join('\n'),
		tools: createCodeAnalysisTools(),
		maxSteps: 12,
		temperature: 0
	})

	const parsed = outputSchema.parse(extractJSON(response.text))

	return parsed.findings.map((finding, index) => ({
		agent: 'code_vuln',
		severity: finding.severity,
		confidence: finding.confidence ?? 0.7,
		advisoryId: `AI-CODE-${sanitizeID(dep.name)}-${String(index + 1).padStart(3, '0')}`,
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
			indicator: finding.indicator,
			scriptName: finding.scriptName,
			scriptValue: finding.scriptValue
		}
	}))
}
