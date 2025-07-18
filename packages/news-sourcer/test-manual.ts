#!/usr/bin/env bun

import { NewsSourcer } from './src/news-sourcer.js'
import { logger } from '@babel-feed/utils'

async function testNewsSourcer(url: string) {
  console.log(`\n🔍 Testing news-sourcer with URL: ${url}`)
  console.log('=' .repeat(60))

  try {
    // Initialize the news-sourcer
    console.log('📡 Initializing news-sourcer...')
    const newsSourcer = new NewsSourcer({
      validation: {
        timeout: 10000,
        maxRetries: 2
      },
      rateLimit: {
        enabled: true,
        requestsPerSecond: 2
      }
    })
    
    await newsSourcer.initialize()
    console.log('✅ News-sourcer initialized successfully')

    // Test RSS/Atom feed discovery
    console.log('\n🔍 Step 1: Analyzing source for RSS/Atom feeds...')
    const analysis = await newsSourcer.analyzeSource(url)
    
    console.log(`📊 Analysis Results:`)
    console.log(`   - Total discovered feeds: ${analysis.totalEndpoints}`)
    console.log(`   - RSS feeds: ${analysis.rssFeeds.length}`)
    console.log(`   - Atom feeds: ${analysis.atomFeeds.length}`)
    console.log(`   - Success rate: ${(analysis.successRate * 100).toFixed(1)}%`)

    if (analysis.rssFeeds.length > 0) {
      console.log('\n📰 RSS Feeds found:')
      analysis.rssFeeds.forEach((feed, index) => {
        console.log(`   ${index + 1}. ${feed.url}${feed.title ? ` (${feed.title})` : ''}`)
      })
    }

    if (analysis.atomFeeds.length > 0) {
      console.log('\n📰 Atom Feeds found:')
      analysis.atomFeeds.forEach((feed, index) => {
        console.log(`   ${index + 1}. ${feed.url}${feed.title ? ` (${feed.title})` : ''}`)
      })
    }

    // Show validation results
    console.log('\n✅ Validation Results:')
    for (const [feedUrl, result] of analysis.validationResults) {
      const status = result.valid ? '✅' : '❌'
      console.log(`   ${status} ${feedUrl}`)
      if (result.valid) {
        console.log(`      Type: ${result.feedType}`)
        console.log(`      Articles: ${result.articleCount}`)
        if (result.sampleUrls && result.sampleUrls.length > 0) {
          console.log(`      Sample URLs: ${result.sampleUrls.slice(0, 3).join(', ')}${result.sampleUrls.length > 3 ? '...' : ''}`)
        }
      } else {
        console.log(`      Error: ${result.error}`)
      }
    }

    // If no RSS feeds found, try HTML analysis
    if (analysis.totalEndpoints === 0) {
      console.log('\n🔍 Step 2: No RSS feeds found, trying HTML analysis...')
      try {
        const htmlAnalysis = await newsSourcer.analyzeHtmlSource(url)
        console.log(`📊 HTML Analysis Results:`)
        console.log(`   - Endpoints discovered: ${htmlAnalysis.endpoints.length}`)
        console.log(`   - Analysis confidence: ${(htmlAnalysis.analysisMetadata.finalConfidence * 100).toFixed(1)}%`)
        console.log(`   - Total analysis time: ${htmlAnalysis.analysisMetadata.totalAnalysisTime}ms`)
        console.log(`   - LLM iterations: ${htmlAnalysis.analysisMetadata.iterations}`)

        if (htmlAnalysis.endpoints.length > 0) {
          console.log('\n🌐 HTML Endpoints discovered:')
          htmlAnalysis.endpoints.forEach((endpoint, index) => {
            console.log(`   ${index + 1}. ${endpoint.url} (${endpoint.type})`)
            console.log(`      Category: ${endpoint.category}`)
            console.log(`      Priority: ${endpoint.priority}`)
            console.log(`      Confidence: ${(endpoint.reliability.confidence * 100).toFixed(1)}%`)
            if (endpoint.crawlingScript) {
              console.log(`      Article selector: ${endpoint.crawlingScript.articleSelector}`)
            }
          })
        }
      } catch (htmlError) {
        console.log(`❌ HTML analysis failed: ${htmlError instanceof Error ? htmlError.message : 'Unknown error'}`)
      }
    }

    // Show performance metrics
    console.log('\n📈 Performance Metrics:')
    const metrics = newsSourcer.getPerformanceMetrics()
    console.log(`   - HTTP requests: ${metrics.counters.http_requests_total || 0}`)
    console.log(`   - Average response time: ${metrics.histograms.http_request?.avg?.toFixed(2) || 'N/A'}ms`)
    
    const protectionMetrics = newsSourcer.getMetrics()
    console.log(`   - Circuit breakers: ${Object.keys(protectionMetrics.circuitBreakers).length}`)
    console.log(`   - Rate limiters: ${Object.keys(protectionMetrics.rateLimiters).length}`)

    // Test database operations
    console.log('\n💾 Testing database operations...')
    const endpoints = await newsSourcer.queryEndpoints({})
    console.log(`   - Existing endpoints in DB: ${endpoints.length}`)

    // Create a test endpoint if we found feeds
    if (analysis.rssFeeds.length > 0 || analysis.atomFeeds.length > 0) {
      console.log('\n💾 Creating test endpoint in database...')
      
      // Get the first valid feed
      const firstFeed = analysis.rssFeeds[0] || analysis.atomFeeds[0]
      const validationResult = analysis.validationResults.get(firstFeed.url)
      
      if (validationResult?.valid) {
        const endpoint = await newsSourcer.createEndpoint({
          sourceId: '1', // You might need to create a news source first
          endpointUrl: firstFeed.url,
          type: firstFeed.type,
          category: 'general',
          pollingInterval: 3600,
          reliability: 1.0,
          priority: 1,
          metadata: {
            discoveredAt: new Date(),
            title: firstFeed.title,
            feedType: validationResult.feedType,
            articleCount: validationResult.articleCount
          }
        })
        
        console.log(`✅ Created endpoint with ID: ${endpoint.id}`)
        console.log(`   URL: ${endpoint.endpointUrl}`)
        console.log(`   Type: ${endpoint.type}`)
        console.log(`   Reliability: ${endpoint.reliability}`)
        
        // Query the endpoint back
        const retrievedEndpoint = await newsSourcer.getEndpoint(endpoint.id)
        if (retrievedEndpoint) {
          console.log(`✅ Successfully retrieved endpoint from database`)
        }
      }
    }

    console.log('\n🎉 Test completed successfully!')

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    process.exit(1)
  }
}

// Get URL from command line arguments
const url = process.argv[2]

if (!url) {
  console.error('❌ Please provide a URL to test')
  console.error('Usage: bun run test-manual.ts <url>')
  console.error('Example: bun run test-manual.ts https://example.com')
  process.exit(1)
}

// Validate URL format
try {
  new URL(url)
} catch {
  console.error('❌ Invalid URL format')
  process.exit(1)
}

// Run the test
testNewsSourcer(url) 