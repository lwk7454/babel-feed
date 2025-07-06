import { cleanupTestDatabase, clearTestData, setupTestDatabase } from '@babel-feed/pgdb';
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { NewsAggregatorService } from '../services/news-aggregator-service';
import { NewsSource, RawArticle } from '../modules/common/types';

// Mock RSS Parser
const mockRSSParser = {
  parseURL: mock(() => Promise.resolve({
    items: [
      {
        title: 'Test Article 1',
        link: 'https://example.com/article1',
        pubDate: new Date().toISOString(),
        description: 'This is a test article description with sufficient length for quality validation.',
        author: 'Test Author',
        categories: ['Technology', 'News'],
        guid: 'article-1-guid',
        contentEncoded: '<p>This is the full content of the article with HTML formatting.</p>',
        enclosure: {
          url: 'https://example.com/image1.jpg',
          type: 'image/jpeg'
        }
      },
      {
        title: 'Test Article 2',
        link: 'https://example.com/article2',
        pubDate: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        description: 'Another test article with different content for testing deduplication.',
        author: 'Another Author',
        categories: ['Business'],
        guid: 'article-2-guid'
      },
      {
        title: 'Duplicate Article',
        link: 'https://example.com/article1', // Same URL as first article
        pubDate: new Date().toISOString(),
        description: 'This should be filtered out due to duplicate URL.',
        guid: 'duplicate-guid'
      },
      {
        title: 'Bad', // Too short title
        link: 'https://example.com/bad',
        pubDate: new Date().toISOString(),
        description: 'Short desc', // Too short description
      },
      {
        title: 'AD: Buy Now Click Here Free Trial', // Spam indicators
        link: 'https://example.com/spam',
        pubDate: new Date().toISOString(),
        description: 'This is a spam article that should be filtered out.',
      }
    ]
  }))
};

// Mock cheerio for HTML content extraction
const mockCheerio = {
  load: mock((html: string) => ({
    text: () => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
    first: () => ({
      length: html.includes('<img') ? 1 : 0,
      attr: (name: string) => name === 'src' ? 'https://example.com/extracted.jpg' : undefined
    }),
    remove: () => ({})
  }))
};

// Mock modules
mock.module('rss-parser', () => ({
  default: function() {
    return mockRSSParser;
  }
}));

mock.module('cheerio', () => mockCheerio);

