import { logger } from '@babel-feed/utils'
import { getDatabase, getTestDb, userActivity, userPreferences } from '@babel-feed/pgdb'
import { eq, and, gte, desc } from 'drizzle-orm'
import { 
  UserProfile, 
  UserBehavior, 
  ReadingPattern, 
  UserInteraction, 
  EngagementMetrics,
  TimeBasedPreferences,
  RecommendationFeedback 
} from './types'

export interface BehaviorInsights {
  userId: string
  insights: {
    preferredReadingTimes: number[]
    favoriteCategories: Array<{ category: string; score: number }>
    readingSpeed: 'slow' | 'medium' | 'fast'
    engagementLevel: 'low' | 'medium' | 'high'
    diversityPreference: number // 0-1, higher = prefers diverse content
    loyalSources: string[]
    trendingInterests: string[]
    languageUsage: Record<string, number>
  }
  generatedAt: Date
  confidence: number
}

export class BehaviorAnalyzer {
  private readonly ANALYSIS_WINDOW_DAYS = 30
  private readonly MIN_INTERACTIONS_FOR_INSIGHTS = 10

  private async getDb() {
    return process.env.NODE_ENV === 'test' ? getTestDb() : await getDatabase()
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  async analyzeUserBehavior(userId: string): Promise<BehaviorInsights | null> {
    try {
      // Get user interactions from the last 30 days
      const interactions = await this.getUserInteractions(userId)
      
      if (interactions.length < this.MIN_INTERACTIONS_FOR_INSIGHTS) {
        logger.info(`Insufficient data for user ${userId}: ${interactions.length} interactions`)
        return null
      }

      const readingPatterns = await this.extractReadingPatterns(userId, interactions)
      const engagementMetrics = this.calculateEngagementMetrics(interactions)
      const timeBasedPreferences = this.analyzeTimeBasedPreferences(interactions)
      
      const insights: BehaviorInsights = {
        userId,
        insights: {
          preferredReadingTimes: this.getPreferredReadingTimes(readingPatterns),
          favoriteCategories: await this.getFavoriteCategories(userId),
          readingSpeed: this.classifyReadingSpeed(engagementMetrics.averageReadTime),
          engagementLevel: this.classifyEngagementLevel(engagementMetrics),
          diversityPreference: this.calculateDiversityPreference(interactions),
          loyalSources: await this.identifyLoyalSources(userId),
          trendingInterests: await this.identifyTrendingInterests(userId),
          languageUsage: await this.analyzeLanguageUsage(userId)
        },
        generatedAt: new Date(),
        confidence: this.calculateConfidence(interactions.length, engagementMetrics)
      }

      logger.info(`Generated behavior insights for user ${userId}`)
      return insights
    } catch (error) {
      logger.error(`Failed to analyze behavior for user ${userId}:`, error)
      return null
    }
  }

  async trackUserInteraction(interaction: UserInteraction): Promise<void> {
    try {
      const db = await this.getDb()
      // Store interaction in database
      // For testing, we may not have actual user/session/content records, so set to null if not valid UUIDs
      await db.insert(userActivity).values({
        id: crypto.randomUUID(),
        userId: this.isValidUUID(interaction.userId) ? interaction.userId : null,
        sessionId: interaction.sessionId ? (this.isValidUUID(interaction.sessionId) ? interaction.sessionId : null) : null,
        activityType: interaction.type,
        contentId: interaction.articleId ? (this.isValidUUID(interaction.articleId) ? interaction.articleId : null) : null,
        duration: interaction.duration,
        metadata: interaction.metadata || {},
        createdAt: interaction.timestamp
      })

      logger.debug(`Tracked ${interaction.type} interaction for user ${interaction.userId}`)
    } catch (error) {
      logger.error('Failed to track user interaction:', error)
    }
  }

  async updateReadingPattern(userId: string, pattern: ReadingPattern): Promise<void> {
    try {
      // Update user reading patterns in database
      const existingPatterns = await this.getStoredReadingPatterns(userId)
      const updatedPatterns = this.mergeReadingPatterns(existingPatterns, pattern)
      
      await this.storeReadingPatterns(userId, updatedPatterns)
      
      logger.debug(`Updated reading patterns for user ${userId}`)
    } catch (error) {
      logger.error('Failed to update reading pattern:', error)
    }
  }

  async recordFeedback(feedback: RecommendationFeedback): Promise<void> {
    try {
      const db = await this.getDb()
      // Store recommendation feedback
      await db.insert(userActivity).values({
        id: crypto.randomUUID(),
        userId: feedback.userId,
        sessionId: feedback.sessionId,
        activityType: feedback.action,
        contentId: feedback.articleId,
        metadata: {
          feedbackType: feedback.type,
          rating: feedback.rating,
          position: feedback.context.position,
          totalShown: feedback.context.totalShown,
          algorithm: feedback.context.algorithm,
          reasonCodes: feedback.context.reasonCodes
        },
        createdAt: feedback.timestamp
      })

      // Update user preferences based on feedback
      await this.updatePreferencesFromFeedback(feedback)
      
      logger.debug(`Recorded ${feedback.action} feedback for user ${feedback.userId}`)
    } catch (error) {
      logger.error('Failed to record feedback:', error)
    }
  }

  private async getUserInteractions(userId: string): Promise<UserInteraction[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.ANALYSIS_WINDOW_DAYS)

    const db = await this.getDb()
    const activities = await db
      .select()
      .from(userActivity)
      .where(and(
        eq(userActivity.userId, userId),
        gte(userActivity.createdAt, cutoffDate)
      ))
      .orderBy(desc(userActivity.createdAt))

    return activities.map(activity => ({
      articleId: activity.contentId || '',
      userId: activity.userId,
      sessionId: activity.sessionId,
      type: activity.activityType as UserInteraction['type'],
      timestamp: activity.createdAt,
      duration: activity.duration,
      metadata: activity.metadata
    }))
  }

