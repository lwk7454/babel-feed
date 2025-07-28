import { describe, it, beforeEach, expect } from 'bun:test'
import { clearTestData } from '@babel-feed/pgdb'
import { createTestTimers } from '@babel-feed/utils'
import { SourceCRUDService, type SourceQueryOptions, type BulkSourceOperation } from '../modules/source-manager/source-crud'
import { AggregatorError, ValidationError } from '../modules/common/types'


describe('SourceCRUDService', () => {
  const timer = createTestTimers()
  let service: SourceCRUDService

  beforeEach(async () => {
    await clearTestData()
    timer.reset()
    service = new SourceCRUDService()
    await service.initialize()
  })

  describe('Source Creation', () => {
    it('should create a new source successfully', async () => {
      const sourceData = {
        name: 'Test News Source',
        slug: 'test-news-source',
        url: 'https://example.com/rss',
        sourceType: 'rss' as const,
        language: 'en',
        category: 'news',
        tags: ['test', 'news'],
        enabled: true,
        pollingInterval: 300000,
        reliability: 95,
        priority: 8,
        metadata: { test: true }
      }

      const created = await service.createSource(sourceData)

      expect(created).toBeDefined()
      expect(created.id).toBeDefined()
      expect(created.name).toBe(sourceData.name)
      expect(created.slug).toBe(sourceData.slug)
      expect(created.url).toBe(sourceData.url)
      expect(created.sourceType).toBe(sourceData.sourceType)
      expect(created.language).toBe(sourceData.language)
      expect(created.category).toBe(sourceData.category)
      expect(created.tags).toEqual(sourceData.tags)
      expect(created.enabled).toBe(sourceData.enabled)
      expect(created.pollingInterval).toBe(sourceData.pollingInterval)
      expect(created.reliability).toBe(sourceData.reliability)
      expect(created.priority).toBe(sourceData.priority)
      expect(created.metadata).toEqual(sourceData.metadata)
      expect(created.errorCount).toBe(0)
      expect(created.successCount).toBe(0)
      expect(created.createdAt).toBeDefined()
      expect(created.updatedAt).toBeDefined()
    })

    it('should validate source data and throw validation errors', async () => {
      const invalidSourceData = {
        name: '',
        slug: 'INVALID-SLUG!',
        url: 'not-a-url',
        sourceType: 'invalid' as any,
        language: 'invalid',
        category: 'news',
        tags: [],
        enabled: true,
        pollingInterval: 30000, // Too low
        reliability: 150, // Too high
        priority: 15, // Too high
        metadata: {}
      }

      await expect(service.createSource(invalidSourceData))
        .rejects.toThrow(ValidationError)
    })

    it('should prevent duplicate slugs', async () => {
      const sourceData = {
        name: 'Test News Source',
        slug: 'test-news-source',
        url: 'https://example.com/rss',
        sourceType: 'rss' as const,
        language: 'en',
        category: 'news',
        tags: [],
        enabled: true,
        pollingInterval: 300000,
        reliability: 95,
        priority: 8,
        metadata: {}
      }

      await service.createSource(sourceData)

      // Try to create another with same slug
      const duplicateData = { ...sourceData, name: 'Different Name' }
      await expect(service.createSource(duplicateData))
        .rejects.toThrow(ValidationError)
    })
  })

  describe('Source Retrieval', () => {
    let testSource: any

    beforeEach(async () => {
      testSource = await service.createSource({
        name: 'Test Source',
        slug: 'test-source',
        url: 'https://test.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'tech',
        tags: ['technology'],
        enabled: true,
        pollingInterval: 300000,
        reliability: 90,
        priority: 5,
        metadata: { region: 'global' }
      })
    })

    it('should retrieve source by ID', async () => {
      const retrieved = await service.getSourceById(testSource.id)
      
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(testSource.id)
      expect(retrieved!.name).toBe(testSource.name)
    })

    it('should retrieve source by slug', async () => {
      const retrieved = await service.getSourceBySlug(testSource.slug)
      
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(testSource.id)
      expect(retrieved!.slug).toBe(testSource.slug)
    })

    it('should return null for non-existent source', async () => {
      const retrieved = await service.getSourceById('non-existent-id')
      expect(retrieved).toBeNull()
    })

    it('should get all sources', async () => {
      const sources = await service.getAllSources()
      
      expect(sources).toBeDefined()
      expect(sources.length).toBe(1)
      expect(sources[0].id).toBe(testSource.id)
    })
  })

  describe('Source Querying', () => {
    beforeEach(async () => {
      // Create multiple test sources
      await service.createSource({
        name: 'English Tech Source',
        slug: 'english-tech',
        url: 'https://tech-en.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'technology',
        tags: ['tech'],
        enabled: true,
        pollingInterval: 300000,
        reliability: 95,
        priority: 8,
        metadata: {}
      })

      await service.createSource({
        name: 'Chinese News Source',
        slug: 'chinese-news',
        url: 'https://news-zh.com/rss',
        sourceType: 'rss',
        language: 'zh-CN',
        category: 'news',
        tags: ['news'],
        enabled: true,
        pollingInterval: 300000,
        reliability: 88,
        priority: 7,
        metadata: {}
      })

      await service.createSource({
        name: 'Disabled Source',
        slug: 'disabled-source',
        url: 'https://disabled.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'news',
        tags: [],
        enabled: false,
        pollingInterval: 300000,
        reliability: 70,
        priority: 3,
        metadata: {}
      })
    })

    it('should query sources by language', async () => {
      const { sources, total } = await service.querySources({ language: 'en' })
      
      expect(total).toBe(2)
      expect(sources.length).toBe(2)
      expect(sources.every(s => s.language === 'en')).toBe(true)
    })

    it('should query sources by category', async () => {
      const { sources, total } = await service.querySources({ category: 'technology' })
      
      expect(total).toBe(1)
      expect(sources.length).toBe(1)
      expect(sources[0].category).toBe('technology')
    })

    it('should query enabled sources only', async () => {
      const { sources, total } = await service.querySources({ enabled: true })
      
      expect(total).toBe(2)
      expect(sources.length).toBe(2)
      expect(sources.every(s => s.enabled)).toBe(true)
    })

    it('should search sources by name and URL', async () => {
      const { sources, total } = await service.querySources({ search: 'tech' })
      
      expect(total).toBe(1)
      expect(sources.length).toBe(1)
      expect(sources[0].name.toLowerCase()).toContain('tech')
    })

    it('should support pagination', async () => {
      const { sources: page1, total } = await service.querySources({ limit: 2, offset: 0 })
      const { sources: page2 } = await service.querySources({ limit: 2, offset: 2 })
      
      expect(total).toBe(3)
      expect(page1.length).toBe(2)
      expect(page2.length).toBe(1)
      expect(page1[0].id).not.toBe(page2[0].id)
    })

    it('should support sorting', async () => {
      const { sources } = await service.querySources({ 
        sortBy: 'reliability', 
        sortOrder: 'desc' 
      })
      
      expect(sources.length).toBe(3)
      expect(sources[0].reliability).toBeGreaterThanOrEqual(sources[1].reliability)
      expect(sources[1].reliability).toBeGreaterThanOrEqual(sources[2].reliability)
    })
  })

  describe('Source Updates', () => {
    let testSource: any

    beforeEach(async () => {
      testSource = await service.createSource({
        name: 'Original Name',
        slug: 'original-slug',
        url: 'https://original.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'news',
        tags: ['original'],
        enabled: true,
        pollingInterval: 300000,
        reliability: 80,
        priority: 5,
        metadata: { original: true }
      })
    })

    it('should update source successfully', async () => {
      const updates = {
        name: 'Updated Name',
        reliability: 95,
        priority: 8,
        metadata: { updated: true }
      }

      const updated = await service.updateSource(testSource.id, updates)

      expect(updated.name).toBe(updates.name)
      expect(updated.reliability).toBe(updates.reliability)
      expect(updated.priority).toBe(updates.priority)
      expect(updated.metadata).toEqual(updates.metadata)
      expect(updated.updatedAt).toBeDefined()
      expect(updated.id).toBe(testSource.id)
    })

    it('should validate updates and prevent conflicts', async () => {
      const anotherSource = await service.createSource({
        name: 'Another Source',
        slug: 'another-slug',
        url: 'https://another.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'news',
        tags: [],
        enabled: true,
        pollingInterval: 300000,
        reliability: 80,
        priority: 5,
        metadata: {}
      })

      // Try to update with existing slug
      await expect(service.updateSource(testSource.id, { slug: 'another-slug' }))
        .rejects.toThrow(ValidationError)
    })

    it('should throw error for non-existent source', async () => {
      await expect(service.updateSource('non-existent-id', { name: 'Updated' }))
        .rejects.toThrow(AggregatorError)
    })
  })

  describe('Source Deletion', () => {
    let testSource: any

    beforeEach(async () => {
      testSource = await service.createSource({
        name: 'To Be Deleted',
        slug: 'to-be-deleted',
        url: 'https://delete-me.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'news',
        tags: [],
        enabled: true,
        pollingInterval: 300000,
        reliability: 80,
        priority: 5,
        metadata: {}
      })
    })

    it('should delete source successfully', async () => {
      await service.deleteSource(testSource.id)
      
      const retrieved = await service.getSourceById(testSource.id)
      expect(retrieved).toBeNull()
    })

    it('should throw error for non-existent source', async () => {
      await expect(service.deleteSource('non-existent-id'))
        .rejects.toThrow(AggregatorError)
    })
  })

  describe('Bulk Operations', () => {
    let sources: any[]

    beforeEach(async () => {
      sources = []
      for (let i = 1; i <= 3; i++) {
        const source = await service.createSource({
          name: `Source ${i}`,
          slug: `source-${i}`,
          url: `https://source${i}.com/rss`,
          sourceType: 'rss',
          language: 'en',
          category: 'news',
          tags: [],
          enabled: true,
          pollingInterval: 300000,
          reliability: 80,
          priority: i,
          metadata: {}
        })
        sources.push(source)
      }
    })

    it('should bulk update sources', async () => {
      const operation: BulkSourceOperation = {
        ids: sources.map(s => s.id),
        updates: {
          reliability: 95,
          priority: 10
        }
      }

      const updated = await service.bulkUpdateSources(operation)
      expect(updated).toBe(3)

      // Verify updates
      for (const source of sources) {
        const retrieved = await service.getSourceById(source.id)
        expect(retrieved!.reliability).toBe(95)
        expect(retrieved!.priority).toBe(10)
      }
    })

    it('should bulk delete sources', async () => {
      const ids = sources.slice(0, 2).map(s => s.id)
      const deleted = await service.bulkDeleteSources(ids)
      
      expect(deleted).toBe(2)
      
      // Verify deletions
      for (const id of ids) {
        const retrieved = await service.getSourceById(id)
        expect(retrieved).toBeNull()
      }
      
      // Verify remaining source still exists
      const remaining = await service.getSourceById(sources[2].id)
      expect(remaining).toBeDefined()
    })
  })

  describe('Source Statistics', () => {
    beforeEach(async () => {
      // Create diverse sources for statistics
      const testSources = [
        { language: 'en', category: 'tech', sourceType: 'rss', enabled: true },
        { language: 'en', category: 'news', sourceType: 'rss', enabled: true },
        { language: 'zh-CN', category: 'tech', sourceType: 'api', enabled: true },
        { language: 'zh-CN', category: 'news', sourceType: 'rss', enabled: false }
      ]

      for (let i = 0; i < testSources.length; i++) {
        const template = testSources[i]
        await service.createSource({
          name: `Test Source ${i + 1}`,
          slug: `test-source-${i + 1}`,
          url: `https://test${i + 1}.com/rss`,
          sourceType: template.sourceType as any,
          language: template.language,
          category: template.category,
          tags: [],
          enabled: template.enabled,
          pollingInterval: 300000,
          reliability: 80,
          priority: 5,
          metadata: {}
        })
      }
    })

    it('should generate source statistics', async () => {
      const stats = await service.getSourceStats()

      expect(stats.total).toBe(4)
      expect(stats.enabled).toBe(3)
      expect(stats.disabled).toBe(1)
      
      expect(stats.byLanguage['en']).toBe(2)
      expect(stats.byLanguage['zh-CN']).toBe(2)
      
      expect(stats.byCategory['tech']).toBe(2)
      expect(stats.byCategory['news']).toBe(2)
      
      expect(stats.bySourceType['rss']).toBe(3)
      expect(stats.bySourceType['api']).toBe(1)
    })
  })

  describe('Helper Methods', () => {
    it('should get sources by language', async () => {
      await service.createSource({
        name: 'English Source',
        slug: 'english-source',
        url: 'https://english.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'news',
        tags: [],
        enabled: true,
        pollingInterval: 300000,
        reliability: 80,
        priority: 5,
        metadata: {}
      })

      const sources = await service.getSourcesByLanguage('en')
      expect(sources.length).toBe(1)
      expect(sources[0].language).toBe('en')
      expect(sources[0].enabled).toBe(true)
    })

    it('should get sources by category', async () => {
      await service.createSource({
        name: 'Tech Source',
        slug: 'tech-source',
        url: 'https://tech.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'technology',
        tags: [],
        enabled: true,
        pollingInterval: 300000,
        reliability: 80,
        priority: 5,
        metadata: {}
      })

      const sources = await service.getSourcesByCategory('technology')
      expect(sources.length).toBe(1)
      expect(sources[0].category).toBe('technology')
      expect(sources[0].enabled).toBe(true)
    })

    it('should get enabled sources only', async () => {
      await service.createSource({
        name: 'Enabled Source',
        slug: 'enabled-source',
        url: 'https://enabled.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'news',
        tags: [],
        enabled: true,
        pollingInterval: 300000,
        reliability: 80,
        priority: 5,
        metadata: {}
      })

      await service.createSource({
        name: 'Disabled Source',
        slug: 'disabled-source',
        url: 'https://disabled.com/rss',
        sourceType: 'rss',
        language: 'en',
        category: 'news',
        tags: [],
        enabled: false,
        pollingInterval: 300000,
        reliability: 80,
        priority: 5,
        metadata: {}
      })

      const sources = await service.getEnabledSources()
      expect(sources.length).toBe(1)
      expect(sources.every(s => s.enabled)).toBe(true)
    })
  })
})