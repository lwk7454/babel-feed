/**
 * Language Detection and Processing Tests
 */

import { describe, it, expect } from 'bun:test'
import * as cheerio from 'cheerio'
import { LanguageDetector } from '../../src/languages/language-detector.js'
import { TokenizerFactory } from '../../src/languages/tokenizers/tokenizer-factory.js'
import { ChineseTokenizer } from '../../src/languages/tokenizers/chinese-tokenizer.js'
import { JapaneseTokenizer } from '../../src/languages/tokenizers/japanese-tokenizer.js'
import { DefaultTokenizer } from '../../src/languages/tokenizers/default-tokenizer.js'
import { getLanguageFromIso6391, isValidLanguage, normalizeLanguageCode } from '../../src/languages/index.js'
import { getMostLikelyLanguage, detectLanguageByCharacters } from '../../src/languages/unicode-ranges.js'
import { getTextStats, getWords, getSentences } from '../../src/text.js'

describe('Language Detection', () => {
  describe('HTML Meta Language Detection', () => {
    it('should detect language from html lang attribute', () => {
      const html = '<html lang="en"><head></head><body></body></html>'
      const $ = cheerio.load(html)
      
      const language = LanguageDetector.detectFromHtml($)
      expect(language).toBe('en')
    })

    it('should detect language from OpenGraph locale', () => {
      const html = '<html><head><meta property="og:locale" content="zh-CN"></head><body></body></html>'
      const $ = cheerio.load(html)
      
      const language = LanguageDetector.detectFromHtml($)
      expect(language).toBe('zh')
    })

    it('should detect language from content-language meta tag', () => {
      const html = '<html><head><meta http-equiv="content-language" content="ja"></head><body></body></html>'
      const $ = cheerio.load(html)
      
      const language = LanguageDetector.detectFromHtml($)
      expect(language).toBe('ja')
    })

    it('should return null when no language found', () => {
      const html = '<html><head></head><body></body></html>'
      const $ = cheerio.load(html)
      
      const language = LanguageDetector.detectFromHtml($)
      expect(language).toBe(null)
    })

    it('should handle locale codes and extract language', () => {
      const html = '<html lang="en-US"><head></head><body></body></html>'
      const $ = cheerio.load(html)
      
      const language = LanguageDetector.detectFromHtml($)
      expect(language).toBe('en')
    })
  })

  describe('Language Detection with Fallback', () => {
    it('should use detected language when meta detection enabled', () => {
      const html = '<html lang="zh"><head></head><body></body></html>'
      const $ = cheerio.load(html)
      
      const language = LanguageDetector.detectWithFallback($, 'en', true)
      expect(language).toBe('zh')
    })

    it('should use configured language when meta detection disabled', () => {
      const html = '<html lang="zh"><head></head><body></body></html>'
      const $ = cheerio.load(html)
      
      const language = LanguageDetector.detectWithFallback($, 'en', false)
      expect(language).toBe('en')
    })

    it('should fallback to configured language when no meta language found', () => {
      const html = '<html><head></head><body></body></html>'
      const $ = cheerio.load(html)
      
      const language = LanguageDetector.detectWithFallback($, 'fr', true)
      expect(language).toBe('fr')
    })
  })
})

describe('Unicode Character Detection', () => {
  it('should detect Chinese characters', () => {
    const chineseText = '这是一个中文测试文本，包含中文字符。'
    const results = detectLanguageByCharacters(chineseText)
    
    expect(results).toHaveProperty('zh')
    expect(results.zh).toBeGreaterThan(0.8) // High confidence for Chinese
  })

  it('should detect Japanese characters', () => {
    const japaneseText = 'これは日本語のテスト文です。ひらがな、カタカナ、漢字が含まれています。'
    const results = detectLanguageByCharacters(japaneseText)
    
    expect(results).toHaveProperty('ja')
    expect(results.ja).toBeGreaterThan(0.7) // High confidence for Japanese
  })

  it('should detect most likely language', () => {
    const chineseText = '这是中文'
    const japaneseText = 'これは日本語'
    const englishText = 'This is English text'
    
    expect(getMostLikelyLanguage(chineseText)).toBe('zh')
    expect(getMostLikelyLanguage(japaneseText)).toBe('ja')
    expect(getMostLikelyLanguage(englishText)).toBe(null) // No special characters
  })
})

