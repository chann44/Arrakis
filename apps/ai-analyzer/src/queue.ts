import IORedis from 'ioredis'
import { Job, Queue } from 'bullmq'
import type { AnalyzeRepositoryRequest, AnalyzeRepositoryResponse } from './types'

export const analyzeQueueName = (process.env.AI_ANALYZER_QUEUE_NAME ?? 'ai-analyzer-jobs').trim()

export const queueConnection = new IORedis((process.env.REDIS_URL ?? 'redis://127.0.0.1:6379').trim(), {
	maxRetriesPerRequest: null
})

export const analyzeQueue = new Queue<AnalyzeRepositoryRequest, AnalyzeRepositoryResponse>(analyzeQueueName, {
	connection: queueConnection,
	defaultJobOptions: {
		removeOnComplete: 100,
		removeOnFail: 500
	}
})

export async function enqueueAnalyzeRepositoryJob(payload: AnalyzeRepositoryRequest) {
	const job = await analyzeQueue.add('analyze-repository', payload)
	return job
}

export async function getAnalyzeRepositoryJob(jobID: string): Promise<Job | undefined> {
	return analyzeQueue.getJob(jobID)
}