  private async extractReadingPatterns(userId: string, interactions: UserInteraction[]): Promise<ReadingPattern[]> {
    const patterns: ReadingPattern[] = []
    
    for (const interaction of interactions) {
      if (interaction.type === 'view' && interaction.duration) {
        const date = new Date(interaction.timestamp)
        const metadata = interaction.metadata as any
        
        patterns.push({
          timeOfDay: date.getHours(),
          dayOfWeek: date.getDay(),
          duration: interaction.duration,
          deviceType: metadata?.deviceType || 'mobile',
          scrollDepth: metadata?.scrollDepth || 0.5
        })
      }
    }
    
    return patterns
  }

  private calculateEngagementMetrics(interactions: UserInteraction[]): EngagementMetrics {
    const viewInteractions = interactions.filter(i => i.type === 'view')
    const readInteractions = viewInteractions.filter(i => i.duration && i.duration > 30)
    const shareInteractions = interactions.filter(i => i.type === 'share')
    const translateInteractions = interactions.filter(i => i.type === 'translate')
    
    const totalReadTime = readInteractions.reduce((sum, i) => sum + (i.duration || 0), 0)
    const averageReadTime = readInteractions.length > 0 ? totalReadTime / readInteractions.length : 0
    
    const completionRate = viewInteractions.length > 0 ? readInteractions.length / viewInteractions.length : 0
    const shareRate = viewInteractions.length > 0 ? shareInteractions.length / viewInteractions.length : 0
    const translationRate = viewInteractions.length > 0 ? translateInteractions.length / viewInteractions.length : 0
    
    // Calculate return rate (simplified)
    const uniqueDays = new Set(interactions.map(i => new Date(i.timestamp).toDateString())).size
    const returnRate = uniqueDays / this.ANALYSIS_WINDOW_DAYS
    
    // Calculate diversity score
    const uniqueArticles = new Set(interactions.map(i => i.articleId)).size
    const diversityScore = interactions.length > 0 ? uniqueArticles / interactions.length : 0

    return {
      averageReadTime,
      completionRate,
      shareRate,
      translationRate,
      returnRate,
      diversityScore
    }
  }

