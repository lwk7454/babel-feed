/**
 * Python Comparison Tests - Compare TypeScript results against Python newspaper4k baseline
 */

import { describe, it, expect } from 'bun:test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { Article } from '../../src/article.js'
import { Configuration } from '../../src/configuration.js'

interface PythonBaseline {
  title: string
  authors: string[]
  publish_date: string | null
  text: string
  top_image: string
  images: string[]
}

async function loadPythonBaseline(filename: string): Promise<PythonBaseline> {
  const baselineFile = join(__dirname, '../data/python-baseline', filename)
  const content = await fs.readFile(baselineFile, 'utf-8')
  return JSON.parse(content)
}

async function loadHtmlFile(filename: string): Promise<string> {
  const htmlFile = join(__dirname, '../data/html', filename)
  return await fs.readFile(htmlFile, 'utf-8')
}

async function extractWithTypeScript(html: string): Promise<Article> {
  const config = new Configuration()
  const article = new Article('http://example.com', config)
  
  // Set HTML and download state directly to bypass download
  ;(article as any).html = html
  ;(article as any)._isDownloaded = true
  await article.parse()
  
  return article
}

async function saveExtractedText(article: Article | PythonBaseline, filename: string): Promise<string> {
  const tempDir = join(__dirname, 'tmp')
  
  // Ensure temp directory exists
  try {
    await fs.mkdir(tempDir, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
  
  const outputPath = join(tempDir, filename)
  const content = article instanceof Article ? article.getResult() : article
  
  await fs.writeFile(outputPath, JSON.stringify(content, null, 2))
  return outputPath
}

describe('Python Feature Parity Verification', () => {
  
  describe('Title Extraction Comparison', () => {
    const testCases = [
      { name: 'CNN Article', htmlFile: 'cnn_001.html.mock', baselineFile: 'cnn_001.json' },
      { name: 'Time Article', htmlFile: 'time_001.html.mock', baselineFile: 'time_001.json' },
      { name: 'Wired Article', htmlFile: 'wired_001.html.mock', baselineFile: 'wired_001.json' }
    ]

    testCases.forEach(({ name, htmlFile, baselineFile }) => {
      it(`should extract similar title for ${name}`, async () => {
        const [html, pythonResult] = await Promise.all([
          loadHtmlFile(htmlFile),
          loadPythonBaseline(baselineFile)
        ])
        
        const tsResult = await extractWithTypeScript(html)
        
        console.log(`\n${name} Title Comparison:`)
        console.log(`  Python: "${pythonResult.title}"`)
        console.log(`  TypeScript: "${tsResult.title}"`)
        
        // Both should extract a meaningful title
        expect(tsResult.title?.length).toBeGreaterThan(10)
        
        // Should be reasonably similar (allowing for minor differences)
        if (pythonResult.title) {
          const similarity = calculateSimilarity(tsResult.title || '', pythonResult.title)
          expect(similarity).toBeGreaterThan(0.5) // At least 50% similar
        }
      })
    })
  })

  describe('Content Extraction Comparison', () => {
    const testCases = [
      { name: 'CNN Article', htmlFile: 'cnn_001.html.mock', baselineFile: 'cnn_001.json' },
      { name: 'Time Article', htmlFile: 'time_001.html.mock', baselineFile: 'time_001.json' }
    ]

    testCases.forEach(({ name, htmlFile, baselineFile }) => {
      it(`should extract similar content length for ${name}`, async () => {
        const [html, pythonResult] = await Promise.all([
          loadHtmlFile(htmlFile),
          loadPythonBaseline(baselineFile)
        ])
        
        const tsResult = await extractWithTypeScript(html)
        
        // Save extracted text to temp folder
        // const outputPath1 = await saveExtractedText(tsResult, `${name.toLowerCase().replace(/\s+/g, '_')}_ts_content.json`)
        // const outputPath2 = await saveExtractedText(pythonResult, `${name.toLowerCase().replace(/\s+/g, '_')}_py_content.json`)
        // console.log(`\nSaved extracted content to: ${outputPath1}`)
        // console.log(`\nSaved extracted content to: ${outputPath2}`)
        
        console.log(`\n${name} Content Length Comparison:`)
        console.log(`  Python: ${pythonResult.text.length} chars`)
        console.log(`  TypeScript: ${tsResult.text.length} chars`)

        // Both should extract substantial content
        expect(tsResult.text.length).toBeGreaterThan(500)
        
        // Content length should be within reasonable range
        if (pythonResult.text.length > 0) {
          const ratio = tsResult.text.length / pythonResult.text.length
          expect(ratio).toBeGreaterThan(0.3) // At least 30% of Python length
          expect(ratio).toBeLessThan(3.0)    // At most 3x Python length
        }
      })
    })
  })

  describe('Error-Free Processing', () => {
    it('should process all test files without errors', async () => {
      const testFiles = [
        'cnn_001.html.mock',
        'time_001.html.mock', 
        'wired_001.html.mock'
      ]
      
      for (const htmlFile of testFiles) {
        const html = await loadHtmlFile(htmlFile)
        
        // Should not throw errors
        const result = await extractWithTypeScript(html)
        expect(result).toBeDefined()
        
        // Should extract something meaningful
        expect((result.title?.length || 0) + result.text.length).toBeGreaterThan(0)
      }
    })
  })
})

// Utility functions
function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const words1 = normalize(str1).split(/\s+/)
  const words2 = normalize(str2).split(/\s+/)
  
  const commonWords = words1.filter(word => 
    words2.some(w2 => w2.includes(word) || word.includes(w2))
  )
  
  return commonWords.length / Math.max(words1.length, words2.length)
}