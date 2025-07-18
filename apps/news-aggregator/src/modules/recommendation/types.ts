export interface UserProfile {
  userId: string
  preferences: UserPreferences
  behavior: UserBehavior
  demographics?: UserDemographics
}

export interface UserPreferences {
  languages: string[]
  categories: string[]
  sources: string[]
  topics: Record<string, number>
  excludedTopics: string[]
  readingTime: 'short' | 'medium' | 'long'
  contentTypes: ('article' | 'video' | 'podcast')[]
}

export interface UserBehavior {
  readingPatterns: ReadingPattern[]
  interactionHistory: UserInteraction[]
  engagementMetrics: EngagementMetrics
  timeBasedPreferences: TimeBasedPreferences
}

export interface ReadingPattern {
  timeOfDay: number // 0-23
  dayOfWeek: number // 0-6
  duration: number // minutes
  deviceType: 'mobile' | 'tablet' | 'desktop'
  scrollDepth: number // 0-1
}

export interface UserInteraction {
  articleId: string
  userId: string
  sessionId?: string
  type: 'view' | 'translate' | 'share' | 'save' | 'like' | 'dislike'
  timestamp: Date
  duration?: number
  metadata?: Record<string, unknown>
}

export interface EngagementMetrics {
  averageReadTime: number
  completionRate: number
  shareRate: number
  translationRate: number
  returnRate: number
  diversityScore: number
}

export interface TimeBasedPreferences {
  morningTopics: string[]
  afternoonTopics: string[]
  eveningTopics: string[]
  weekendTopics: string[]
  seasonalTrends: Record<string, number>
}

export interface UserDemographics {
  ageGroup?: string
  location?: {
    country: string
    region?: string
    timezone: string
  }
  deviceInfo?: {
    platform: string
    version: string
  }
}

export interface ContentScore {
  articleId: string
  userId: string
  totalScore: number
  subscores: {
    relevance: number
    freshness: number
    popularity: number
    diversity: number
    quality: number
    personalization: number
  }
  explanation?: string[]
}

export interface RecommendationContext {
  userId: string
  sessionId?: string
  currentTime: Date
  deviceType: 'mobile' | 'tablet' | 'desktop'
  location?: {
    country: string
    timezone: string
  }
  feedType: 'home' | 'trending' | 'category' | 'search'
  limit: number
  offset: number
  filters?: RecommendationFilters
}

export interface RecommendationFilters {
  languages?: string[]
  categories?: string[]
  sources?: string[]
  timeRange?: {
    start: Date
    end: Date
  }
  minQuality?: number
  excludeSeen?: boolean
}

export interface RecommendationResult {
  articles: ScoredArticle[]
  metadata: RecommendationMetadata
  nextOffset?: number
  hasMore: boolean
}

export interface ScoredArticle {
  articleId: string
  title: string
  summary: string
  source: string
  publishedAt: Date
  score: number
  tags: string[]
  language: string
  readingTime: number
  translationAvailable: boolean
  reasonCodes: string[]
}

export interface RecommendationMetadata {
  algorithm: string
  version: string
  processingTime: number
  totalCandidates: number
  appliedFilters: string[]
  diversityScore: number
  explanations: Record<string, string>
}

export interface TrendingTopic {
  topic: string
  category: string
  score: number
  velocity: number // rate of growth
  articles: string[] // article IDs
  timeWindow: {
    start: Date
    end: Date
  }
  geographic?: string[]
  demographic?: Record<string, number>
}

export interface ContentSimilarity {
  articleId1: string
  articleId2: string
  similarity: number
  type: 'semantic' | 'topic' | 'entity' | 'collaborative'
  features: Record<string, number>
}

export interface RecommendationFeedback {
  userId: string
  articleId: string
  sessionId?: string
  type: 'implicit' | 'explicit'
  action: 'click' | 'read' | 'share' | 'save' | 'like' | 'dislike' | 'skip' | 'hide'
  rating?: number // 1-5 for explicit feedback
  timestamp: Date
  context: {
    position: number
    totalShown: number
    algorithm: string
    reasonCodes: string[]
  }
}

export interface ModelPerformanceMetrics {
  algorithm: string
  period: {
    start: Date
    end: Date
  }
  metrics: {
    clickThroughRate: number
    engagementRate: number
    diversityScore: number
    noveltyScore: number
    precisionAtK: Record<number, number>
    recallAtK: Record<number, number>
    meanReciprocalRank: number
    normalizedDiscountedCumulativeGain: Record<number, number>
  }
  userSegments: Record<string, Partial<ModelPerformanceMetrics['metrics']>>
}

export interface RecommendationConfig {
  algorithms: {
    contentBased: {
      enabled: boolean
      weight: number
      features: string[]
    }
    collaborative: {
      enabled: boolean
      weight: number
      minInteractions: number
    }
    trending: {
      enabled: boolean
      weight: number
      timeWindow: number
    }
    personalized: {
      enabled: boolean
      weight: number
      learningRate: number
    }
  }
  diversity: {
    enabled: boolean
    categoryThreshold: number
    sourceThreshold: number
    topicThreshold: number
  }
  freshness: {
    enabled: boolean
    decayRate: number
    maxAge: number
  }
  quality: {
    enabled: boolean
    minScore: number
    sourceBias: number
  }
}