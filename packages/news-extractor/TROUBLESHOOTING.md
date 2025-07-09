# News Extractor Troubleshooting Guide

This guide helps diagnose and resolve common issues with the `@babel-feed/news-extractor` package.

## Common Issues

### 1. Network and Connection Issues

#### Problem: Timeout errors when downloading articles
```
Error: HTTP error when downloading https://example.com: timeout of 7000ms exceeded
```

**Solutions:**
- Increase timeout in configuration:
```typescript
const config = new Configuration()
config.requestsParams.timeout = 15000 // 15 seconds
```
- Check network connectivity
- Verify the URL is accessible

#### Problem: 403 Forbidden or 429 Too Many Requests
```
Error: HTTP error when downloading https://example.com: Request failed with status code 403
```

**Solutions:**
- Use different user agents:
```typescript
const config = new Configuration()
config.requestsParams.headers['User-Agent'] = 'Custom Bot 1.0'
```
- Add delays between requests
- Implement rate limiting in your application

#### Problem: SSL/TLS certificate errors
```
Error: unable to verify the first certificate
```

**Solutions:**
- For development only, disable SSL verification:
```typescript
import { Configuration } from '@babel-feed/news-extractor'
const config = new Configuration()
config.requestsParams.httpsAgent = new (require('https').Agent)({
  rejectUnauthorized: false
})
```

### 2. Content Extraction Issues

#### Problem: Empty or missing article text
```typescript
const article = new Article('https://example.com')
await article.download()
await article.parse()
console.log(article.text) // Empty string
```

**Possible causes and solutions:**
1. **JavaScript-rendered content**: Site uses dynamic content loading
   - Solution: Not supported - content must be in initial HTML
2. **Paywall or login required**: Content hidden behind authentication
   - Solution: Handle authentication before extraction
3. **Non-standard HTML structure**: Unusual article layout
   - Solution: Configure extraction manually:
```typescript
const config = new Configuration()
config.verbose = true // Enable debug logging
```

#### Problem: Incorrect title extraction
**Solutions:**
- Check for multiple title sources:
```typescript
const result = await article.process()
console.log('Title sources:', {
  htmlTitle: article.metadata.title,
  ogTitle: article.metadata.openGraphData?.title,
  metaTitle: article.metadata.metaDescription
})
```

#### Problem: Missing or incorrect date extraction
**Solutions:**
- Verify date patterns in URL or metadata:
```typescript
import { DateExtractor } from '@babel-feed/news-extractor/extractors'
const dateExtractor = new DateExtractor(config)
// Check what date patterns are found
```

### 3. Language and Encoding Issues

#### Problem: Garbled text with special characters
```
Text appears as: "Thi� i� � t��t"
```

**Solutions:**
- Enable encoding detection:
```typescript
const config = new Configuration()
config.enableEncodingDetection = true
```
- Manually specify encoding:
```typescript
config.requestsParams.responseType = 'arraybuffer'
```

#### Problem: Incorrect language detection
**Solutions:**
- Override language detection:
```typescript
const config = Configuration.forLanguage('zh')
```
- Check detection result:
```typescript
import { LanguageDetector } from '@babel-feed/news-extractor/languages'
const detector = new LanguageDetector()
const detected = await detector.detectLanguage(htmlContent)
console.log('Detected language:', detected)
```

### 4. Memory and Performance Issues

#### Problem: High memory usage or memory leaks
```
Process consuming excessive memory after processing many articles
```

**Solutions:**
- Process articles in batches:
```typescript
const articles = urls.map(url => new Article(url))
for (let i = 0; i < articles.length; i += 10) {
  const batch = articles.slice(i, i + 10)
  await Promise.all(batch.map(article => article.process()))
  // Force garbage collection if available
  if (global.gc) global.gc()
}
```

- Use memory monitoring:
```typescript
import { PerformanceBenchmark } from '@babel-feed/news-extractor/benchmarks'
const benchmark = new PerformanceBenchmark()
const stressResult = await benchmark.stressTestMemory(urls, 100)
console.log('Memory leak detected:', stressResult.memoryLeakDetected)
```

