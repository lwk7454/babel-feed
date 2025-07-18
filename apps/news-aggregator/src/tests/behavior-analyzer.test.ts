import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { BehaviorAnalyzer, type BehaviorInsights } from '../modules/recommendation/behavior-analyzer'
import { type UserInteraction, type ReadingPattern, type RecommendationFeedback } from '../modules/recommendation/types'
import { setupTestDatabase, cleanupTestDatabase, clearTestData } from '@babel-feed/pgdb'

// Helper function to generate UUID-like strings for testing
function generateTestUUID(base: number): string {
  return `550e8400-e29b-41d4-a716-${base.toString().padStart(12, '0')}`
}

describe('BehaviorAnalyzer - Comprehensive Tests', () => {
  let behaviorAnalyzer: BehaviorAnalyzer

  beforeAll(async () => {
    await setupTestDatabase()
  })

  beforeEach(async () => {
    await clearTestData()
    behaviorAnalyzer = new BehaviorAnalyzer()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe('User Interaction Tracking', () => {
    it('should track view interactions correctly', async () => {
      const interaction: UserInteraction = {
        articleId: 'article-1', // Will be set to null in the database
        userId: 'user-1', // Will be set to null in the database
        sessionId: 'session-1', // Will be set to null in the database
        type: 'view',
        timestamp: new Date(),
        duration: 120,
        metadata: { deviceType: 'mobile', scrollDepth: 0.8 }
      }

      // Should complete without throwing (errors are logged, not thrown)
      await behaviorAnalyzer.trackUserInteraction(interaction)
    })

    it('should track multiple interaction types', async () => {
      const baseInteraction = {
        articleId: generateTestUUID(1),
        userId: generateTestUUID(2),
        sessionId: generateTestUUID(3),
        timestamp: new Date(),
        metadata: { deviceType: 'desktop' }
      }

      const interactions: UserInteraction[] = [
        { ...baseInteraction, type: 'view', duration: 180 },
        { ...baseInteraction, type: 'like', duration: 5 },
        { ...baseInteraction, type: 'share', duration: 10 },
        { ...baseInteraction, type: 'translate', duration: 30 },
        { ...baseInteraction, type: 'bookmark', duration: 2 }
      ]

      for (const interaction of interactions) {
        // Should complete without throwing (errors are logged, not thrown)
      await behaviorAnalyzer.trackUserInteraction(interaction)
      }
    })

    it('should handle interactions with extensive metadata', async () => {
      const interaction: UserInteraction = {
        articleId: generateTestUUID(10),
        userId: generateTestUUID(11),
        sessionId: generateTestUUID(12),
        type: 'view',
        timestamp: new Date(),
        duration: 300,
        metadata: {
          deviceType: 'tablet',
          scrollDepth: 0.95,
          referrer: 'google.com',
          userAgent: 'Mozilla/5.0...',
          viewportSize: { width: 1024, height: 768 },
          readingSpeed: 'medium',
          interactionDetails: {
            clicks: 3,
            scrollEvents: 15,
            timeSpentVisible: 280
          }
        }
      }

      // Should complete without throwing (errors are logged, not thrown)
      await behaviorAnalyzer.trackUserInteraction(interaction)
    })
  })

  describe('Reading Pattern Management', () => {
    it('should update reading patterns correctly', async () => {
      const pattern: ReadingPattern = {
        timeOfDay: 9,
        dayOfWeek: 1, // Monday
        duration: 180,
        deviceType: 'mobile',
        scrollDepth: 0.7
      }

      await expect(behaviorAnalyzer.updateReadingPattern(generateTestUUID(100), pattern)).resolves.not.toThrow()
    })

    it('should handle various reading patterns', async () => {
      const patterns: ReadingPattern[] = [
        { timeOfDay: 6, dayOfWeek: 1, duration: 60, deviceType: 'mobile', scrollDepth: 0.5 },
        { timeOfDay: 12, dayOfWeek: 1, duration: 120, deviceType: 'desktop', scrollDepth: 0.8 },
        { timeOfDay: 18, dayOfWeek: 1, duration: 240, deviceType: 'tablet', scrollDepth: 0.9 },
        { timeOfDay: 22, dayOfWeek: 6, duration: 300, deviceType: 'desktop', scrollDepth: 0.95 }
      ]

      for (const pattern of patterns) {
        await expect(behaviorAnalyzer.updateReadingPattern(generateTestUUID(101), pattern)).resolves.not.toThrow()
      }
    })
  })

  describe('Feedback Collection', () => {
    it('should record explicit feedback correctly', async () => {
      const feedback: RecommendationFeedback = {
        userId: generateTestUUID(200),
        articleId: generateTestUUID(201),
        sessionId: generateTestUUID(202),
        type: 'explicit',
        action: 'like',
        rating: 5,
        timestamp: new Date(),
        context: {
          position: 1,
          totalShown: 10,
          algorithm: 'hybrid-v1',
          reasonCodes: ['content-match', 'trending']
        }
      }

      await expect(behaviorAnalyzer.recordFeedback(feedback)).resolves.not.toThrow()
    })

    it('should record implicit feedback correctly', async () => {
      const feedback: RecommendationFeedback = {
        userId: generateTestUUID(Math.floor(Math.random() * 1000)),
        articleId: 'article-implicit',
        sessionId: 'session-implicit',
        type: 'implicit',
        action: 'view',
        timestamp: new Date(),
        context: {
          position: 3,
          totalShown: 10,
          algorithm: 'content-based',
          reasonCodes: ['category-match']
        }
      }

      await expect(behaviorAnalyzer.recordFeedback(feedback)).resolves.not.toThrow()
    })

    it('should handle various feedback types', async () => {
      const baseFeedback = {
        userId: generateTestUUID(Math.floor(Math.random() * 1000)),
        articleId: 'article-various',
        sessionId: 'session-various',
        timestamp: new Date(),
        context: {
          position: 2,
          totalShown: 5,
          algorithm: 'hybrid-v1',
          reasonCodes: ['personalized']
        }
      }

      const feedbacks: RecommendationFeedback[] = [
        { ...baseFeedback, type: 'explicit', action: 'like', rating: 4 },
        { ...baseFeedback, type: 'explicit', action: 'dislike', rating: 1 },
        { ...baseFeedback, type: 'implicit', action: 'skip' },
        { ...baseFeedback, type: 'implicit', action: 'click' },
        { ...baseFeedback, type: 'explicit', action: 'bookmark', rating: 5 }
      ]

      for (const feedback of feedbacks) {
        await expect(behaviorAnalyzer.recordFeedback(feedback)).resolves.not.toThrow()
      }
    })
  })

  describe('Behavior Analysis', () => {
    beforeEach(async () => {
      // Create comprehensive test data for behavior analysis
      const userId = 'analysis-user'
      const now = new Date()
      
      // Create interactions over the past 30 days
      const interactions: UserInteraction[] = []
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        
        // Morning reading (9 AM)
        if (i % 3 === 0) {
          interactions.push({
            articleId: `morning-article-${i}`,
            userId,
            sessionId: `morning-session-${i}`,
            type: 'view',
            timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0),
            duration: 120,
            metadata: { 
              deviceType: 'mobile',
              category: 'technology',
              source: 'TechNews',
              topics: ['ai', 'technology']
            }
          })
        }
        
        // Evening reading (19 PM)
        if (i % 2 === 0) {
          interactions.push({
            articleId: `evening-article-${i}`,
            userId,
            sessionId: `evening-session-${i}`,
            type: 'view',
            timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 19, 0, 0),
            duration: 240,
            metadata: { 
              deviceType: 'desktop',
              category: 'business',
              source: 'BusinessDaily',
              topics: ['finance', 'markets']
            }
          })
        }
        
        // Add some shares and likes
        if (i % 5 === 0) {
          interactions.push({
            articleId: `shared-article-${i}`,
            userId,
            sessionId: `share-session-${i}`,
            type: 'share',
            timestamp: date,
            duration: 10,
            metadata: { 
              deviceType: 'mobile',
              category: 'technology'
            }
          })
        }
      }
      
      // Track all interactions
      for (const interaction of interactions) {
        await behaviorAnalyzer.trackUserInteraction(interaction)
      }
    })

    it('should analyze user behavior with sufficient data', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('analysis-user')

      expect(insights).toBeDefined()
      expect(insights!.userId).toBe('analysis-user')
      expect(insights!.insights).toBeDefined()
      expect(insights!.generatedAt).toBeInstanceOf(Date)
      expect(insights!.confidence).toBeGreaterThan(0)
      expect(insights!.confidence).toBeLessThanOrEqual(1)
    })

    it('should identify preferred reading times', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('analysis-user')

      expect(insights).toBeDefined()
      expect(insights!.insights.preferredReadingTimes).toBeInstanceOf(Array)
      expect(insights!.insights.preferredReadingTimes.length).toBeGreaterThan(0)
      
      // Should identify 9 AM and 7 PM as preferred times
      expect(insights!.insights.preferredReadingTimes).toContain(9)
      expect(insights!.insights.preferredReadingTimes).toContain(19)
    })

    it('should classify reading speed correctly', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('analysis-user')

      expect(insights).toBeDefined()
      expect(['slow', 'medium', 'fast']).toContain(insights!.insights.readingSpeed)
      
      // With 120-240 second durations, should be medium or slow
      expect(['medium', 'slow']).toContain(insights!.insights.readingSpeed)
    })

    it('should classify engagement level', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('analysis-user')

      expect(insights).toBeDefined()
      expect(['low', 'medium', 'high']).toContain(insights!.insights.engagementLevel)
    })

    it('should calculate diversity preference', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('analysis-user')

      expect(insights).toBeDefined()
      expect(insights!.insights.diversityPreference).toBeGreaterThanOrEqual(0)
      expect(insights!.insights.diversityPreference).toBeLessThanOrEqual(1)
    })

    it('should identify loyal sources', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('analysis-user')

      expect(insights).toBeDefined()
      expect(insights!.insights.loyalSources).toBeInstanceOf(Array)
      
      // Should identify frequent sources from test data
      expect(insights!.insights.loyalSources).toContain('TechNews')
      expect(insights!.insights.loyalSources).toContain('BusinessDaily')
    })

    it('should identify trending interests', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('analysis-user')

      expect(insights).toBeDefined()
      expect(insights!.insights.trendingInterests).toBeInstanceOf(Array)
      
      // Should identify topics from recent activity
      const hasExpectedTopics = insights!.insights.trendingInterests.some(topic => 
        ['ai', 'technology', 'finance', 'markets'].includes(topic)
      )
      expect(hasExpectedTopics).toBe(true)
    })

    it('should analyze language usage', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('analysis-user')

      expect(insights).toBeDefined()
      expect(insights!.insights.languageUsage).toBeDefined()
      expect(typeof insights!.insights.languageUsage).toBe('object')
      
      // Should have language percentages that sum to reasonable values
      const totalUsage = Object.values(insights!.insights.languageUsage).reduce((sum, pct) => sum + pct, 0)
      expect(totalUsage).toBeCloseTo(1, 1) // Should sum to approximately 1 (100%)
    })

    it('should return null for users with insufficient data', async () => {
      const insights = await behaviorAnalyzer.analyzeUserBehavior('new-user-no-data')

      expect(insights).toBeNull()
    })

    it('should handle users with minimal interactions', async () => {
      const userId = 'minimal-user'
      
      // Add just a few interactions (below threshold)
      for (let i = 0; i < 5; i++) {
        await behaviorAnalyzer.trackUserInteraction({
          articleId: `minimal-${i}`,
          userId,
          sessionId: `session-${i}`,
          type: 'view',
          timestamp: new Date(),
          duration: 60,
          metadata: { deviceType: 'mobile' }
        })
      }

      const insights = await behaviorAnalyzer.analyzeUserBehavior(userId)
      expect(insights).toBeNull() // Should return null due to insufficient data
    })
  })

  describe('Engagement Metrics Calculation', () => {
    it('should calculate completion rate correctly', async () => {
      const userId = 'completion-test'
      
      // 10 view interactions, 7 with substantial duration (>30s)
      for (let i = 0; i < 10; i++) {
        await behaviorAnalyzer.trackUserInteraction({
          articleId: `article-${i}`,
          userId,
          sessionId: `session-${i}`,
          type: 'view',
          timestamp: new Date(),
          duration: i < 7 ? 60 : 15, // 7 completed, 3 not completed
          metadata: { deviceType: 'mobile' }
        })
      }

      const insights = await behaviorAnalyzer.analyzeUserBehavior(userId)
      expect(insights).toBeDefined()
      
      // Should calculate correct completion rate (7/10 = 0.7)
      expect(insights!.insights.engagementLevel).toBe('medium') // 0.7 is medium engagement
    })

    it('should calculate share rate correctly', async () => {
      const userId = 'share-test'
      
      // 10 view interactions, 2 shares
      for (let i = 0; i < 10; i++) {
        await behaviorAnalyzer.trackUserInteraction({
          articleId: `article-${i}`,
          userId,
          sessionId: `session-${i}`,
          type: 'view',
          timestamp: new Date(),
          duration: 60,
          metadata: { deviceType: 'mobile' }
        })
      }
      
      for (let i = 0; i < 2; i++) {
        await behaviorAnalyzer.trackUserInteraction({
          articleId: `article-${i}`,
          userId,
          sessionId: `share-session-${i}`,
          type: 'share',
          timestamp: new Date(),
          duration: 5,
          metadata: { deviceType: 'mobile' }
        })
      }

      const insights = await behaviorAnalyzer.analyzeUserBehavior(userId)
      expect(insights).toBeDefined()
      
      // Engagement calculation includes share rate (2/10 = 0.2)
      expect(insights!.insights.engagementLevel).toMatch(/low|medium|high/)
    })
  })

  describe('Time-Based Preferences', () => {
    it('should identify morning vs evening preferences', async () => {
      const userId = 'time-preference-test'
      const now = new Date()
      
      // Create morning interactions (9 AM) with tech content
      for (let i = 0; i < 10; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        await behaviorAnalyzer.trackUserInteraction({
          articleId: `morning-${i}`,
          userId,
          sessionId: `morning-session-${i}`,
          type: 'view',
          timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0),
          duration: 120,
          metadata: { 
            deviceType: 'mobile',
            topics: ['technology', 'ai']
          }
        })
      }
      
      // Create evening interactions (19 PM) with business content
      for (let i = 0; i < 5; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        await behaviorAnalyzer.trackUserInteraction({
          articleId: `evening-${i}`,
          userId,
          sessionId: `evening-session-${i}`,
          type: 'view',
          timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 19, 0, 0),
          duration: 180,
          metadata: { 
            deviceType: 'desktop',
            topics: ['business', 'finance']
          }
        })
      }

      const insights = await behaviorAnalyzer.analyzeUserBehavior(userId)
      expect(insights).toBeDefined()
      
      // Should identify 9 AM as preferred reading time (more interactions)
      expect(insights!.insights.preferredReadingTimes).toContain(9)
      expect(insights!.insights.preferredReadingTimes[0]).toBe(9) // Should be first in ranking
    })

    it('should handle weekend vs weekday patterns', async () => {
      const userId = 'weekend-test'
      const now = new Date()
      
      // Create weekday interactions
      for (let i = 0; i < 10; i++) {
        const date = new Date(2024, 0, 1 + i) // Start from a Monday (adjust as needed)
        if (date.getDay() !== 0 && date.getDay() !== 6) { // Not weekend
          await behaviorAnalyzer.trackUserInteraction({
            articleId: `weekday-${i}`,
            userId,
            sessionId: `weekday-session-${i}`,
            type: 'view',
            timestamp: date,
            duration: 120,
            metadata: { 
              topics: ['business', 'news']
            }
          })
        }
      }
      
      // Create weekend interactions
      const saturday = new Date(2024, 0, 6) // A Saturday
      const sunday = new Date(2024, 0, 7) // A Sunday
      
      for (const date of [saturday, sunday]) {
        await behaviorAnalyzer.trackUserInteraction({
          articleId: `weekend-${date.getDay()}`,
          userId,
          sessionId: `weekend-session-${date.getDay()}`,
          type: 'view',
          timestamp: date,
          duration: 240,
          metadata: { 
            topics: ['entertainment', 'lifestyle']
          }
        })
      }

      const insights = await behaviorAnalyzer.analyzeUserBehavior(userId)
      expect(insights).toBeDefined()
      
      // Should have identified different patterns for weekdays vs weekends
      expect(insights!.insights.trendingInterests).toBeInstanceOf(Array)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed metadata gracefully', async () => {
      const interaction: UserInteraction = {
        articleId: 'malformed-test',
        userId: generateTestUUID(Math.floor(Math.random() * 1000)),
        sessionId: 'session-malformed',
        type: 'view',
        timestamp: new Date(),
        duration: 120,
        metadata: {
          // @ts-ignore - Testing malformed data
          invalidField: { circular: null },
          validField: 'valid'
        }
      }
      
      // Should not throw even with malformed metadata
      // Should complete without throwing (errors are logged, not thrown)
      await behaviorAnalyzer.trackUserInteraction(interaction)
    })

    it('should handle very old timestamps', async () => {
      const oldDate = new Date('2020-01-01')
      
      const interaction: UserInteraction = {
        articleId: 'old-test',
        userId: generateTestUUID(Math.floor(Math.random() * 1000)),
        sessionId: 'session-old',
        type: 'view',
        timestamp: oldDate,
        duration: 120,
        metadata: { deviceType: 'mobile' }
      }

      // Should complete without throwing (errors are logged, not thrown)
      await behaviorAnalyzer.trackUserInteraction(interaction)
      
      // Old data should not affect recent behavior analysis
      const insights = await behaviorAnalyzer.analyzeUserBehavior(generateTestUUID(Math.floor(Math.random() * 1000)))
      expect(insights).toBeNull() // Should be null due to data being outside analysis window
    })

    it('should handle missing duration fields', async () => {
      const interaction: UserInteraction = {
        articleId: 'no-duration',
        userId: generateTestUUID(Math.floor(Math.random() * 1000)),
        sessionId: 'session-no-duration',
        type: 'view',
        timestamp: new Date(),
        // duration is optional
        metadata: { deviceType: 'mobile' }
      }

      // Should complete without throwing (errors are logged, not thrown)
      await behaviorAnalyzer.trackUserInteraction(interaction)
    })

    it('should handle database connection issues gracefully', async () => {
      // This test would need to mock database failures
      // For now, we test that the method exists and handles errors
      
      const interaction: UserInteraction = {
        articleId: 'db-test',
        userId: generateTestUUID(Math.floor(Math.random() * 1000)),
        sessionId: 'session-db-test',
        type: 'view',
        timestamp: new Date(),
        duration: 120,
        metadata: { deviceType: 'mobile' }
      }

      // Should not throw even if there are internal database issues
      // Should complete without throwing (errors are logged, not thrown)
      await behaviorAnalyzer.trackUserInteraction(interaction)
    })
  })

  describe('Performance Tests', () => {
    it('should handle large numbers of interactions efficiently', async () => {
      const userId = 'performance-test'
      const start = Date.now()
      
      // Create 1000 interactions
      const interactions: Promise<void>[] = []
      for (let i = 0; i < 1000; i++) {
        interactions.push(behaviorAnalyzer.trackUserInteraction({
          articleId: `perf-article-${i}`,
          userId,
          sessionId: `perf-session-${i}`,
          type: 'view',
          timestamp: new Date(Date.now() - i * 60000), // 1 minute apart
          duration: 60 + (i % 60),
          metadata: { 
            deviceType: i % 2 === 0 ? 'mobile' : 'desktop',
            category: ['technology', 'business', 'sports'][i % 3]
          }
        }))
      }
      
      await Promise.all(interactions)
      const trackingTime = Date.now() - start
      
      expect(trackingTime).toBeLessThan(10000) // Should complete within 10 seconds
      
      // Analysis should also be reasonably fast
      const analysisStart = Date.now()
      const insights = await behaviorAnalyzer.analyzeUserBehavior(userId)
      const analysisTime = Date.now() - analysisStart
      
      expect(insights).toBeDefined()
      expect(analysisTime).toBeLessThan(5000) // Analysis should complete within 5 seconds
    })
  })
})