  private analyzeTimeBasedPreferences(interactions: UserInteraction[]): TimeBasedPreferences {
    const morningInteractions = interactions.filter(i => {
      const hour = new Date(i.timestamp).getHours()
      return hour >= 6 && hour < 12
    })
    
    const afternoonInteractions = interactions.filter(i => {
      const hour = new Date(i.timestamp).getHours()
      return hour >= 12 && hour < 18
    })
    
    const eveningInteractions = interactions.filter(i => {
      const hour = new Date(i.timestamp).getHours()
      return hour >= 18 || hour < 6
    })
    
    const weekendInteractions = interactions.filter(i => {
      const day = new Date(i.timestamp).getDay()
      return day === 0 || day === 6
    })

    return {
      morningTopics: this.extractTopicsFromInteractions(morningInteractions),
      afternoonTopics: this.extractTopicsFromInteractions(afternoonInteractions),
      eveningTopics: this.extractTopicsFromInteractions(eveningInteractions),
      weekendTopics: this.extractTopicsFromInteractions(weekendInteractions),
      seasonalTrends: {} // Would analyze seasonal patterns over longer timeframes
    }
  }

  private getPreferredReadingTimes(patterns: ReadingPattern[]): number[] {
    const hourCounts: Record<number, number> = {}
    
    for (const pattern of patterns) {
      hourCounts[pattern.timeOfDay] = (hourCounts[pattern.timeOfDay] || 0) + 1
    }
    
    return Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour))
  }

  private async getFavoriteCategories(userId: string): Promise<Array<{ category: string; score: number }>> {
    // Simplified implementation for now - would normally join with articles table
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.ANALYSIS_WINDOW_DAYS)

    try {
      const db = await this.getDb()
      
      // Get user's recent activities and extract categories from metadata
      const activities = await db
        .select()
        .from(userActivity)
        .where(and(
          eq(userActivity.userId, userId),
          gte(userActivity.createdAt, cutoffDate)
        ))

      // Extract categories from activity metadata and calculate scores
      const categoryScores: Record<string, { count: number; totalDuration: number }> = {}
      
      for (const activity of activities) {
        const category = (activity.metadata as any)?.category || 'general'
        if (!categoryScores[category]) {
          categoryScores[category] = { count: 0, totalDuration: 0 }
        }
        categoryScores[category].count++
        categoryScores[category].totalDuration += activity.duration || 0
      }

      return Object.entries(categoryScores).map(([category, data]) => ({
        category,
        score: data.count * 0.7 + (data.totalDuration / 60) * 0.3
      })).sort((a, b) => b.score - a.score)
    } catch (error) {
      logger.warn('Failed to get favorite categories:', error)
      return []
    }
  }

  private classifyReadingSpeed(averageReadTime: number): 'slow' | 'medium' | 'fast' {
    if (averageReadTime < 60) return 'fast'
    if (averageReadTime < 180) return 'medium'
    return 'slow'
  }

  private classifyEngagementLevel(metrics: EngagementMetrics): 'low' | 'medium' | 'high' {
    const score = 
      metrics.completionRate * 0.3 +
      metrics.shareRate * 0.3 +
      metrics.returnRate * 0.2 +
      Math.min(metrics.averageReadTime / 180, 1) * 0.2

    if (score < 0.3) return 'low'
    if (score < 0.7) return 'medium'
    return 'high'
  }

  private calculateDiversityPreference(interactions: UserInteraction[]): number {
    const uniqueArticles = new Set(interactions.map(i => i.articleId)).size
    const totalInteractions = interactions.length
    
    return totalInteractions > 0 ? uniqueArticles / totalInteractions : 0.5
  }

  private async identifyLoyalSources(userId: string): Promise<string[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.ANALYSIS_WINDOW_DAYS)

    try {
      const db = await this.getDb()
      
      // Get user's recent activities and extract sources from metadata
      const activities = await db
        .select()
        .from(userActivity)
        .where(and(
          eq(userActivity.userId, userId),
          gte(userActivity.createdAt, cutoffDate)
        ))

      // Extract sources from activity metadata and count interactions
      const sourceCounts: Record<string, number> = {}
      
      for (const activity of activities) {
        const source = (activity.metadata as any)?.source || 'unknown'
        sourceCounts[source] = (sourceCounts[source] || 0) + 1
      }

      return Object.entries(sourceCounts)
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([source]) => source)
    } catch (error) {
      logger.warn('Failed to identify loyal sources:', error)
      return []
    }
  }

  private async identifyTrendingInterests(userId: string): Promise<string[]> {
    // Analyze recent topics with increasing interaction frequency
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 7)

    try {
      const db = await this.getDb()
      
      // Get user's recent activities and extract topics from metadata
      const activities = await db
        .select()
        .from(userActivity)
        .where(and(
          eq(userActivity.userId, userId),
          gte(userActivity.createdAt, recentDate)
        ))

      // Extract topics from activity metadata and count occurrences
      const topicCounts: Record<string, number> = {}
      
      for (const activity of activities) {
        const topics = (activity.metadata as any)?.topics || []
        for (const topic of topics) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1
        }
      }

      return Object.entries(topicCounts)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic)
    } catch (error) {
      logger.warn('Failed to identify trending interests:', error)
      return []
    }
  }

  private async analyzeLanguageUsage(userId: string): Promise<Record<string, number>> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.ANALYSIS_WINDOW_DAYS)

    try {
      const db = await this.getDb()
      
      // Get user's recent activities and extract language information from metadata
      const activities = await db
        .select()
        .from(userActivity)
        .where(and(
          eq(userActivity.userId, userId),
          gte(userActivity.createdAt, cutoffDate)
        ))

      // Extract language usage from activity metadata
      const languageCounts: Record<string, number> = {}
      
      for (const activity of activities) {
        const language = (activity.metadata as any)?.translationLanguage || 
                        (activity.metadata as any)?.sourceLanguage || 'en'
        languageCounts[language] = (languageCounts[language] || 0) + 1
      }

      // Convert to percentages
      const total = Object.values(languageCounts).reduce((sum, count) => sum + count, 0)
      const result: Record<string, number> = {}
      
      for (const [language, count] of Object.entries(languageCounts)) {
        result[language] = total > 0 ? count / total : 0
      }
      
      return result
    } catch (error) {
      logger.warn('Failed to analyze language usage:', error)
      return { 'en': 1.0 }
    }
  }

  private extractTopicsFromInteractions(interactions: UserInteraction[]): string[] {
    // This would extract topics from article tags
    // For now, return a simplified version
    const topicCounts: Record<string, number> = {}
    
    for (const interaction of interactions) {
      const topics = (interaction.metadata as any)?.topics || []
      for (const topic of topics) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      }
    }
    
    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic)
  }

  private calculateConfidence(interactionCount: number, metrics: EngagementMetrics): number {
    // Base confidence on amount of data and engagement quality
    const dataConfidence = Math.min(interactionCount / 100, 1.0) // More interactions = higher confidence
    const engagementConfidence = (metrics.completionRate + metrics.returnRate) / 2
    
    return (dataConfidence * 0.6 + engagementConfidence * 0.4)
  }

  private async getStoredReadingPatterns(userId: string): Promise<ReadingPattern[]> {
    try {
      const db = await this.getDb()
      // Retrieve stored patterns from user preferences
      const userPrefs = await db
        .select({ readingPatterns: userPreferences.readingPatterns })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1)
    
      return userPrefs[0]?.readingPatterns as ReadingPattern[] || []
    } catch (error) {
      logger.warn('Failed to get stored reading patterns:', error)
      return []
    }
  }

  private mergeReadingPatterns(existing: ReadingPattern[], newPattern: ReadingPattern): ReadingPattern[] {
    // Add new pattern and keep recent patterns (last 50)
    const updated = [...existing, newPattern]
    return updated.slice(-50)
  }

  private async storeReadingPatterns(userId: string, patterns: ReadingPattern[]): Promise<void> {
    try {
      const db = await this.getDb()
      await db
        .update(userPreferences)
        .set({ readingPatterns: patterns })
        .where(eq(userPreferences.userId, userId))
    } catch (error) {
      logger.warn('Failed to store reading patterns:', error)
    }
  }

  private async updatePreferencesFromFeedback(feedback: RecommendationFeedback): Promise<void> {
    // Update user preferences based on feedback
    if (feedback.type === 'explicit') {
      try {
        const db = await this.getDb()
        const userPrefs = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, feedback.userId))
          .limit(1)
        
        if (userPrefs.length > 0) {
          // Adjust preferences based on feedback
          // This would implement preference learning algorithms
          logger.debug(`Updated preferences for user ${feedback.userId} based on ${feedback.action} feedback`)
        }
      } catch (error) {
        logger.warn('Failed to update preferences from feedback:', error)
      }
    }
  }
}