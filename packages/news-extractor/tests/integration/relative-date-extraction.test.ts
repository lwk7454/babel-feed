/**
 * Integration tests for relative date extraction in DateExtractor
 */

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test'
import { DateExtractor } from '../../src/extractors/date-extractor.js'
import { Configuration } from '../../src/configuration.js'
import { load } from 'cheerio'
import { setupTestDatabase } from '@babel-feed/pgdb'

beforeAll(async () => {
  await setupTestDatabase()
})

describe('DateExtractor with Relative Date Support', () => {
  let extractor: DateExtractor
  let config: Configuration

  beforeEach(() => {
    config = new Configuration()
    extractor = new DateExtractor(config)
  })

  describe('Time element extraction', () => {
    it('should extract date from time element with relative text', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time>2 hours ago</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      // The exact date depends on when the test runs, but should be roughly 2 hours ago
      const now = new Date()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      const timeDiff = Math.abs(result!.getTime() - twoHoursAgo.getTime())
      expect(timeDiff).toBeLessThan(5 * 60 * 1000) // Within 5 minutes
    })

    it('should prefer absolute dates over relative dates', () => {
      const html = `
        <html>
          <head>
            <meta property="article:published_time" content="2024-01-15T10:30:00Z">
          </head>
          <body>
            <article>
              <h1>Test Article</h1>
              <time>2 hours ago</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date('2024-01-15T10:30:00Z'))
    })

    it('should not extract from time elements with datetime attribute', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time datetime="2024-01-15T10:30:00Z">2 hours ago</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date('2024-01-15T10:30:00Z'))
    })
  })

  describe('Date container extraction', () => {
    it('should extract from date class containers', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <div class="publish-date">yesterday</div>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const timeDiff = Math.abs(result!.getTime() - yesterday.getTime())
      expect(timeDiff).toBeLessThan(5 * 60 * 1000) // Within 5 minutes
    })

    it('should extract from various date selectors', () => {
      const selectors = [
        'date', 'published', 'timestamp', 'byline', 'article-date',
        'post-date', 'entry-date', 'time'
      ]

      selectors.forEach(selector => {
        const html = `
          <html>
            <body>
              <article>
                <h1>Test Article</h1>
                <span class="${selector}">3 hours ago</span>
                <p>Article content here</p>
              </article>
            </body>
          </html>
        `

        const $ = load(html)
        const result = extractor.parse('https://example.com/article', $)
        
        expect(result).toBeTruthy()
        const now = new Date()
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
        const timeDiff = Math.abs(result!.getTime() - threeHoursAgo.getTime())
        expect(timeDiff).toBeLessThan(5 * 60 * 1000) // Within 5 minutes
      })
    })

    it('should skip very long content blocks', () => {
      const longContent = 'This is a very long content block that should be skipped because it exceeds the 100 character limit for date extraction and contains many words that would not be suitable for date parsing'
      
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <div class="date">${longContent}</div>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeNull()
    })
  })

  describe('Article content extraction', () => {
    it('should extract from article content when no other dates found', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <p>This article was published 5 minutes ago.</p>
              <p>More content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
      const timeDiff = Math.abs(result!.getTime() - fiveMinutesAgo.getTime())
      expect(timeDiff).toBeLessThan(2 * 60 * 1000) // Within 2 minutes
    })

    it('should skip very long content blocks in article content', () => {
      const longContent = 'This is a very long paragraph that exceeds the 200 character limit for relative date extraction and should be skipped during the content scanning process because it is unlikely to contain useful date information'
      
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <p>${longContent}</p>
              <p>More content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeNull()
    })

    it('should skip very short content blocks', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <p>Hi</p>
              <p>More content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeNull()
    })
  })

  describe('Multi-language support', () => {
    it('should extract Chinese relative dates', () => {
      config.language = 'zh'
      const extractor = new DateExtractor(config)
      
      const html = `
        <html>
          <body>
            <article>
              <h1>测试文章</h1>
              <time>2小时前</time>
              <p>文章内容</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      const now = new Date()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      const timeDiff = Math.abs(result!.getTime() - twoHoursAgo.getTime())
      expect(timeDiff).toBeLessThan(5 * 60 * 1000) // Within 5 minutes
    })

    it('should extract Japanese relative dates', () => {
      config.language = 'ja'
      const extractor = new DateExtractor(config)
      
      const html = `
        <html>
          <body>
            <article>
              <h1>テスト記事</h1>
              <time>3時間前</time>
              <p>記事内容</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      const now = new Date()
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
      const timeDiff = Math.abs(result!.getTime() - threeHoursAgo.getTime())
      expect(timeDiff).toBeLessThan(5 * 60 * 1000) // Within 5 minutes
    })
  })

  describe('Scoring and priority', () => {
    it('should give relative dates appropriate scores', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time>2 hours ago</time>
              <div class="date">yesterday</div>
              <p>This was published 3 hours ago.</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      // Should pick the highest scoring relative date
      const now = new Date()
      const timeDiff = Math.abs(result!.getTime() - now.getTime())
      expect(timeDiff).toBeLessThan(25 * 60 * 60 * 1000) // Within 25 hours (could be any of the dates)
    })

    it('should prefer URL dates over relative dates without datetime', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time>2 hours ago</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/2024/01/15/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date(Date.UTC(2024, 0, 15))) // URL date should win over relative without datetime
    })

    it('should prefer datetime+relative over URL dates', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time datetime="2025-07-15T09:41:55.000Z">2 hours ago</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/2024/01/15/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date('2025-07-15T09:41:55.000Z')) // datetime+relative should win over URL date
    })

    it('should prefer meta tags over relative dates', () => {
      const html = `
        <html>
          <head>
            <meta name="published_date" content="2024-01-15T10:30:00Z">
          </head>
          <body>
            <article>
              <h1>Test Article</h1>
              <time>2 hours ago</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date('2024-01-15T10:30:00Z'))
    })
  })

  describe('Advanced time element patterns', () => {
    it('should extract from time elements with both datetime and relative text (ABC News style)', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <div class="meta">
                <time datetime="2025-07-15T09:41:55.000Z">49m ago</time>
                <time datetime="2025-07-15T09:41:55.000Z">49 minutes ago</time>
                <time datetime="2025-07-15T09:41:55.000Z">Tue 15 Jul 2025 at 7:41pm</time>
              </div>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date('2025-07-15T09:41:55.000Z'))
    })

    it('should prioritize time elements with datetime+relative over regular time elements and URL dates', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time datetime="2025-07-15T08:00:00.000Z">Regular time</time>
              <time datetime="2025-07-15T09:41:55.000Z">2 hours ago</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date('2025-07-15T09:41:55.000Z'))
    })

    it('should handle time elements with only datetime (no relative text)', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time datetime="2025-07-15T09:41:55.000Z">Tuesday, July 15, 2025</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date('2025-07-15T09:41:55.000Z'))
    })

    it('should handle multiple time elements and select the highest scored one', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time datetime="2025-07-15T06:00:00.000Z">6 AM</time>
              <time datetime="2025-07-15T09:41:55.000Z">3 hours ago</time>
              <time>5 minutes ago</time>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      expect(result).toEqual(new Date('2025-07-15T09:41:55.000Z'))
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle mixed content gracefully', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <div class="date">Invalid date text with 2 hours ago embedded</div>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeTruthy()
      const now = new Date()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      const timeDiff = Math.abs(result!.getTime() - twoHoursAgo.getTime())
      expect(timeDiff).toBeLessThan(5 * 60 * 1000) // Within 5 minutes
    })

    it('should handle empty or malformed content', () => {
      const html = `
        <html>
          <body>
            <article>
              <h1>Test Article</h1>
              <time></time>
              <div class="date">   </div>
              <p>Article content here</p>
            </article>
          </body>
        </html>
      `

      const $ = load(html)
      const result = extractor.parse('https://example.com/article', $)
      
      expect(result).toBeNull()
    })
  })
})