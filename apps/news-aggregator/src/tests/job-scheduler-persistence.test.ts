// Set test environment before any imports
process.env.NODE_ENV = 'test'

import { clearTestData, getTestDb, setupTestDatabase } from '@babel-feed/pgdb'
import { beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { JobDatabaseServiceImpl } from '../services/job-db'
import { JobScheduler } from '../services/job-scheduler'

beforeAll(async () => {
  await setupTestDatabase()
})

describe('Job Scheduler Database Persistence', () => {
  let jobDb: JobDatabaseServiceImpl
  let jobScheduler: JobScheduler
  let db: ReturnType<typeof getTestDb>

  beforeAll(async () => {
    db = getTestDb()
    
    // Initialize job database service with test database
    jobDb = new JobDatabaseServiceImpl()
    await jobDb.initialize()
    
    jobScheduler = new JobScheduler()
    // Manually set the job database service for testing
    ;(jobScheduler as any).jobDb = jobDb
  })



  beforeEach(async () => {
    await clearTestData()
  })

  describe('JobDatabaseService', () => {
    it('should initialize default jobs', async () => {
      await jobDb.initializeDefaultJobs()
      
      const configs = await jobDb.getJobConfigs()
      expect(configs).toHaveLength(5) // source-discovery, url-fetching, article-processing, health-monitoring, cleanup
      
      const configNames = configs.map(c => c.name).sort()
      expect(configNames).toEqual([
        'article-processing',
        'cleanup',
        'health-monitoring',
        'source-discovery',
        'url-fetching'
      ])
      
      // Check that each job has a corresponding status record
      for (const config of configs) {
        const status = await jobDb.getJobStatus(config.id)
        expect(status).toBeTruthy()
        expect(status!.running).toBe(false)
        expect(status!.totalRuns).toBe(0)
        expect(status!.totalErrors).toBe(0)
      }
    })

    it('should create and retrieve job configs', async () => {
      const testJob = await jobDb.createJobConfig({
        name: 'test-job',
        interval: 30000,
        enabled: true,
        maxConcurrency: 2,
        retryAttempts: 3,
        timeout: 60000,
        description: 'Test job for unit testing'
      })

      expect(testJob.name).toBe('test-job')
      expect(testJob.interval).toBe(30000)
      expect(testJob.enabled).toBe(true)

      const retrieved = await jobDb.getJobConfig('test-job')
      expect(retrieved).toBeTruthy()
      expect(retrieved!.name).toBe('test-job')
      expect(retrieved!.description).toBe('Test job for unit testing')
    })

    it('should update job configs', async () => {
      const testJob = await jobDb.createJobConfig({
        name: 'update-test',
        interval: 30000,
        enabled: true
      })

      const updated = await jobDb.updateJobConfig('update-test', {
        interval: 60000,
        enabled: false,
        maxConcurrency: 5
      })

      expect(updated).toBeTruthy()
      expect(updated!.interval).toBe(60000)
      expect(updated!.enabled).toBe(false)
      expect(updated!.maxConcurrency).toBe(5)
    })

    it('should create and track job executions', async () => {
      const testJob = await jobDb.createJobConfig({
        name: 'execution-test',
        interval: 30000,
        enabled: true
      })

      const execution = await jobDb.createJobExecution({
        jobConfigId: testJob.id,
        executionId: 'test-exec-001',
        status: 'running',
        startedAt: new Date(),
        triggeredBy: 'manual'
      })

      expect(execution.jobConfigId).toBe(testJob.id)
      expect(execution.executionId).toBe('test-exec-001')
      expect(execution.status).toBe('running')
      expect(execution.triggeredBy).toBe('manual')

      // Update execution to completed
      const updated = await jobDb.updateJobExecution('test-exec-001', {
        status: 'success',
        completedAt: new Date(),
        processingTime: 5000,
        processed: 10,
        errors: 0,
        skipped: 1
      })

      expect(updated).toBeTruthy()
      expect(updated!.status).toBe('success')
      expect(updated!.processed).toBe(10)
      expect(updated!.errors).toBe(0)
    })

    it('should maintain job execution history', async () => {
      const testJob = await jobDb.createJobConfig({
        name: 'history-test',
        interval: 30000,
        enabled: true
      })

      // Create multiple executions
      const executions = []
      for (let i = 0; i < 5; i++) {
        const execution = await jobDb.createJobExecution({
          jobConfigId: testJob.id,
          executionId: `history-exec-${i.toString().padStart(3, '0')}`,
          status: i % 2 === 0 ? 'success' : 'failed',
          startedAt: new Date(Date.now() - (5 - i) * 60000), // Staggered by 1 minute
          completedAt: new Date(Date.now() - (5 - i) * 60000 + 30000),
          processingTime: 30000,
          processed: i * 10,
          errors: i % 2 === 0 ? 0 : 1,
          triggeredBy: 'schedule'
        })
        executions.push(execution)
      }

      const history = await jobDb.getJobExecutionHistory(testJob.id, 3)
      expect(history).toHaveLength(3)
      
      // Should be ordered by most recent first
      expect(history[0].executionId).toBe('history-exec-004')
      expect(history[1].executionId).toBe('history-exec-003')
      expect(history[2].executionId).toBe('history-exec-002')

      const fullHistory = await jobDb.getJobExecutionHistory(testJob.id, 10)
      expect(fullHistory).toHaveLength(5)
    })

    it('should update job status with execution results', async () => {
      const testJob = await jobDb.createJobConfig({
        name: 'status-test',
        interval: 30000,
        enabled: true
      })

      // Create initial status
      const status = await jobDb.upsertJobStatus({
        jobConfigId: testJob.id,
        running: false,
        totalRuns: 0,
        totalErrors: 0,
        consecutiveFailures: 0,
        averageProcessingTime: 0
      })

      expect(status.running).toBe(false)
      expect(status.totalRuns).toBe(0)

      // Update status after job run
      const updated = await jobDb.updateJobStatus(testJob.id, {
        running: false,
        lastRun: new Date(),
        lastSuccess: new Date(),
        totalRuns: 1,
        averageProcessingTime: 5000,
        consecutiveFailures: 0
      })

      expect(updated).toBeTruthy()
      expect(updated!.totalRuns).toBe(1)
      expect(updated!.averageProcessingTime).toBe(5000)
      expect(updated!.lastRun).toBeTruthy()
      expect(updated!.lastSuccess).toBeTruthy()
    })
  })

  describe('JobScheduler Integration', () => {
    beforeEach(async () => {
      // Initialize default jobs for scheduler tests
      await jobDb.initializeDefaultJobs()
    })

    it('should load jobs from database on initialization', async () => {
      // Mock the necessary methods to avoid full initialization
      ;(jobScheduler as any).db = db
      ;(jobScheduler as any).newsSourcer = { initialize: async () => {} }
      
      await (jobScheduler as any).loadJobsFromDatabase()
      
      const allStatus = jobScheduler.getAllJobStatus()
      expect(allStatus).toHaveLength(5)
      
      const jobNames = allStatus.map(s => s.name).sort()
      expect(jobNames).toEqual([
        'article-processing',
        'cleanup',
        'health-monitoring',
        'source-discovery',
        'url-fetching'
      ])
    })

    it('should calculate next run time based on last execution', async () => {
      const testJob = await jobDb.createJobConfig({
        name: 'timing-test',
        interval: 60000, // 1 minute
        enabled: true
      })

      // Create a job execution from 30 seconds ago
      const lastExecution = await jobDb.createJobExecution({
        jobConfigId: testJob.id,
        executionId: 'timing-exec-001',
        status: 'success',
        startedAt: new Date(Date.now() - 30000), // 30 seconds ago
        completedAt: new Date(Date.now() - 25000),
        triggeredBy: 'schedule'
      })

      // Add job to scheduler's job map
      ;(jobScheduler as any).jobs.set('timing-test', {
        name: 'timing-test',
        interval: 60000,
        enabled: true,
        maxConcurrency: 1,
        retryAttempts: 3,
        timeout: 60000
      })

      const nextRunTime = await (jobScheduler as any).calculateNextRunTime('timing-test')
      const expectedNextRun = new Date(lastExecution.startedAt).getTime() + 60000

      // Should be approximately 30 seconds from now (60s interval - 30s since last run)
      expect(nextRunTime).toBeCloseTo(expectedNextRun, -2) // Allow 100ms tolerance
    })

    it('should persist job execution results to database', async () => {
      // This test would require mocking the actual job execution logic
      // For now, we'll test the database integration aspects
      const testJob = await jobDb.createJobConfig({
        name: 'persistence-test',
        interval: 30000,
        enabled: true
      })

      // Create initial job status record
      await jobDb.upsertJobStatus({
        jobConfigId: testJob.id,
        running: false,
        totalRuns: 0,
        totalErrors: 0,
        consecutiveFailures: 0,
        averageProcessingTime: 0
      })

      // Manually create an execution record like the scheduler would
      const execution = await jobDb.createJobExecution({
        jobConfigId: testJob.id,
        executionId: 'persistence-exec-001',
        status: 'running',
        startedAt: new Date(),
        triggeredBy: 'manual'
      })

      // Simulate successful completion
      await jobDb.updateJobExecution('persistence-exec-001', {
        status: 'success',
        completedAt: new Date(),
        processingTime: 2500,
        processed: 15,
        errors: 0,
        skipped: 2,
        result: {
          success: true,
          details: {
            processed: 15,
            errors: 0,
            skipped: 2,
            processingTime: 2500
          }
        }
      })

      // Update job status
      await jobDb.updateJobStatus(testJob.id, {
        running: false,
        lastRun: new Date(),
        lastSuccess: new Date(),
        totalRuns: 1,
        averageProcessingTime: 2500,
        consecutiveFailures: 0
      })

      // Verify persistence
      const updatedExecution = await jobDb.getLastExecution(testJob.id)
      expect(updatedExecution).toBeTruthy()
      expect(updatedExecution!.status).toBe('success')
      expect(updatedExecution!.processed).toBe(15)
      expect(updatedExecution!.processingTime).toBe(2500)

      const updatedStatus = await jobDb.getJobStatus(testJob.id)
      expect(updatedStatus).toBeTruthy()
      expect(updatedStatus!.totalRuns).toBe(1)
      expect(updatedStatus!.averageProcessingTime).toBe(2500)
      expect(updatedStatus!.consecutiveFailures).toBe(0)
    })
  })
})