describe('Tokenization', () => {
  describe('TokenizerFactory', () => {
    it('should return Chinese tokenizer for Chinese language', () => {
      const tokenizer = TokenizerFactory.getTokenizer('zh')
      expect(tokenizer).toBeInstanceOf(ChineseTokenizer)
      expect(tokenizer.getLanguage()).toBe('zh')
    })

    it('should return Japanese tokenizer for Japanese language', () => {
      const tokenizer = TokenizerFactory.getTokenizer('ja')
      expect(tokenizer).toBeInstanceOf(JapaneseTokenizer)
      expect(tokenizer.getLanguage()).toBe('ja')
    })

    it('should return default tokenizer for English', () => {
      const tokenizer = TokenizerFactory.getTokenizer('en')
      expect(tokenizer).toBeInstanceOf(DefaultTokenizer)
      expect(tokenizer.getLanguage()).toBe('en')
    })

    it('should cache tokenizer instances', () => {
      const tokenizer1 = TokenizerFactory.getTokenizer('en')
      const tokenizer2 = TokenizerFactory.getTokenizer('en')
      expect(tokenizer1).toBe(tokenizer2) // Same instance
    })
  })

  describe('Default Tokenizer', () => {
    it('should tokenize English text correctly', () => {
      const tokenizer = new DefaultTokenizer('en')
      const text = 'This is a test sentence with punctuation!'
      const tokens = tokenizer.tokenize(text)
      
      expect(tokens).toContain('this')
      expect(tokens).toContain('test')
      expect(tokens).toContain('sentence')
      expect(tokens).not.toContain('!') // Punctuation removed
    })

    it('should handle contractions', () => {
      const tokenizer = new DefaultTokenizer('en')
      const text = "Don't you think it's working?"
      const tokens = tokenizer.tokenize(text)
      
      expect(tokens).toContain("don't")
      expect(tokens).toContain("it's")
    })
  })

  describe('Chinese Tokenizer', () => {
    it('should tokenize Chinese text', () => {
      const tokenizer = new ChineseTokenizer()
      const text = '这是一个测试文本'
      const tokens = tokenizer.tokenize(text)
      
      expect(tokens.length).toBeGreaterThan(0)
      expect(tokens).toContain('这')
      expect(tokens).toContain('是')
    })

    it('should handle mixed Chinese and English', () => {
      const tokenizer = new ChineseTokenizer()
      const text = '这是test文本'
      const tokens = tokenizer.tokenize(text)
      
      expect(tokens).toContain('这')
      expect(tokens).toContain('test')
      expect(tokens).toContain('文')
    })
  })

  describe('Japanese Tokenizer', () => {
    it('should tokenize Japanese text', () => {
      const tokenizer = new JapaneseTokenizer()
      const text = 'これはテストです'
      const tokens = tokenizer.tokenize(text)
      
      expect(tokens.length).toBeGreaterThan(0)
      expect(tokens).toContain('こ')
      expect(tokens).toContain('テ')
    })
  })
})

describe('Language Utilities', () => {
  describe('Language Code Functions', () => {
    it('should validate language codes', () => {
      expect(isValidLanguage('en')).toBe(true)
      expect(isValidLanguage('zh')).toBe(true)
      expect(isValidLanguage('ja')).toBe(true)
      expect(isValidLanguage('xx')).toBe(false)
    })

    it('should normalize language codes', () => {
      expect(normalizeLanguageCode('EN')).toBe('en')
      expect(normalizeLanguageCode('zh-CN')).toBe('zh')
      expect(normalizeLanguageCode('ja-JP')).toBe('ja')
    })

    it('should get language names from codes', () => {
      expect(getLanguageFromIso6391('en')).toBe('English')
      expect(getLanguageFromIso6391('zh')).toBe('Chinese')
      expect(getLanguageFromIso6391('ja')).toBe('Japanese')
      expect(getLanguageFromIso6391('xx')).toBeUndefined()
    })
  })
})

describe('Multi-language Text Processing', () => {
  describe('Language-aware Text Statistics', () => {
    it('should provide accurate stats for English text', () => {
      const englishText = 'This is a test sentence. This is another sentence! And a third one?'
      const stats = getTextStats(englishText, 'en')
      
      expect(stats.wordCount).toBeGreaterThan(10)
      expect(stats.sentenceCount).toBe(3)
      expect(stats.language).toBe('en')
    })

    it('should provide accurate stats for Chinese text', () => {
      const chineseText = '这是第一句话。这是第二句话！这是第三句话？'
      const stats = getTextStats(chineseText, 'zh')
      
      expect(stats.wordCount).toBeGreaterThan(0)
      expect(stats.sentenceCount).toBe(3)
      expect(stats.language).toBe('zh')
    })

    it('should detect language automatically when not provided', () => {
      const chineseText = '这是中文文本'
      const stats = getTextStats(chineseText)
      
      expect(stats.language).toBe('zh')
    })
  })

  describe('Language-aware Word Extraction', () => {
    it('should tokenize text based on detected language', () => {
      const chineseText = '这是中文'
      const words = getWords(chineseText)
      
      expect(words.length).toBeGreaterThan(0)
      expect(words).toContain('这')
    })

    it('should use provided language for tokenization', () => {
      const text = 'This is English text'
      const words = getWords(text, 'en')
      
      expect(words).toContain('this')
      expect(words).toContain('english')
      expect(words).toContain('text')
    })
  })

  describe('Language-aware Sentence Splitting', () => {
    it('should split Chinese sentences correctly', () => {
      const chineseText = '第一句。第二句！第三句？'
      const sentences = getSentences(chineseText, 'zh')
      
      expect(sentences).toHaveLength(3)
      expect(sentences[0]).toBe('第一句')
      expect(sentences[1]).toBe('第二句')
      expect(sentences[2]).toBe('第三句')
    })

    it('should split Japanese sentences correctly', () => {
      const japaneseText = '最初の文。二番目の文！三番目の文？'
      const sentences = getSentences(japaneseText, 'ja')
      
      expect(sentences).toHaveLength(3)
      expect(sentences[0]).toBe('最初の文')
      expect(sentences[1]).toBe('二番目の文')
      expect(sentences[2]).toBe('三番目の文')
    })

    it('should split English sentences correctly', () => {
      const englishText = 'First sentence. Second sentence! Third sentence?'
      const sentences = getSentences(englishText, 'en')
      
      expect(sentences).toHaveLength(3)
      expect(sentences[0]).toBe('First sentence')
      expect(sentences[1]).toBe(' Second sentence')
      expect(sentences[2]).toBe(' Third sentence')
    })
  })
})