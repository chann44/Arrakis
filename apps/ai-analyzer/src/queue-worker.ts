import { Worker } from 'bullmq'
import { analyzeRepository } from './analyzer'
import { analyzeQueueName, queueConnection } from './queue'
import type { AnalyzeRepositoryRequest, AnalyzeRepositoryResponse } from './types'

const worker = new Worker<AnalyzeRepositoryRequest, AnalyzeRepositoryResponse>(
	analyzeQueueName,
	async (job) => {
		return analyzeRepository(job.data)
	},
	{ connection: queueConnection }
)

worker.on('ready', () => {
	console.log(`ai-analyzer queue worker ready for queue '${analyzeQueueName}'`)
})

worker.on('completed', (job) => {
	console.log(`ai-analyzer queue job completed: ${job.id}`)
})

worker.on('failed', (job, err) => {
	console.error(`ai-analyzer queue job failed: ${job?.id ?? 'unknown'}: ${err.message}`)
})

const shutdown = async () => {
	await worker.close()
	await queueConnection.quit()
	process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
