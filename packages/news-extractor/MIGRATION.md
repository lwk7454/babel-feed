# Migration Guide: Python newspaper4k to TypeScript @babel-feed/news-extractor

This guide helps you migrate from Python `newspaper4k` to the TypeScript `@babel-feed/news-extractor` package.

## Overview

The `@babel-feed/news-extractor` package is a feature-complete TypeScript port of the Python `newspaper4k` library, maintaining **exact algorithm parity** for core extraction functionality while removing NLP features (keywords, summarization) that are better handled by modern LLM integration.

## Key Differences

### ✅ What's Included (Exact Parity)
- Article content extraction (gravity scoring algorithm)
- Title extraction (multi-source selection)
- Author extraction (metadata + content analysis)
- Publication date extraction (URL patterns + metadata)
- Image extraction (quality scoring + distance calculation)
- Video extraction (embedded + structured data)
- Multi-language support (Chinese, Japanese, Korean + 30 languages)
- RSS feed discovery and parsing
- Source/website structure analysis
- Language detection and tokenization

### ❌ What's Removed (By Design)
- **Keywords extraction** → Use LLM integration
- **Text summarization** → Use LLM integration
- **NLP processing** → Use LLM integration

## Installation

### Python newspaper4k
```bash
pip install newspaper4k
```

### TypeScript @babel-feed/news-extractor
```bash
npm install @babel-feed/news-extractor
# or
bun install @babel-feed/news-extractor
```

## API Migration

### 1. Basic Article Extraction

#### Python newspaper4k
```python
from newspaper import Article

url = 'http://cnn.com/2013/11/27/travel/weather-thanksgiving/'
article = Article(url)
article.download()
article.parse()

print(article.title)
print(article.authors)
print(article.publish_date)
print(article.text)
```

#### TypeScript @babel-feed/news-extractor
```typescript
import { Article } from '@babel-feed/news-extractor'

const url = 'http://cnn.com/2013/11/27/travel/weather-thanksgiving/'
const article = new Article(url)
await article.download()
await article.parse()

console.log(article.title)
console.log(article.authors)
console.log(article.publishDate)
console.log(article.text)
```

**Key Changes:**
- Import syntax: `from newspaper import` → `import { } from`
- Async/await: All methods are now `async` and must be `await`ed
- Property names: `publish_date` → `publishDate` (camelCase)

### 2. Configuration

#### Python newspaper4k
```python
from newspaper import Config, Article

config = Config()
config.language = 'zh'  # Chinese
config.memoize_articles = False
config.fetch_images = False

article = Article(url, config=config)
```

#### TypeScript @babel-feed/news-extractor
```typescript
import { Configuration, Article } from '@babel-feed/news-extractor'

const config = new Configuration()
config.language = 'zh'  // Chinese
config.memoizeArticles = false
config.fetchImages = false

// Or use static factory method
const config = Configuration.forLanguage('zh')

const article = new Article(url, config)
```

**Key Changes:**
- Class name: `Config` → `Configuration`
- Constructor: Must use `new Configuration()`
- Property names: `memoize_articles` → `memoizeArticles` (camelCase)
- Language factory: `Configuration.forLanguage(lang)` for convenience

### 3. Source/Feed Processing

#### Python newspaper4k
```python
from newspaper import Source

source = Source('http://cnn.com')
source.build()

for article in source.articles:
    article.download()
    article.parse()
    print(article.title)

# Feed URLs
print(source.feed_urls())
```

#### TypeScript @babel-feed/news-extractor
```typescript
import { Source } from '@babel-feed/news-extractor'

const source = new Source('http://cnn.com')
await source.build()

for (const article of source.articles) {
    await article.download()
    await article.parse()
    console.log(article.title)
}

// Feed URLs
console.log(source.feedUrls)
```

**Key Changes:**
- All methods are `async`
- Property access: `source.feed_urls()` → `source.feedUrls`
- Method names: snake_case → camelCase

### 4. Error Handling

#### Python newspaper4k
```python
try:
    article = Article(url)
    article.download()
    article.parse()
except Exception as e:
    print(f"Error: {e}")
```

#### TypeScript @babel-feed/news-extractor
```typescript
import { ErrorRecovery } from '@babel-feed/news-extractor/error-recovery'

try {
    const article = new Article(url)
    await article.download()
    await article.parse()
} catch (error) {
    console.error('Error:', error.message)
}

// With automatic retry
const result = await ErrorRecovery.withRetry(async () => {
    const article = new Article(url)
    return await article.process()
}, { maxAttempts: 3 })
```

**Key Changes:**
- Enhanced error recovery system
- Built-in retry mechanisms
- Structured logging support

### 5. Language Configuration

#### Python newspaper4k
```python
from newspaper import Config

# Chinese
config = Config()
config.language = 'zh'

# Custom language with specific settings
config.request_timeout = 10
config.number_threads = 5
```

