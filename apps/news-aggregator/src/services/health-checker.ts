import { logger } from '@babel-feed/utils'
import { NewsSourceManager } from './news-source-manager'
import { AiProviderManager } from '@babel-feed/llm-provider'

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  services: ServiceHealth[];
  summary: {
    totalSources: number;
    healthySources: number;
    unhealthySources: number;
    lastUpdate: Date;
  };
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime?: number;
  details?: Record<string, unknown>;
}

export class HealthChecker {
  private startTime: Date = new Date()
  private sourceManager?: NewsSourceManager
  private aiProviderManager?: AiProviderManager

  constructor(sourceManager?: NewsSourceManager, aiProviderManager?: AiProviderManager) {
    this.sourceManager = sourceManager
    this.aiProviderManager = aiProviderManager
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const services: ServiceHealth[] = []

    // Check database connectivity
    services.push(await this.checkDatabase())

    // Check source manager
    if (this.sourceManager) {
      services.push(await this.checkSourceManager())
    }

    // Check AI provider manager
    if (this.aiProviderManager) {
      services.push(await this.checkAiProviderManager())
    }

    // Check external services
    services.push(await this.checkExternalServices())

    // Calculate overall status
    const unhealthyServices = services.filter(s => s.status === 'unhealthy')
    const degradedServices = services.filter(s => s.status === 'degraded')

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded'
    }

    // Get source summary
    const sourceSummary = await this.getSourceSummary()

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      services,
      summary: sourceSummary,
    }
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now()
    
    try {
      // TODO: Implement actual database health check
      // For now, assume database is healthy
      const responseTime = Date.now() - startTime
      
      return {
        name: 'database',
        status: 'healthy',
        lastCheck: new Date(),
        responseTime,
        details: {
          connection: 'active',
        },
      }
    } catch (error) {
      logger.error('Database health check failed:', error)
      return {
        name: 'database',
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  private async checkSourceManager(): Promise<ServiceHealth> {
    try {
      if (!this.sourceManager) {
        return {
          name: 'source-manager',
          status: 'unhealthy',
          lastCheck: new Date(),
          details: {
            error: 'Source manager not initialized',
          },
        }
      }

      const sources = await this.sourceManager.getAllSources()
      const enabledSources = await this.sourceManager.getEnabledSources()

      // For database-based source manager, we don't have unhealthy sources tracking yet
      // This would need to be implemented based on recent fetch errors
      const unhealthySources = sources.filter(s => s.errorCount > s.successCount)

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
      if (unhealthySources.length > enabledSources.length * 0.5) {
        status = 'unhealthy'
      } else if (unhealthySources.length > 0) {
        status = 'degraded'
      }

      return {
        name: 'source-manager',
        status,
        lastCheck: new Date(),
        details: {
          totalSources: sources.length,
          enabledSources: enabledSources.length,
          unhealthySources: unhealthySources.length,
        },
      }
    } catch (error) {
      logger.error('Source manager health check failed:', error)
      return {
        name: 'source-manager',
        status: 'unhealthy',
        lastCheck: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  private async checkAiProviderManager(): Promise<ServiceHealth> {
    try {
      if (!this.aiProviderManager) {
        return {
          name: 'ai-provider-manager',
          status: 'unhealthy',
          lastCheck: new Date(),
          details: {
            error: 'AI provider manager not initialized',
          },
        }
      }

      const providers = await this.aiProviderManager.getAllProviders()
      const enabledProviders = await this.aiProviderManager.getEnabledProviders()
      
      // Check health of each provider
      const healthStatuses = await Promise.all(
        enabledProviders.map(p => this.aiProviderManager!.getProviderHealth(p.id))
      )
      
      const healthyProviders = healthStatuses.filter(h => h.healthy)
      const degradedProviders = healthStatuses.filter(h => !h.healthy && h.availableKeys > 0)
      const unhealthyProviders = healthStatuses.filter(h => !h.healthy && h.availableKeys === 0)

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
      if (unhealthyProviders.length === enabledProviders.length) {
        status = 'unhealthy'
      } else if (degradedProviders.length > 0 || unhealthyProviders.length > 0) {
        status = 'degraded'
      }

      return {
        name: 'ai-provider-manager',
        status,
        lastCheck: new Date(),
        details: {
          totalProviders: providers.length,
          enabledProviders: enabledProviders.length,
          healthyProviders: healthyProviders.length,
          degradedProviders: degradedProviders.length,
          unhealthyProviders: unhealthyProviders.length,
        },
      }
    } catch (error) {
      logger.error('AI provider manager health check failed:', error)
      return {
        name: 'ai-provider-manager',
        status: 'unhealthy',
        lastCheck: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  private async checkExternalServices(): Promise<ServiceHealth> {
    // TODO: Check external AI services, etc.
    return {
      name: 'external-services',
      status: 'healthy',
      lastCheck: new Date(),
      details: {
        message: 'External services check not implemented yet',
      },
    }
  }

  private async getSourceSummary() {
    if (!this.sourceManager) {
      return {
        totalSources: 0,
        healthySources: 0,
        unhealthySources: 0,
        lastUpdate: new Date(),
      }
    }

    try {
      const allSources = await this.sourceManager.getAllSources()
      const healthySources = allSources.filter(s => s.errorCount <= s.successCount)
      const unhealthySources = allSources.filter(s => s.errorCount > s.successCount)

      return {
        totalSources: allSources.length,
        healthySources: healthySources.length,
        unhealthySources: unhealthySources.length,
        lastUpdate: new Date(),
      }
    } catch (error) {
      logger.error('Failed to get source summary:', error)
      return {
        totalSources: 0,
        healthySources: 0,
        unhealthySources: 0,
        lastUpdate: new Date(),
      }
    }
  }
}