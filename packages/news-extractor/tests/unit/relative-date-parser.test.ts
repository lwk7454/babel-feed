/**
 * RelativeDateParser tests
 */

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test'
import { RelativeDateParser } from '../../src/extractors/relative-date-parser.js'
import { setupTestDatabase } from '@babel-feed/pgdb'

beforeAll(async () => {
  await setupTestDatabase()
})

describe('RelativeDateParser', () => {
  let parser: RelativeDateParser
  let referenceTime: Date

  beforeEach(() => {
    // Use a fixed reference time for consistent testing
    referenceTime = new Date('2024-01-15T10:30:00Z') // Monday, January 15, 2024, 10:30 AM UTC
    parser = new RelativeDateParser(referenceTime)
  })

  describe('English patterns', () => {
    it('should parse "2 hours ago"', () => {
      const result = parser.parse('2 hours ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T08:30:00Z'))
      expect(result!.confidence).toBeGreaterThan(0.5)
    })

    it('should parse "30 minutes ago"', () => {
      const result = parser.parse('30 minutes ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:00:00Z'))
    })

    it('should parse "yesterday"', () => {
      const result = parser.parse('yesterday', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-14T10:30:00Z'))
      expect(result!.confidence).toBeGreaterThan(0.7) // Fixed dates have higher confidence
    })

    it('should parse "3 days ago"', () => {
      const result = parser.parse('3 days ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-12T10:30:00Z'))
    })

    it('should parse "last week"', () => {
      const result = parser.parse('last week', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-08T10:30:00Z'))
    })

    it('should parse "last month"', () => {
      const result = parser.parse('last month', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2023-12-15T10:30:00Z'))
    })

    it('should parse "a day ago"', () => {
      const result = parser.parse('a day ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-14T10:30:00Z'))
    })

    it('should parse "an hour ago"', () => {
      const result = parser.parse('an hour ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T09:30:00Z'))
    })

    it('should parse short forms like "2h ago"', () => {
      const result = parser.parse('2h ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T08:30:00Z'))
    })

    it('should parse "5min ago"', () => {
      const result = parser.parse('5min ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:25:00Z'))
    })

    it('should parse word numbers like "five minutes ago"', () => {
      const result = parser.parse('five minutes ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:25:00Z'))
    })

    it('should parse "twenty minutes ago"', () => {
      const result = parser.parse('twenty minutes ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:10:00Z'))
    })
  })

  describe('Chinese patterns', () => {
    it('should parse "2小时前"', () => {
      const result = parser.parse('2小时前', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T08:30:00Z'))
    })

    it('should parse "30分钟前"', () => {
      const result = parser.parse('30分钟前', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:00:00Z'))
    })

    it('should parse "昨天"', () => {
      const result = parser.parse('昨天', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-14T10:30:00Z'))
    })

    it('should parse "3天前"', () => {
      const result = parser.parse('3天前', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-12T10:30:00Z'))
    })

    it('should parse "上周"', () => {
      const result = parser.parse('上周', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-08T10:30:00Z'))
    })

    it('should parse "上个月"', () => {
      const result = parser.parse('上个月', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2023-12-15T10:30:00Z'))
    })

    it('should parse Chinese numbers like "五分钟前"', () => {
      const result = parser.parse('五分钟前', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:25:00Z'))
    })

    it('should parse "半小时前"', () => {
      const result = parser.parse('半小时前', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:00:00Z')) // 0.5 hours = 30 minutes
    })

    it('should parse "几天前"', () => {
      const result = parser.parse('几天前', 'zh')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-12T10:30:00Z')) // "几" defaults to 3
    })
  })

  describe('Japanese patterns', () => {
    it('should parse "2時間前"', () => {
      const result = parser.parse('2時間前', 'ja')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T08:30:00Z'))
    })

    it('should parse "30分前"', () => {
      const result = parser.parse('30分前', 'ja')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:00:00Z'))
    })

    it('should parse "昨日"', () => {
      const result = parser.parse('昨日', 'ja')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-14T10:30:00Z'))
    })

    it('should parse "3日前"', () => {
      const result = parser.parse('3日前', 'ja')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-12T10:30:00Z'))
    })

    it('should parse "先週"', () => {
      const result = parser.parse('先週', 'ja')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-08T10:30:00Z'))
    })

    it('should parse "先月"', () => {
      const result = parser.parse('先月', 'ja')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2023-12-15T10:30:00Z'))
    })

    it('should parse full-width numbers like "５分前"', () => {
      const result = parser.parse('５分前', 'ja')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T10:25:00Z'))
    })
  })

  describe('Edge cases', () => {
    it('should return null for invalid text', () => {
      expect(parser.parse('', 'en')).toBeNull()
      expect(parser.parse('random text', 'en')).toBeNull()
      expect(parser.parse('123', 'en')).toBeNull()
    })

    it('should handle case-insensitive matching', () => {
      const result = parser.parse('YESTERDAY', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-14T10:30:00Z'))
    })

    it('should handle extra whitespace', () => {
      const result = parser.parse('  2   hours   ago  ', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T08:30:00Z'))
    })

    it('should fallback to English for unknown language', () => {
      const result = parser.parse('2 hours ago', 'unknown')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2024-01-15T08:30:00Z'))
    })

    it('should handle very large numbers', () => {
      const result = parser.parse('100 years ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('1924-01-15T10:30:00Z'))
    })

    it('should reduce confidence for very old dates', () => {
      const result = parser.parse('100 years ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.confidence).toBeLessThan(0.7) // Should be penalized
    })
  })

  describe('Confidence scoring', () => {
    it('should give higher confidence to fixed dates', () => {
      const yesterday = parser.parse('yesterday', 'en')
      const twoHoursAgo = parser.parse('2 hours ago', 'en')
      
      expect(yesterday!.confidence).toBeGreaterThan(twoHoursAgo!.confidence)
    })

    it('should give higher confidence to exact numbers', () => {
      const exact = parser.parse('5 minutes ago', 'en')
      const word = parser.parse('five minutes ago', 'en')
      
      expect(exact!.confidence).toBeGreaterThan(word!.confidence)
    })

    it('should penalize very old dates', () => {
      const recent = parser.parse('2 hours ago', 'en')
      const old = parser.parse('100 days ago', 'en')
      
      expect(recent!.confidence).toBeGreaterThan(old!.confidence)
    })
  })

  describe('Number parsing', () => {
    it('should handle various number formats', () => {
      const tests = [
        { input: '1 hour ago', expected: new Date('2024-01-15T09:30:00Z') },
        { input: 'one hour ago', expected: new Date('2024-01-15T09:30:00Z') },
        { input: 'a hour ago', expected: new Date('2024-01-15T09:30:00Z') },
        { input: 'an hour ago', expected: new Date('2024-01-15T09:30:00Z') },
        { input: 'twelve hours ago', expected: new Date('2024-01-14T22:30:00Z') },
        { input: 'twenty minutes ago', expected: new Date('2024-01-15T10:10:00Z') }
      ]

      tests.forEach(({ input, expected }) => {
        const result = parser.parse(input, 'en')
        expect(result).toBeTruthy()
        expect(result!.date).toEqual(expected)
      })
    })
  })

  describe('Utility methods', () => {
    it('should return supported languages', () => {
      const languages = parser.getSupportedLanguages()
      expect(languages).toContain('en')
      expect(languages).toContain('zh')
      expect(languages).toContain('ja')
    })

    it('should allow setting custom reference time', () => {
      const newTime = new Date('2023-06-01T12:00:00Z')
      parser.setReferenceTime(newTime)
      
      const result = parser.parse('1 hour ago', 'en')
      expect(result).toBeTruthy()
      expect(result!.date).toEqual(new Date('2023-06-01T11:00:00Z'))
    })
  })
})