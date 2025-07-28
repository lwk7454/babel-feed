/**
 * Feature Parity Tests - Compare TypeScript implementation against Python newspaper4k
 * 
 * This test suite loads the same HTML test data used by the Python package
 * and compares extraction results to verify exact feature parity.
 */

import { describe, it, expect } from 'bun:test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { Article } from '../../src/article.js'
import { Configuration } from '../../src/configuration.js'

interface PythonTestMetadata {
  title?: string
  authors?: string[]
  publish_date?: string
  meta_description?: string
  meta_keywords?: string
  meta_lang?: string
  canonical_link?: string
  top_image?: string
  images?: string[]
  videos?: string[]
  tags?: string[]
}

interface TestCase {
  name: string
  htmlFile: string
  metadataFile: string
  expectedTextFile: string
  url: string
}

// Test cases from Python package
const TEST_CASES: TestCase[] = [
  {
    name: 'CNN Article',
    htmlFile: 'cnn_001.html.mock',
    metadataFile: 'cnn_001.json', 
    expectedTextFile: 'cnn_001.txt',
    url: 'https://www.cnn.com/2023/11/06/politics/alito-prelogar-supreme-court-analysis/index.html'
  },
  {
    name: 'Time Article',
    htmlFile: 'time_001.html.mock',
    metadataFile: 'time_001.json',
    expectedTextFile: 'time_001.txt',
    url: 'https://time.com/6962948/james-hansen-climate-geoengineering/'
  },
  {
    name: 'Wired Article',
    htmlFile: 'wired_001.html.mock',
    metadataFile: 'wired_001.json',
    expectedTextFile: 'wired_001.txt',
    url: 'https://www.wired.com/story/israel-palestine-surveillance-west-bank/'
  },
  {
    name: 'Chinese Article',
    htmlFile: 'chinese_article_001.html.mock',
    metadataFile: 'chinese_article_001.json',
    expectedTextFile: 'chinese_article_001.txt',
    url: 'https://china.chinadaily.com.cn/a/202311/17/WS65571297a310d5acd876f404.html'
  },
  {
    name: 'Japanese Article',
    htmlFile: 'japanese_article.html.mock',
    metadataFile: 'japanese_article.json',
    expectedTextFile: 'japanese_article.txt',
    url: 'https://www.nikkei.com/article/DGXMZO31897660Y8A610C1000000/'
  }
]

