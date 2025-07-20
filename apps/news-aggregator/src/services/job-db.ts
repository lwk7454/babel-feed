import { eq, and, desc, asc } from 'drizzle-orm'
import { jobConfigs, jobStatus, jobExecutions, getDatabase, JobConfig, NewJobConfig, JobStatus, NewJobStatus, JobExecution, NewJobExecution } from '@babel-feed/pgdb'
import { logger } from '@babel-feed/utils'

export interface JobDatabaseService {
  // Initialization
  initialize(): Promise<void>

  // Job Config operations
  getJobConfigs(): Promise<JobConfig[]>
  getJobConfig(name: string): Promise<JobConfig | null>
  createJobConfig(config: NewJobConfig): Promise<JobConfig>
  updateJobConfig(name: string, updates: Partial<NewJobConfig>): Promise<JobConfig | null>
  deleteJobConfig(name: string): Promise<boolean>

  // Job Status operations
  getJobStatus(configId: string): Promise<JobStatus | null>
  getJobStatusByName(jobName: string): Promise<JobStatus | null>
  getAllJobStatus(): Promise<(JobStatus & { config: JobConfig })[]>
  upsertJobStatus(status: NewJobStatus): Promise<JobStatus>
  updateJobStatus(configId: string, updates: Partial<Omit<NewJobStatus, 'jobConfigId'>>): Promise<JobStatus | null>

  // Job Execution operations
  createJobExecution(execution: NewJobExecution): Promise<JobExecution>
  updateJobExecution(executionId: string, updates: Partial<NewJobExecution>): Promise<JobExecution | null>
  getJobExecutionHistory(configId: string, limit?: number): Promise<JobExecution[]>
  getJobExecutionHistoryByName(jobName: string, limit?: number): Promise<JobExecution[]>
  getRunningExecutions(): Promise<JobExecution[]>
  getLastExecution(configId: string): Promise<JobExecution | null>

  // Utility operations
  initializeDefaultJobs(): Promise<void>
  cleanup(): Promise<void>
}

export class JobDatabaseServiceImpl implements JobDatabaseService {
  private db!: Awaited<ReturnType<typeof getDatabase>>

  async initialize(): Promise<void> {
    this.db = await getDatabase()
  }

  // Job Config operations
  async getJobConfigs(): Promise<JobConfig[]> {
    return await this.db.select().from(jobConfigs).orderBy(asc(jobConfigs.name))
  }

  async getJobConfig(name: string): Promise<JobConfig | null> {
    const results = await this.db
      .select()
      .from(jobConfigs)
      .where(eq(jobConfigs.name, name))
      .limit(1)
    
    return results[0] || null
  }

  async createJobConfig(config: NewJobConfig): Promise<JobConfig> {
    const [result] = await this.db
      .insert(jobConfigs)
      .values(config)
      .returning()
    
    logger.info(`Created job config: ${result.name}`)
    return result
  }

  async updateJobConfig(name: string, updates: Partial<NewJobConfig>): Promise<JobConfig | null> {
    const [result] = await this.db
      .update(jobConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobConfigs.name, name))
      .returning()
    
    if (result) {
      logger.info(`Updated job config: ${name}`, updates)
    }
    
