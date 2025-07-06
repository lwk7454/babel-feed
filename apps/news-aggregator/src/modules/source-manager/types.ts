// Source management types
export interface NewsSource {
  id: string;
  name: string;
  url: string;
  feedUrl?: string;
  category: string;
  language: string;
  pollingInterval: number;
  enabled: boolean;
  lastProcessed?: Date;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceHealth {
  sourceId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorRate: number;
  consecutiveErrors: number;
  lastError?: string;
}

export interface SourceDiscoveryCandidate {
  url: string;
  feedUrl?: string;
  name?: string;
  category?: string;
  language?: string;
  score: number;
  discoveredAt: Date;
  validated: boolean;
  validationErrors?: string[];
}

export interface SourceUpdateData {
  name?: string;
  url?: string;
  feedUrl?: string;
  category?: string;
  language?: string;
  pollingInterval?: number;
  enabled?: boolean;
}

export interface SourceCreateData {
  name: string;
  url: string;
  feedUrl?: string;
  category: string;
  language: string;
  pollingInterval?: number;
  enabled?: boolean;
}

export interface SourceQuery {
  category?: string;
  language?: string;
  enabled?: boolean;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  limit?: number;
  offset?: number;
}

// TODO: Add more types as needed
// - Source validation results
// - Source statistics
// - Source performance metrics
// - Source discovery configuration