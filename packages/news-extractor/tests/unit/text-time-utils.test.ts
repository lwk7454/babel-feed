/**
 * Tests for time-related text processing utilities
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { extractTimePhrases, normalizeTimeExpression, hasRelativeTimeExpression } from '../../src/text.js'
import { setupTestDatabase } from '@babel-feed/pgdb'

beforeAll(async () => {
  await setupTestDatabase()
})

describe('Time text processing utilities', () => {
  describe('extractTimePhrases', () => {
    it('should extract time phrases from English text', () => {
      const text = 'This article was published 2 hours ago. It talks about recent events. The news happened yesterday.'
      const phrases = extractTimePhrases(text, 'en')
      
      expect(phrases.length).toBeGreaterThan(0)
      expect(phrases.some(phrase => phrase.includes('ago'))).toBe(true)
      expect(phrases.some(phrase => phrase.includes('yesterday'))).toBe(true)
    })

    it('should extract time phrases from Chinese text', () => {
      const text = '这篇文章是2小时前发布的。它讨论了最近的事件。新闻是昨天发生的。'
      const phrases = extractTimePhrases(text, 'zh')
      
      expect(phrases).toHaveLength(3)
      expect(phrases[0]).toContain('2小时前')
      expect(phrases[1]).toContain('最近')
      expect(phrases[2]).toContain('昨天')
    })

    it('should extract time phrases from Japanese text', () => {
      const text = 'この記事は2時間前に公開されました。最近の出来事について話しています。ニュースは昨日起こりました。'
      const phrases = extractTimePhrases(text, 'ja')
      
      expect(phrases).toHaveLength(3)
      expect(phrases[0]).toContain('2時間前')
      expect(phrases[1]).toContain('最近')
      expect(phrases[2]).toContain('昨日')
    })

    it('should skip very long sentences', () => {
      const longSentence = 'This is a very long sentence that exceeds the 200 character limit and should be skipped during extraction even though it contains the word ago because it is too long to be useful for date parsing and would likely contain too much noise'
      const text = `Short sentence with yesterday. ${longSentence}`
      
      const phrases = extractTimePhrases(text, 'en')
      
      expect(phrases).toHaveLength(1)
      expect(phrases[0]).toContain('yesterday')
    })

    it('should handle empty or invalid input', () => {
      expect(extractTimePhrases('', 'en')).toEqual([])
      expect(extractTimePhrases('No time keywords here', 'en')).toEqual([])
    })
  })

  describe('normalizeTimeExpression', () => {
    it('should normalize English time expressions', () => {
      const tests = [
        { input: '2 mins ago', expected: '2 minutes ago' },
        { input: '3 hrs ago', expected: '3 hours ago' },
        { input: 'a day ago', expected: '1 day ago' },
        { input: 'an hour ago', expected: '1 hour ago' },
        { input: 'half an hour ago', expected: '0.5 hour ago' },
        { input: 'couple of days ago', expected: '2 day ago' },
        { input: 'few minutes ago', expected: '3 minutes ago' },
        { input: 'several hours ago', expected: '4 hours ago' }
      ]

      tests.forEach(({ input, expected }) => {
        const result = normalizeTimeExpression(input, 'en')
        expect(result).toBe(expected)
      })
    })

    it('should normalize Chinese time expressions', () => {
      const tests = [
        { input: '2个小时前', expected: '2小时前' },
        { input: '3个星期前', expected: '3周前' },
        { input: '1星期前', expected: '1周前' },
        { input: '5个月前', expected: '5月前' }
      ]

      tests.forEach(({ input, expected }) => {
        const result = normalizeTimeExpression(input, 'zh')
        expect(result).toBe(expected)
      })
    })

    it('should normalize Japanese time expressions', () => {
      const tests = [
        { input: '2分間前', expected: '2分前' },
        { input: '3日間前', expected: '3日前' },
        { input: '1週間前', expected: '1週間前' },
        { input: '5年間前', expected: '5年前' }
      ]

      tests.forEach(({ input, expected }) => {
        const result = normalizeTimeExpression(input, 'ja')
        expect(result).toBe(expected)
      })
    })

    it('should handle case insensitivity', () => {
      const result = normalizeTimeExpression('A DAY AGO', 'en')
      expect(result).toBe('1 day ago')
    })

    it('should handle extra whitespace', () => {
      const result = normalizeTimeExpression('  2   hours   ago  ', 'en')
      expect(result).toBe('2 hours ago')
    })

    it('should handle empty input', () => {
      expect(normalizeTimeExpression('', 'en')).toBe('')
    })
  })

  describe('hasRelativeTimeExpression', () => {
    it('should detect English relative time expressions', () => {
      const positiveTests = [
        '2 hours ago',
        'yesterday',
        'last week',
        'recently',
        'five minutes ago',
        'a day ago',
        'an hour ago',
        'earlier today',
        'current situation'
      ]

      positiveTests.forEach(text => {
        expect(hasRelativeTimeExpression(text, 'en')).toBe(true)
      })
    })

    it('should detect Chinese relative time expressions', () => {
      const positiveTests = [
        '2小时前',
        '昨天',
        '上周',
        '最近',
        '五分钟前',
        '三天前',
        '现在'
      ]

      positiveTests.forEach(text => {
        expect(hasRelativeTimeExpression(text, 'zh')).toBe(true)
      })
    })

    it('should detect Japanese relative time expressions', () => {
      const positiveTests = [
        '2時間前',
        '昨日',
        '先週',
        '最近',
        '５分前',
        '3日前',
        '現在'
      ]

      positiveTests.forEach(text => {
        expect(hasRelativeTimeExpression(text, 'ja')).toBe(true)
      })
    })

    it('should not detect non-time expressions', () => {
      const negativeTests = [
        'This is just regular text',
        'No time keywords here',
        'Random numbers 123',
        'Date without time context',
        'Some other content'
      ]

      negativeTests.forEach(text => {
        expect(hasRelativeTimeExpression(text, 'en')).toBe(false)
      })
    })

    it('should handle empty input', () => {
      expect(hasRelativeTimeExpression('', 'en')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(hasRelativeTimeExpression('YESTERDAY', 'en')).toBe(true)
      expect(hasRelativeTimeExpression('YeStErDaY', 'en')).toBe(true)
    })

    it('should handle mixed content', () => {
      const text = 'This article discusses many topics but was published 2 hours ago according to the author.'
      expect(hasRelativeTimeExpression(text, 'en')).toBe(true)
    })
  })
})