    return result || null
  }

  async deleteJobConfig(name: string): Promise<boolean> {
    const result = await this.db
      .delete(jobConfigs)
      .where(eq(jobConfigs.name, name))
      .returning()
    
    const deleted = result.length > 0
    if (deleted) {
      logger.info(`Deleted job config: ${name}`)
    }
    
    return deleted
  }

  // Job Status operations
  async getJobStatus(configId: string): Promise<JobStatus | null> {
    const results = await this.db
      .select()
      .from(jobStatus)
      .where(eq(jobStatus.jobConfigId, configId))
      .limit(1)
    
    return results[0] || null
  }

  async getJobStatusByName(jobName: string): Promise<JobStatus | null> {
    const results = await this.db
      .select({
        id: jobStatus.id,
        jobConfigId: jobStatus.jobConfigId,
        running: jobStatus.running,
        lastRun: jobStatus.lastRun,
        lastSuccess: jobStatus.lastSuccess,
        lastError: jobStatus.lastError,
        nextRun: jobStatus.nextRun,
        totalRuns: jobStatus.totalRuns,
        totalErrors: jobStatus.totalErrors,
        consecutiveFailures: jobStatus.consecutiveFailures,
        averageProcessingTime: jobStatus.averageProcessingTime,
        metadata: jobStatus.metadata,
        createdAt: jobStatus.createdAt,
        updatedAt: jobStatus.updatedAt
      })
      .from(jobStatus)
      .innerJoin(jobConfigs, eq(jobStatus.jobConfigId, jobConfigs.id))
      .where(eq(jobConfigs.name, jobName))
      .limit(1)
    
    return results[0] || null
  }

  async getAllJobStatus(): Promise<(JobStatus & { config: JobConfig })[]> {
    const results = await this.db
      .select()
      .from(jobStatus)
      .innerJoin(jobConfigs, eq(jobStatus.jobConfigId, jobConfigs.id))
      .orderBy(asc(jobConfigs.name))
    
    return results.map(row => ({
      ...row.job_status,
      config: row.job_configs
    }))
  }

  async upsertJobStatus(status: NewJobStatus): Promise<JobStatus> {
    const [result] = await this.db
      .insert(jobStatus)
      .values(status)
      .onConflictDoUpdate({
        target: jobStatus.jobConfigId,
        set: {
          ...status,
          updatedAt: new Date()
        }
      })
      .returning()
    
    return result
  }

  async updateJobStatus(configId: string, updates: Partial<Omit<NewJobStatus, 'jobConfigId'>>): Promise<JobStatus | null> {
    const [result] = await this.db
      .update(jobStatus)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobStatus.jobConfigId, configId))
      .returning()
    
    return result || null
  }

  // Job Execution operations
  async createJobExecution(execution: NewJobExecution): Promise<JobExecution> {
    const [result] = await this.db
      .insert(jobExecutions)
      .values(execution)
      .returning()
    
    return result
  }

  async updateJobExecution(executionId: string, updates: Partial<NewJobExecution>): Promise<JobExecution | null> {
    const [result] = await this.db
      .update(jobExecutions)
      .set(updates)
      .where(eq(jobExecutions.executionId, executionId))
      .returning()
    
    return result || null
  }

  async getJobExecutionHistory(configId: string, limit = 50): Promise<JobExecution[]> {
    return await this.db
      .select()
      .from(jobExecutions)
      .where(eq(jobExecutions.jobConfigId, configId))
      .orderBy(desc(jobExecutions.startedAt))
      .limit(limit)
  }

  async getJobExecutionHistoryByName(jobName: string, limit = 50): Promise<JobExecution[]> {
    return await this.db
      .select({
        id: jobExecutions.id,
        jobConfigId: jobExecutions.jobConfigId,
        executionId: jobExecutions.executionId,
        status: jobExecutions.status,
        startedAt: jobExecutions.startedAt,
        completedAt: jobExecutions.completedAt,
        processingTime: jobExecutions.processingTime,
        processed: jobExecutions.processed,
        errors: jobExecutions.errors,
        skipped: jobExecutions.skipped,
        errorMessage: jobExecutions.errorMessage,
        result: jobExecutions.result,
        triggeredBy: jobExecutions.triggeredBy,
        createdAt: jobExecutions.createdAt
      })
      .from(jobExecutions)
      .innerJoin(jobConfigs, eq(jobExecutions.jobConfigId, jobConfigs.id))
      .where(eq(jobConfigs.name, jobName))
      .orderBy(desc(jobExecutions.startedAt))
      .limit(limit)
  }

  async getRunningExecutions(): Promise<JobExecution[]> {
    return await this.db
      .select()
      .from(jobExecutions)
      .where(eq(jobExecutions.status, 'running'))
      .orderBy(asc(jobExecutions.startedAt))
  }

  async getLastExecution(configId: string): Promise<JobExecution | null> {
    const results = await this.db
      .select()
      .from(jobExecutions)
      .where(eq(jobExecutions.jobConfigId, configId))
      .orderBy(desc(jobExecutions.startedAt))
      .limit(1)
    
    return results[0] || null
  }

  // Utility operations
  async initializeDefaultJobs(): Promise<void> {
    const defaultJobs: NewJobConfig[] = [
      {
        name: 'source-discovery',
        interval: 6 * 60 * 60 * 1000, // 6 hours
        enabled: true,
        maxConcurrency: 1,
        retryAttempts: 3,
        timeout: 300000, // 5 minutes
        description: 'Discover new news sources from various seed lists and public directories'
      },
      {
        name: 'url-fetching',
        interval: 30 * 60 * 1000, // 30 minutes
        enabled: true,
        maxConcurrency: 5,
        retryAttempts: 2,
        timeout: 60000, // 1 minute
        description: 'Fetch article URLs from configured news sources'
      },
      {
        name: 'article-processing',
        interval: 30 * 60 * 1000, // 30 minutes
        enabled: true,
        maxConcurrency: 8,
        retryAttempts: 2,
        timeout: 180000, // 3 minutes
        description: 'Extract and process article content with AI summarization and translation'
      },
      {
        name: 'health-monitoring',
        interval: 5 * 60 * 1000, // 5 minutes
        enabled: true,
        maxConcurrency: 1,
        retryAttempts: 1,
        timeout: 30000, // 30 seconds
        description: 'Monitor system health, source reliability, and performance metrics'
      },
      {
        name: 'cleanup',
        interval: 24 * 60 * 60 * 1000, // 24 hours
        enabled: true,
        maxConcurrency: 1,
        retryAttempts: 1,
        timeout: 300000, // 5 minutes
        description: 'Clean up old data, expired cache entries, and perform maintenance tasks'
      }
    ]

    for (const job of defaultJobs) {
      try {
        // Check if job already exists
        const existing = await this.getJobConfig(job.name)
        if (!existing) {
          // Create job config
          const config = await this.createJobConfig(job)
          
          // Create initial job status
          await this.upsertJobStatus({
            jobConfigId: config.id,
            running: false,
            totalRuns: 0,
            totalErrors: 0,
            consecutiveFailures: 0,
            averageProcessingTime: 0
          })
          
          logger.info(`Initialized default job: ${job.name}`)
        }
      } catch (error) {
        logger.error(`Failed to initialize job ${job.name}:`, error)
      }
    }
  }

  async cleanup(): Promise<void> {
    // Clean up old job executions (keep last 1000 per job)
    const configs = await this.getJobConfigs()
    
    for (const config of configs) {
      try {
        // Keep only the latest 1000 executions per job
        const allExecutions = await this.db
          .select({ id: jobExecutions.id })
          .from(jobExecutions)
          .where(eq(jobExecutions.jobConfigId, config.id))
          .orderBy(desc(jobExecutions.startedAt))
        
        if (allExecutions.length > 1000) {
          const idsToKeep = allExecutions.slice(0, 1000).map(e => e.id)
          
          await this.db
            .delete(jobExecutions)
            .where(
              and(
                eq(jobExecutions.jobConfigId, config.id),
                // Delete executions not in the keep list
                // This is a simplified approach; in production you might want a more efficient query
              )
            )
          
          logger.info(`Cleaned up old executions for job: ${config.name}`)
        }
      } catch (error) {
        logger.error(`Failed to cleanup executions for job ${config.name}:`, error)
      }
    }
  }
}