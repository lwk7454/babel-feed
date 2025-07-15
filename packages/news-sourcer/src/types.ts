export interface SourceEndpoint {
  url: string
  type: 'rss' | 'html'
  category?: string
  selector?: string
  priority?: number
  pollingInterval?: number
}

import type { AiProvider, AiProviderKey } from '@babel-feed/pgdb'

export interface LlmProviderClient {
  initialize(): Promise<void>
  getEnabledProviders(type?: string): Promise<AiProvider[]>
  executeWithProvider<T>(providerId: string, operation: (provider: AiProvider, key: AiProviderKey) => Promise<T>): Promise<T>
}