#### TypeScript @babel-feed/news-extractor
```typescript
import { Configuration } from '@babel-feed/news-extractor'

// Chinese
const config = Configuration.forLanguage('zh')

// Custom language with specific settings
config.requestsParams.timeout = 10000  // milliseconds
config.threadTimeoutSeconds = 5
```

**Key Changes:**
- Static factory methods for common languages
- Timeout in milliseconds vs seconds
- Nested configuration structure

## Feature Mapping

| Python newspaper4k | TypeScript @babel-feed/news-extractor | Notes |
|-------------------|--------------------------------------|-------|
| `Article.download()` | `await article.download()` | Now async |
| `Article.parse()` | `await article.parse()` | Now async |
| `Article.nlp()` | ❌ **Removed** | Use LLM integration |
| `Article.keywords` | ❌ **Removed** | Use LLM integration |
| `Article.summary` | ❌ **Removed** | Use LLM integration |
| `Article.title` | `article.title` | Same |
| `Article.authors` | `article.authors` | Same |
| `Article.publish_date` | `article.publishDate` | camelCase |
| `Article.text` | `article.text` | Same |
| `Article.images` | `article.images` | Same |
| `Article.movies` | `article.videos` | Renamed |
| `Source.build()` | `await source.build()` | Now async |
| `Source.articles` | `source.articles` | Same |
| `Source.feed_urls()` | `source.feedUrls` | Property vs method |

## Testing Migration

### Python Tests
```python
import unittest
from newspaper import Article

class TestArticle(unittest.TestCase):
    def test_extraction(self):
        article = Article('http://example.com')
        article.download()
        article.parse()
        self.assertIsNotNone(article.title)
```

### TypeScript Tests
```typescript
import { describe, it, expect } from 'bun:test'
import { Article } from '@babel-feed/news-extractor'

describe('Article', () => {
    it('should extract article content', async () => {
        const article = new Article('http://example.com')
        await article.download()
        await article.parse()
        expect(article.title).toBeDefined()
    })
})
```

## Performance Considerations

### Python newspaper4k
- Synchronous processing
- Threading for concurrent downloads
- Manual memory management

### TypeScript @babel-feed/news-extractor
- Asynchronous processing (better for I/O)
- Promise-based concurrency
- Built-in performance monitoring
- Memory leak detection

```typescript
import { PerformanceBenchmark } from '@babel-feed/news-extractor/benchmarks'

const benchmark = new PerformanceBenchmark()
const result = await benchmark.benchmarkArticles(urls, 5) // 5 concurrent
console.log(`Average time: ${result.averageTimeMs}ms`)
```

## Advanced Features

### 1. Custom Extractors (Python → TypeScript)

#### Python
```python
# Not easily extensible
```

#### TypeScript
```typescript
import { ContentExtractor } from '@babel-feed/news-extractor/extractors'

class CustomExtractor extends ContentExtractor {
    extractCustomField($: CheerioAPI): string {
        return $('.custom-selector').text()
    }
}
```

### 2. Error Recovery (New Feature)

```typescript
import { ErrorRecovery } from '@babel-feed/news-extractor/error-recovery'

// Circuit breaker pattern
const extract = ErrorRecovery.createCircuitBreaker(
    async () => new Article(url).process(),
    5, // failure threshold
    60000 // reset timeout
)

// Fallback strategies
const result = await ErrorRecovery.withFallbacks([
    { name: 'primary', execute: () => extractPrimary(url) },
    { name: 'fallback', execute: () => extractFallback(url) }
])
```

## Migration Checklist

- [ ] Install `@babel-feed/news-extractor`
- [ ] Update import statements
- [ ] Convert synchronous calls to async/await
- [ ] Update property names to camelCase
- [ ] Remove NLP-related code (keywords, summary)
- [ ] Update configuration object structure
- [ ] Update test framework syntax
- [ ] Enable error recovery where needed
- [ ] Add performance monitoring if desired
- [ ] Test with existing URLs to verify extraction quality

## Common Migration Issues

### 1. Missing Async/Await
**Error:** `TypeError: Cannot read property 'title' of undefined`
**Solution:** Ensure all extraction methods are awaited

### 2. Configuration Properties
**Error:** `Property 'language' does not exist`
**Solution:** Check Configuration class documentation for correct property names

### 3. NLP Features
**Error:** `Property 'keywords' does not exist`
**Solution:** Remove NLP code, implement LLM integration separately

## Getting Started

1. **Install the package**
2. **Start with basic article extraction**
3. **Migrate configuration settings**
4. **Update error handling**
5. **Remove NLP dependencies**
6. **Test with your existing URLs**
7. **Add performance monitoring**

The TypeScript version provides the same extraction quality as Python newspaper4k while offering better performance, type safety, and modern async patterns.