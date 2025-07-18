import { RecommendationEngine } from './recommendation-engine'

export { ContentClassifier } from './content-classifier'
export { SimilarityEngine } from './similarity-engine'
export { BehaviorAnalyzer } from './behavior-analyzer'
export { RecommendationEngine } from './recommendation-engine'

export type {
  UserProfile,
  UserPreferences,
  UserBehavior,
  ReadingPattern,
  UserInteraction,
  EngagementMetrics,
  TimeBasedPreferences,
  UserDemographics,
  ContentScore,
  RecommendationContext,
  RecommendationFilters,
  RecommendationResult,
  ScoredArticle,
  RecommendationMetadata,
  TrendingTopic,
  ContentSimilarity,
  RecommendationFeedback,
  ModelPerformanceMetrics,
  RecommendationConfig
} from './types'

// Helper function to create a complete recommendation system instance
export function createRecommendationSystem() {
  return new RecommendationEngine()
}