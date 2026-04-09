export type AnalysisStage =
	| 'queued'
	| 'sandbox'
	| 'supply_chain'
	| 'code_analysis'
	| 'finalize'

export type StageStatus = 'start' | 'progress' | 'success' | 'error'

export type DependencyInput = {
	name: string
	manager: string
	registry: string
	versionSpec: string
	resolvedVersion: string
	sourceFile: string
}

export type AnalyzeRepositoryRequest = {
	scanRunId: number
	repoId: number
	dependencies: DependencyInput[]
	maxDependencies?: number
}

export type AILogStep = {
	stage: AnalysisStage
	status: StageStatus
	message: string
	packageName?: string
	createdAt: string
	metadata?: Record<string, string | number | boolean>
}

export type AIFinding = {
	agent: 'supply_chain' | 'code_vuln'
	severity: 'low' | 'medium' | 'high' | 'critical'
	confidence: number
	advisoryId: string
	title: string
	summary: string
	packageName: string
	manager: string
	registry: string
	versionSpec: string
	resolvedVersion: string
	referenceURL: string
	evidence: {
		reason: string
		indicator: string
		scriptName?: string
		scriptValue?: string
	}
}

export type AnalyzeRepositoryResponse = {
	findings: AIFinding[]
	steps: AILogStep[]
	stats: {
		dependenciesScanned: number
		findingsTotal: number
		supplyChainFindings: number
		codeFindings: number
	}
}
