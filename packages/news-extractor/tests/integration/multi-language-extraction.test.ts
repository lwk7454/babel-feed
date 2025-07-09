/**
 * Multi-language Content Extraction Tests
 * Tests extraction with different languages and content types
 */

import { describe, it, expect } from 'bun:test'
import { Article } from '../../src/article.js'
import { Configuration } from '../../src/configuration.js'

describe('Multi-language Content Extraction', () => {
  
  describe('English Content', () => {
    it('should extract English content correctly', async () => {
      const config = Configuration.forLanguage('en')
      const article = new Article('http://example.com/english', config)
      
      const englishHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>English Test Article</title>
          <meta name="description" content="This is an English test article">
          <meta name="author" content="John Doe">
        </head>
        <body>
          <h1>English Test Article</h1>
          <div class="content">
            <p>This is the first paragraph of the English article. It contains several sentences to test extraction.</p>
            <p>This is the second paragraph. It also contains multiple sentences for testing purposes.</p>
            <p>The third paragraph provides additional content to meet minimum word count requirements for quality content detection.</p>
          </div>
        </body>
        </html>
      `
      
      article.html = englishHtml
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      expect(article.title).toBe('English Test Article')
      expect(article.text).toContain('first paragraph')
      expect(article.text).toContain('second paragraph')
      expect(article.authors).toContain('John Doe')
      expect(article.metadata.language).toBe('en')
      expect(article.metadata.description).toBe('This is an English test article')
    })
  })

  describe('Chinese Content', () => {
    it('should extract Chinese content correctly', async () => {
      const config = Configuration.forLanguage('zh')
      const article = new Article('http://example.com/chinese', config)
      
      const chineseHtml = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <title>中文测试文章</title>
          <meta name="description" content="这是一个中文测试文章">
          <meta name="author" content="张三">
        </head>
        <body>
          <h1>中文测试文章</h1>
          <div class="content">
            <p>这是中文文章的第一段。它包含了多个句子来测试提取功能。</p>
            <p>这是第二段内容。它也包含了多个句子用于测试目的。</p>
            <p>第三段提供了额外的内容来满足质量内容检测的最低字数要求。</p>
            <p>第四段继续添加更多内容以确保有足够的文本进行分析。</p>
            <p>最后一段完成了这个测试文章的内容，确保提取算法能够正确处理中文文本。</p>
          </div>
        </body>
        </html>
      `
      
      article.html = chineseHtml
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      expect(article.title).toBe('中文测试文章')
      expect(article.text).toContain('第一段')
      expect(article.text).toContain('第二段')
      expect(article.authors).toContain('张三')
      expect(article.metadata.language).toBe('zh')
      expect(article.metadata.description).toBe('这是一个中文测试文章')
    })
  })

  describe('Japanese Content', () => {
    it('should extract Japanese content correctly', async () => {
      const config = Configuration.forLanguage('ja')
      const article = new Article('http://example.com/japanese', config)
      
      const japaneseHtml = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <title>日本語テスト記事</title>
          <meta name="description" content="これは日本語のテスト記事です">
          <meta name="author" content="田中太郎">
        </head>
        <body>
          <h1>日本語テスト記事</h1>
          <div class="content">
            <p>これは日本語記事の最初の段落です。抽出機能をテストするために複数の文が含まれています。</p>
            <p>これは二番目の段落です。テスト目的で複数の文が含まれています。</p>
            <p>三番目の段落では、品質コンテンツ検出の最小単語数要件を満たすために追加コンテンツを提供します。</p>
            <p>四番目の段落では、分析に十分なテキストを確保するためにさらにコンテンツを追加します。</p>
            <p>最後の段落でこのテスト記事のコンテンツを完成させ、抽出アルゴリズムが日本語テキストを正しく処理できることを確認します。</p>
          </div>
        </body>
        </html>
      `
      
      article.html = japaneseHtml
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      expect(article.title).toBe('日本語テスト記事')
      expect(article.text).toContain('最初の段落')
      expect(article.text).toContain('二番目の段落')
      expect(article.authors).toContain('田中太郎')
      expect(article.metadata.language).toBe('ja')
      expect(article.metadata.description).toBe('これは日本語のテスト記事です')
    })
  })

  describe('Language Auto-detection', () => {
    it('should auto-detect Chinese from HTML content', async () => {
      const config = new Configuration() // Default config with auto-detection
      config.useMetaLanguage = true
      const article = new Article('http://example.com/auto-detect', config)
      
      const chineseHtml = `
        <!DOCTYPE html>
        <html lang="zh">
        <head>
          <title>自动检测测试</title>
        </head>
        <body>
          <div class="content">
            <p>这个测试用于验证语言自动检测功能是否正常工作。</p>
          </div>
        </body>
        </html>
      `
      
      article.html = chineseHtml
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      expect(article.metadata.language).toBe('zh')
    })

    it('should auto-detect Japanese from HTML content', async () => {
      const config = new Configuration() // Default config with auto-detection
      config.useMetaLanguage = true
      const article = new Article('http://example.com/auto-detect-ja', config)
      
      const japaneseHtml = `
        <!DOCTYPE html>
        <html lang="ja-JP">
        <head>
          <title>自動検出テスト</title>
        </head>
        <body>
          <div class="content">
            <p>このテストは言語自動検出機能が正常に動作するかを確認するためのものです。</p>
          </div>
        </body>
        </html>
      `
      
      article.html = japaneseHtml
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      expect(article.metadata.language).toBe('ja')
    })

    it('should fallback to configured language when no meta language found', async () => {
      const config = Configuration.forLanguage('fr')
      config.useMetaLanguage = true
      const article = new Article('http://example.com/fallback', config)
      
      const htmlWithoutLang = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fallback Test</title>
        </head>
        <body>
          <div class="content">
            <p>This content has no language indicators.</p>
          </div>
        </body>
        </html>
      `
      
      article.html = htmlWithoutLang
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      expect(article.metadata.language).toBe('fr')
    })
  })

  describe('Mixed Language Content', () => {
    it('should handle content with mixed languages', async () => {
      const config = new Configuration()
      config.useMetaLanguage = true
      const article = new Article('http://example.com/mixed', config)
      
      const mixedHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Mixed Language Test Article</title>
          <meta name="description" content="Article with mixed English and Chinese content">
        </head>
        <body>
          <h1>Mixed Language Test</h1>
          <div class="content">
            <p>This article contains both English and Chinese text. 这篇文章包含英文和中文内容。</p>
            <p>The extraction should handle this mixed content appropriately. 提取功能应该恰当地处理这种混合内容。</p>
            <p>Additional paragraph to ensure sufficient content for testing. 额外的段落以确保有足够的内容进行测试。</p>
          </div>
        </body>
        </html>
      `
      
      article.html = mixedHtml
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      expect(article.title).toBe('Mixed Language Test Article')
      expect(article.text).toContain('English and Chinese')
      expect(article.text).toContain('中文内容')
      expect(article.metadata.language).toBe('en') // Should detect from HTML lang
      expect(article.metadata.description).toContain('mixed English and Chinese')
    })
  })

  describe('Language-specific Text Processing', () => {
    it('should apply language-specific text cleaning for Chinese', async () => {
      const config = Configuration.forLanguage('zh')
      const article = new Article('http://example.com/chinese-cleaning', config)
      
      const chineseHtml = `
        <!DOCTYPE html>
        <html lang="zh">
        <head>
          <title>中文文本处理测试</title>
        </head>
        <body>
          <div class="content">
            <p>这是一个测试。   它有多余的空格。    </p>
            <p>另一个段落！！！有多个标点符号？？？</p>
          </div>
        </body>
        </html>
      `
      
      article.html = chineseHtml
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      // Chinese text should have whitespace removed and punctuation normalized
      expect(article.text).not.toContain('   ')
      expect(article.text).toContain('这是一个测试。')
      expect(article.text).toContain('另一个段落！')
    })

    it('should apply language-specific text cleaning for English', async () => {
      const config = Configuration.forLanguage('en')
      const article = new Article('http://example.com/english-cleaning', config)
      
      const englishHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>English Text Processing Test</title>
        </head>
        <body>
          <div class="content">
            <p>This is a test.   It has extra   spaces.    </p>
            <p>Another paragraph with   inconsistent spacing.</p>
          </div>
        </body>
        </html>
      `
      
      article.html = englishHtml
      ;(article as any)._isDownloaded = true
      await article.parse()
      
      // English text should normalize whitespace but preserve word separation
      expect(article.text).not.toContain('   ')
      expect(article.text).toContain('This is a test. It has extra spaces.')
      expect(article.text).toContain('Another paragraph with inconsistent spacing.')
    })
  })

  describe('Configuration Integration', () => {
    it('should respect language configuration settings', () => {
      const config = Configuration.forLanguage('zh')
      
      expect(config.language).toBe('zh')
      expect(config.useMetaLanguage).toBe(false) // Explicitly set language disables auto-detection
      expect(config.getAvailableLanguages()).toContain('zh')
      expect(config.getAvailableLanguages()).toContain('ja')
      expect(config.getAvailableLanguages()).toContain('en')
    })

    it('should allow changing language settings', () => {
      const config = new Configuration()
      
      expect(config.language).toBe('en') // Default
      expect(config.useMetaLanguage).toBe(true) // Default
      
      config.language = 'ja'
      expect(config.language).toBe('ja')
      expect(config.useMetaLanguage).toBe(false) // Should disable auto-detection
      
      config.useMetaLanguage = true
      expect(config.useMetaLanguage).toBe(true)
    })

    it('should serialize and deserialize language settings', () => {
      const originalConfig = Configuration.forLanguage('zh')
      originalConfig.useMetaLanguage = true
      
      const json = originalConfig.toJSON()
      const restoredConfig = Configuration.fromJSON(json)
      
      expect(restoredConfig.language).toBe('zh')
      expect(restoredConfig.useMetaLanguage).toBe(true)
    })
  })
})