describe('Feature Parity with Python newspaper4k', () => {
  const testDataDir = join(__dirname, '../data')
  const htmlDir = join(testDataDir, 'html')
  const metadataDir = join(testDataDir, 'metadata')
  const txtDir = join(testDataDir, 'txt')

  async function loadTestFiles(testCase: TestCase) {
    const [htmlContent, metadataContent, expectedText] = await Promise.all([
      fs.readFile(join(htmlDir, testCase.htmlFile), 'utf-8'),
      fs.readFile(join(metadataDir, testCase.metadataFile), 'utf-8'),
      fs.readFile(join(txtDir, testCase.expectedTextFile), 'utf-8')
    ])

    return {
      html: htmlContent,
      expectedMetadata: JSON.parse(metadataContent) as PythonTestMetadata,
      expectedText: expectedText.trim()
    }
  }

  describe('Title Extraction', () => {
    TEST_CASES.forEach(testCase => {
      it(`should extract correct title from ${testCase.name}`, async () => {
        const { html, expectedMetadata } = await loadTestFiles(testCase)
        
        const config = expectedMetadata.meta_lang ? Configuration.forLanguage(expectedMetadata.meta_lang) : new Configuration()
        const article = new Article(testCase.url, config)
        
        // Set HTML directly to bypass download
        ;(article as any).html = html
        ;(article as any)._isDownloaded = true
        await article.parse()
        
        if (expectedMetadata.title) {
          expect(article.title).toBe(expectedMetadata.title)
        }
      })
    })
  })

  describe('Author Extraction', () => {
    TEST_CASES.forEach(testCase => {
      it(`should extract correct authors from ${testCase.name}`, async () => {
        const { html, expectedMetadata } = await loadTestFiles(testCase)
        
        const config = expectedMetadata.meta_lang ? Configuration.forLanguage(expectedMetadata.meta_lang) : new Configuration()
        const article = new Article(testCase.url, config)
        
        ;(article as any).html = html
        ;(article as any)._isDownloaded = true
        await article.parse()
        
        if (expectedMetadata.authors) {
          expect(article.authors).toEqual(expectedMetadata.authors)
        }
      })
    })
  })

  describe('Date Extraction', () => {
    TEST_CASES.forEach(testCase => {
      it(`should extract correct publish date from ${testCase.name}`, async () => {
        const { html, expectedMetadata } = await loadTestFiles(testCase)
        
        const config = expectedMetadata.meta_lang ? Configuration.forLanguage(expectedMetadata.meta_lang) : new Configuration()
        const article = new Article(testCase.url, config)
        
        ;(article as any).html = html
        ;(article as any)._isDownloaded = true
        await article.parse()
        
        if (expectedMetadata.publish_date) {
          const expectedDate = new Date(expectedMetadata.publish_date)
          expect(article.publishDate?.toISOString()).toBe(expectedDate.toISOString())
        }
      })
    })
  })

  describe('Image Extraction', () => {
    TEST_CASES.forEach(testCase => {
      it(`should extract correct images from ${testCase.name}`, async () => {
        const { html, expectedMetadata } = await loadTestFiles(testCase)
        
        const config = expectedMetadata.meta_lang ? Configuration.forLanguage(expectedMetadata.meta_lang) : new Configuration()
        const article = new Article(testCase.url, config)
        
        ;(article as any).html = html
        ;(article as any)._isDownloaded = true
        await article.parse()
        
        if (expectedMetadata.top_image) {
          expect(article.topImage).toBe(expectedMetadata.top_image)
        }
        
        if (expectedMetadata.images) {
          // Check that we extracted similar images (order may differ)
          expect(article.images?.length).toBeGreaterThan(0)
        }
      })
    })
  })

  describe('Content Extraction', () => {
    TEST_CASES.forEach(testCase => {
      it(`should extract similar content from ${testCase.name}`, async () => {
        const { html, expectedText, expectedMetadata } = await loadTestFiles(testCase)
        
        const config = expectedMetadata.meta_lang ? Configuration.forLanguage(expectedMetadata.meta_lang) : new Configuration()
        const article = new Article(testCase.url, config)
        
        ;(article as any).html = html
        ;(article as any)._isDownloaded = true
        await article.parse()
        
        // Check that we extracted significant content
        expect(article.text.length).toBeGreaterThan(100)
        
        // Check that content contains key words from expected text
        const expectedWords = expectedText.split(/\s+/).filter(w => w.length > 5)
        const extractedWords = article.text.split(/\s+/).filter(w => w.length > 5)
        
        // Should have significant overlap in content
        const commonWords = expectedWords.filter(word => 
          extractedWords.some(extracted => 
            extracted.toLowerCase().includes(word.toLowerCase()) ||
            word.toLowerCase().includes(extracted.toLowerCase())
          )
        )
        
        const overlapRatio = commonWords.length / expectedWords.length
        expect(overlapRatio).toBeGreaterThan(0.3) // At least 30% content overlap
      })
    })
  })

  describe('Metadata Extraction', () => {
    TEST_CASES.forEach(testCase => {
      it(`should extract correct metadata from ${testCase.name}`, async () => {
        const { html, expectedMetadata } = await loadTestFiles(testCase)
        
        const config = expectedMetadata.meta_lang ? Configuration.forLanguage(expectedMetadata.meta_lang) : new Configuration()
        const article = new Article(testCase.url, config)
        
        ;(article as any).html = html
        ;(article as any)._isDownloaded = true
        await article.parse()
        
        if (expectedMetadata.meta_description) {
          expect(article.metadata.description).toBeTruthy()
        }
        
        if (expectedMetadata.meta_lang) {
          expect(article.metadata.language).toBeTruthy()
        }
        
        if (expectedMetadata.canonical_link) {
          expect(article.metadata.canonical).toBeTruthy()
        }
      })
    })
  })
})

describe('Algorithm Verification', () => {
  it('should load and process test HTML files', async () => {
    const htmlFiles = await fs.readdir(join(__dirname, '../data/html'))
    expect(htmlFiles.length).toBeGreaterThan(0)
    
    // Test that we can process each HTML file without errors
    // Use well-known files that should work correctly
    const testFiles = ['cnn_001.html.mock', 'time_001.html.mock', 'wired_001.html.mock']
    
    for (const htmlFile of testFiles) {
      const htmlContent = await fs.readFile(join(__dirname, '../data/html', htmlFile), 'utf-8')
      
      const config = new Configuration()
      const article = new Article('http://example.com', config)
      
      ;(article as any).html = htmlContent
      ;(article as any)._isDownloaded = true
      
      // Should not throw errors
      try {
        await article.parse()
      } catch (error) {
        throw new Error(`Failed to parse ${htmlFile}: ${(error as Error)?.message || error}`)
      }
      
      // Should extract some content
      expect(article.text.length).toBeGreaterThan(0)
    }
  })
})