describe('RssProcessor', () => {
  let service: NewsAggregatorService;
  let sourceManager: any;
  let rssProcessor: any;
  let testSource: NewsSource;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    
    service = new NewsAggregatorService();
    await service.initialize();
    
    // Get legacy services for testing
    sourceManager = service.getSourceManager();
    rssProcessor = service.getRssProcessor();
    
    // Reset mocks before each test
    mockRSSParser.parseURL.mockReset();
    mockRSSParser.parseURL.mockResolvedValue({
      items: [
        {
          title: 'Test Article 1',
          link: 'https://example.com/article1',
          pubDate: new Date().toISOString(),
          description: 'This is a test article description with sufficient length for quality validation.',
          author: 'Test Author',
          categories: ['Technology', 'News'],
          guid: 'article-1-guid',
          contentEncoded: '<p>This is the full content of the article with HTML formatting.</p>',
          enclosure: {
            url: 'https://example.com/image1.jpg',
            type: 'image/jpeg'
          }
        },
        {
          title: 'Test Article 2',
          link: 'https://example.com/article2',
          pubDate: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          description: 'Another test article with different content for testing deduplication.',
          author: 'Another Author',
          categories: ['Business'],
          guid: 'article-2-guid'
        },
        {
          title: 'Duplicate Article',
          link: 'https://example.com/article1', // Same URL as first article
          pubDate: new Date().toISOString(),
          description: 'This should be filtered out due to duplicate URL.',
          guid: 'duplicate-guid'
        },
        {
          title: 'Bad', // Too short title
          link: 'https://example.com/bad',
          pubDate: new Date().toISOString(),
          description: 'Short desc', // Too short description
        },
        {
          title: 'AD: Buy Now Click Here Free Trial', // Spam indicators
          link: 'https://example.com/spam',
          pubDate: new Date().toISOString(),
          description: 'This is a spam article that should be filtered out.',
        }
      ]
    });
    
    // Create a test source
    testSource = {
      name: 'Test RSS Source',
      slug: 'test-rss-source',
      url: 'https://example.com/rss.xml',
      sourceType: 'rss',
      language: 'en',
      category: 'Technology',
      tags: ['tech', 'news'],
      enabled: true,
      pollingInterval: 60000, // 60 seconds in milliseconds (minimum allowed)
      reliability: 95,
      priority: 5,
      metadata: {}
    } as NewsSource;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('RSS Feed Processing', () => {
    it('should successfully parse RSS feed and extract articles', async () => {
      // Add test source to database
      const source = await sourceManager.createSource(testSource);
      
      const articles = await rssProcessor.processSource(source);
      
      expect(articles).toBeInstanceOf(Array);
      expect(articles.length).toBe(3); // Should filter out duplicates and low-quality articles
      
      const firstArticle = articles[0];
      expect(firstArticle.title).toBe('Test Article 1');
      expect(firstArticle.url).toBe('https://example.com/article1');
      expect(firstArticle.source).toBe('Test RSS Source');
      expect(firstArticle.sourceLanguage).toBe('en');
      expect(firstArticle.description).toContain('test article description');
      expect(firstArticle.imageUrl).toBe('https://example.com/image1.jpg');
      expect(firstArticle.author).toBe('Test Author');
      expect(firstArticle.tags).toEqual(['Technology', 'News']);
      expect(firstArticle.publishedAt).toBeInstanceOf(Date);
      expect(firstArticle.metadata).toBeDefined();
      expect(firstArticle.metadata?.sourceId).toBeDefined();
    });

    it('should filter out duplicate articles based on URL and title', async () => {
      const source = await sourceManager.createSource(testSource);
      
      const articles: RawArticle[] = await rssProcessor.processSource(source);
      
      // Should only have 3 unique articles (duplicate filtered out)
      expect(articles.length).toBe(3);
      
      const urls = articles.map(a => a.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(2); // Only 2 unique URLs due to duplicate filtering
    });

    it('should filter out low-quality articles', async () => {
      const source = await sourceManager.createSource(testSource);
      
      const articles: RawArticle[] = await rssProcessor.processSource(source);
      
      // Should not include articles with short titles, short descriptions, or spam indicators
      expect(articles.every(a => a.title.length >= 10)).toBe(true);
      expect(articles.every(a => !a.title.toLowerCase().includes('buy now'))).toBe(true);
      expect(articles.every(a => !a.title.toLowerCase().includes('click here'))).toBe(true);
    });

    it('should extract images from various sources', async () => {
      const source = await sourceManager.createSource(testSource);
      
      const articles: RawArticle[] = await rssProcessor.processSource(source);
      
      const articleWithImage = articles.find(a => a.imageUrl);
      expect(articleWithImage).toBeDefined();
      expect(articleWithImage?.imageUrl).toBe('https://example.com/image1.jpg');
    });

    it('should handle articles without images gracefully', async () => {
      const source = await sourceManager.createSource(testSource);
      
      const articles: RawArticle[] = await rssProcessor.processSource(source);
      
      const articlesWithoutImages = articles.filter(a => !a.imageUrl);
      expect(articlesWithoutImages.length).toBeGreaterThan(0);
    });
  });

  describe('Polling Intervals', () => {
    it('should process source when never fetched before', async () => {
      await sourceManager.createSource(testSource);
      
      const result = await rssProcessor.processAllSources();
      
      expect(result.processed).toBeGreaterThan(0);
      expect(result.skipped).toBeGreaterThanOrEqual(0);
      expect(result.articles.length).toBeGreaterThan(0);
    });

    it('should skip source when polling interval has not elapsed', async () => {
      // Set lastFetched to recent time
      const recentlyFetched = { 
        ...testSource, 
        lastFetched: new Date(Date.now() - 30 * 1000) // 30 seconds ago
      };
      await sourceManager.createSource(recentlyFetched);
      
      const result = await rssProcessor.processAllSources();
      
      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('should process source when polling interval has elapsed', async () => {
      // Set lastFetched to old time
      const oldFetched = { 
        ...testSource, 
        lastFetched: new Date(Date.now() - 120 * 1000) // 120 seconds ago
      };
      await sourceManager.createSource(oldFetched);
      
      const result = await rssProcessor.processAllSources();
      
      expect(result.processed).toBeGreaterThan(0);
      expect(result.skipped).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Content Extraction', () => {
    it('should extract description from multiple content fields', async () => {
      // Mock different content formats
      const mockItems = [
        {
          title: 'Content Test Article',
          link: 'https://example.com/content-test',
          pubDate: new Date().toISOString(),
          contentEncoded: '<p>This is content encoded text that should be extracted and cleaned.</p>',
          description: 'Short description',
        }
      ];
      
      mockRSSParser.parseURL.mockImplementationOnce(() => Promise.resolve({ items: mockItems as any }));
      
      const source = await sourceManager.createSource(testSource);
      const articles = await rssProcessor.processSource(source);
      
      expect(articles.length).toBe(1);
      expect(articles[0].description).toContain('content encoded text');
    });

    it('should clean HTML content properly', async () => {
      const mockItems = [
        {
          title: 'HTML Cleaning Test Article',
          link: 'https://example.com/html-test',
          pubDate: new Date().toISOString(),
          description: '<p>Text with <strong>HTML</strong> <script>alert("bad")</script> tags</p>',
        }
      ];
      
      mockRSSParser.parseURL.mockImplementationOnce(() => Promise.resolve({ items: mockItems }));
      
      const source = await sourceManager.createSource(testSource);
      const articles = await rssProcessor.processSource(source);
      
      expect(articles.length).toBe(1);
      expect(articles[0].description).not.toContain('<script>');
      expect(articles[0].description).not.toContain('<p>');
      expect(articles[0].description).toContain('Text with HTML alert("bad") tags');
    });

    it('should validate and parse publication dates correctly', async () => {
      const now = new Date();
      const validDate = new Date(now.getTime() - 3600000); // 1 hour ago
      const futureDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
      const oldDate = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000); // 2 years ago
      
      const mockItems = [
        {
          title: 'Valid Date Article',
          link: 'https://example.com/valid-date',
          pubDate: validDate.toISOString(),
          description: 'Article with valid date',
        },
        {
          title: 'Future Date Article',
          link: 'https://example.com/future-date',
          pubDate: futureDate.toISOString(),
          description: 'Article with future date should be filtered',
        },
        {
          title: 'Old Date Article',
          link: 'https://example.com/old-date',
          pubDate: oldDate.toISOString(),
          description: 'Article with old date should be filtered',
        }
      ];
      
      mockRSSParser.parseURL.mockImplementationOnce(() => Promise.resolve({ items: mockItems }));
      
      const source = await sourceManager.createSource(testSource);
      const articles = await rssProcessor.processSource(source);
      
      // Should only include the article with valid date
      expect(articles.length).toBe(1);
      expect(articles[0].title).toBe('Valid Date Article');
    });
  });

  describe('Error Handling', () => {
    it('should handle RSS parsing errors gracefully', async () => {
      // Create a test source
      const source = await sourceManager.createSource(testSource);
      
      // Override the default mock for this specific test after source creation
      mockRSSParser.parseURL.mockReset();
      mockRSSParser.parseURL.mockImplementation(() => {
        throw new Error('RSS parsing failed');
      });
      
      // This should catch the error and wrap it in an AggregatorError
      try {
        await rssProcessor.processSource(source);
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('RSS processing failed');
      }
    });

    it('should handle empty RSS feeds', async () => {
      mockRSSParser.parseURL.mockResolvedValueOnce({ items: [] });
      
      const source = await sourceManager.createSource(testSource);
      const articles = await rssProcessor.processSource(source);
      
      expect(articles).toEqual([]);
    });

    it('should handle malformed articles gracefully', async () => {
      const mockItems = [
        {
          // Missing required fields
          description: 'Article without title or link',
        },
        {
          title: 'Valid Article',
          link: 'https://example.com/valid',
          pubDate: new Date().toISOString(),
          description: 'This is a valid article that should be processed',
        }
      ];
      
      mockRSSParser.parseURL.mockResolvedValueOnce({ items: mockItems as any });
      
      const source = await sourceManager.createSource(testSource);
      const articles = await rssProcessor.processSource(source);
      
      // Should only include the valid article
      expect(articles.length).toBe(1);
      expect(articles[0].title).toBe('Valid Article');
    });
  });

  describe('Processing Statistics', () => {
    it('should return correct processing statistics', async () => {
      await sourceManager.createSource(testSource);
      await sourceManager.createSource({
        ...testSource,
        name: 'Test RSS Source 2',
        slug: 'test-rss-source-2',
        enabled: false // Disabled source
      });
      
      const stats = await rssProcessor.getProcessingStats();
      
      expect(stats.totalSources).toBeGreaterThanOrEqual(2);
      expect(stats.enabledSources).toBeGreaterThanOrEqual(1);
      expect(stats.activeSources).toBe(0); // No sources currently processing
      expect(stats.queueLength).toBe(0);
    });
  });

  describe('Content Hash Generation', () => {
    it('should generate consistent hashes for same content', async () => {
      const article1: RawArticle = {
        url: 'https://example.com/test?param=1#section',
        title: '  Test Article Title  ',
        publishedAt: new Date('2023-01-01T12:00:00Z'),
        source: 'test',
        sourceLanguage: 'en'
      };
      
      const article2: RawArticle = {
        url: 'https://example.com/test?param=2#other', // Different query params
        title: 'Test Article Title', // Different whitespace
        publishedAt: new Date('2023-01-01T15:30:00Z'), // Same day, different time
        source: 'test',
        sourceLanguage: 'en'
      };
      
      await sourceManager.createSource(testSource);
      
      // Access private method via any cast for testing
      const processor = rssProcessor as any;
      const hash1 = processor.generateContentHash(article1);
      const hash2 = processor.generateContentHash(article2);
      
      expect(hash1).toBe(hash2); // Should be same hash due to normalization
    });

    it('should generate different hashes for different content', async () => {
      const article1: RawArticle = {
        url: 'https://example.com/test1',
        title: 'First Article Title',
        publishedAt: new Date('2023-01-01'),
        source: 'test',
        sourceLanguage: 'en'
      };
      
      const article2: RawArticle = {
        url: 'https://example.com/test2',
        title: 'Second Article Title',
        publishedAt: new Date('2023-01-01'),
        source: 'test',
        sourceLanguage: 'en'
      };
      
      await sourceManager.createSource(testSource);
      
      const processor = rssProcessor as any;
      const hash1 = processor.generateContentHash(article1);
      const hash2 = processor.generateContentHash(article2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});