#### Problem: Slow extraction performance
**Solutions:**
- Enable parallel processing:
```typescript
const articles = urls.map(url => new Article(url))
await Promise.all(articles.map(article => article.process()))
```

- Use Source class for feed processing:
```typescript
const source = new Source('https://example.com')
await source.build()
const articles = await source.generateArticles()
```

### 5. RSS and Feed Processing Issues

#### Problem: No feeds discovered for a site
```typescript
const source = new Source('https://example.com')
await source.build()
console.log(source.feedUrls.length) // 0
```

**Solutions:**
- Check common feed paths manually:
```typescript
const commonPaths = ['/feed', '/rss', '/feeds/all.atom.xml']
for (const path of commonPaths) {
  try {
    const response = await fetch(site + path)
    if (response.ok) console.log('Found feed:', path)
  } catch {}
}
```

- Look for feeds in HTML:
```typescript
const extractor = new ContentExtractor()
const $ = extractor.loadHtml(htmlContent)
const feedUrls = extractor.getFeedUrls($, baseUrl)
console.log('Found feeds:', feedUrls)
```

### 6. Configuration Issues

#### Problem: TypeScript compilation errors
```
Property 'requestsParams' does not exist on type 'Configuration'
```

**Solutions:**
- Check import statements:
```typescript
import { Configuration } from '@babel-feed/news-extractor'
```

- Verify package installation:
```bash
npm install @babel-feed/news-extractor
# or
bun install @babel-feed/news-extractor
```

## Debugging Tips

### 1. Enable Verbose Logging
```typescript
import { logger, LogLevel } from '@babel-feed/news-extractor/logger'
logger.setLevel(LogLevel.DEBUG)
```

### 2. Inspect Extraction Steps
```typescript
const article = new Article(url)
await article.download()
console.log('HTML length:', article.html.length)

await article.parse()
console.log('Extraction result:', {
  title: article.title,
  textLength: article.text.length,
  authors: article.authors,
  publishDate: article.publishDate
})
```

### 3. Test with Known Working URLs
```typescript
// Test with these known-working URLs:
const testUrls = [
  'https://edition.cnn.com/2024/01/01/politics/test-article.html',
  'https://www.bbc.com/news/test-article',
  'https://www.reuters.com/world/test-article'
]
```

### 4. Check Network Configuration
```typescript
import { NetworkClient } from '@babel-feed/news-extractor/network'
const client = new NetworkClient(config)
try {
  const response = await client.get(url)
  console.log('Response status:', response.status)
  console.log('Content type:', response.headers['content-type'])
} catch (error) {
  console.error('Network error:', error.message)
}
```

## Performance Optimization

### 1. Use Connection Pooling
```typescript
const config = new Configuration()
config.requestsParams.maxRedirects = 3
config.requestsParams.timeout = 10000
```

### 2. Implement Caching
```typescript
const cache = new Map()
const getCachedArticle = async (url) => {
  if (cache.has(url)) return cache.get(url)
  
  const article = new Article(url)
  await article.process()
  cache.set(url, article.getResult())
  return article.getResult()
}
```

### 3. Use Error Recovery
```typescript
import { ErrorRecovery } from '@babel-feed/news-extractor/error-recovery'

const extractWithRetry = await ErrorRecovery.withRetry(
  async () => {
    const article = new Article(url)
    return await article.process()
  },
  { maxAttempts: 3, backoffMs: 1000 }
)
```

## Getting Help

1. **Check the logs**: Enable debug logging to see detailed error information
2. **Test with simple cases**: Start with known-working URLs
3. **Verify configuration**: Ensure all settings are correct
4. **Check network connectivity**: Test the URL in a browser first
5. **Review documentation**: Check the main README and API documentation

For additional support, please file an issue on the project repository with:
- Error message and stack trace
- URL being processed (if public)
- Configuration used
- Expected vs actual behavior