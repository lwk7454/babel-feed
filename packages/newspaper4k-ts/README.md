# Newspaper4k-TS

A TypeScript implementation of newspaper4k for article extraction and processing, designed for the Babel Feed news aggregation system.

## Features

✅ **Implemented Features:**
- Article content extraction using scoring algorithms
- Title extraction with multiple fallback strategies
- Author extraction from various metadata sources
- Publication date extraction with comprehensive parsing
- Image extraction with intelligent scoring
- Video URL extraction from embedded content
- Metadata extraction (description, keywords, language, site name)
- Language detection using statistical analysis
- Keyword extraction with frequency analysis
- Article summarization using extractive methods
- Multi-language support (EN, ZH, JA, ES, FR, DE, etc.)
- Source discovery and management
- Configurable processing pipeline

## Installation

```bash
bun install @babel-feed/newspaper4k-ts
```

## Quick Start

```typescript
import { article, fulltext } from '@babel-feed/newspaper4k-ts';

// Extract article content
const articleInstance = await article('https://example.com/news-article');
console.log(articleInstance.title);
console.log(articleInstance.text);
console.log(articleInstance.authors);
console.log(articleInstance.publishDate);

// Extract text from HTML
const text = await fulltext('<html>...</html>', 'en');
console.log(text);
```

## API Reference

### Main Classes

#### Article
Main class for processing individual articles:

```typescript
import { Article } from '@babel-feed/newspaper4k-ts';

const article = new Article('https://example.com/article', {
  language: 'en',
  maxKeywords: 20,
  fetchImages: true
});

await article.download();
await article.parse();

console.log({
  title: article.title,
  text: article.text,
  authors: article.authors,
  publishDate: article.publishDate,
  summary: article.summary,
  keywords: article.keywords,
  images: article.images,
  language: article.language
});
```

#### Source
Class for managing news sources and discovering articles:

```typescript
import { Source } from '@babel-feed/newspaper4k-ts';

const source = new Source('https://news-website.com');
await source.build();

console.log({
  articles: source.articles,
  feeds: source.feeds,
  categories: source.categories
});
```

#### Configuration
Manage extraction settings:

```typescript
import { Configuration } from '@babel-feed/newspaper4k-ts';

const config = new Configuration({
  language: 'en',
  minWordCount: 300,
  maxKeywords: 35,
  fetchImages: true,
  timeout: 30000
});

// Use with Article
const article = new Article(url, config.toObject());
```

### Utility Functions

```typescript
import { 
  article, 
  fulltext, 
  languages, 
  popularUrls 
} from '@babel-feed/newspaper4k-ts';

// Shortcut function
const articleData = await article(url, 'en');

// Extract text from HTML
const text = await fulltext(html, 'en');

// Get supported languages
const langs = languages();

// Get popular news source URLs
const sources = popularUrls();
```

## Configuration Options

```typescript
interface ArticleConfig {
  minWordCount?: number;        // Minimum words for valid article (default: 300)
  minSentCount?: number;        // Minimum sentences (default: 7)
  maxTitle?: number;           // Maximum title length (default: 200)
  maxText?: number;            // Maximum text length (default: 100000)
  maxKeywords?: number;        // Maximum keywords (default: 35)
  maxAuthors?: number;         // Maximum authors (default: 10)
  maxSummarySent?: number;     // Maximum summary sentences (default: 5)
  memorizeArticles?: boolean;  // Cache article URLs (default: true)
  fetchImages?: boolean;       // Extract images (default: true)
  followMetaRefresh?: boolean; // Follow meta refresh (default: false)
  cleanArticleHtml?: boolean;  // Clean HTML (default: true)
  httpSuccessOnly?: boolean;   // Raise errors on HTTP 4xx/5xx (default: true)
  timeout?: number;            // HTTP timeout in ms (default: 30000)
  maxRetries?: number;         // Maximum HTTP retries (default: 3)
  userAgent?: string;          // Custom User-Agent string
  headers?: Record<string, string>; // Custom HTTP headers
  language?: string;           // Primary language (default: 'en')
}
```

## Language Support

- **English (en)** - Full support
- **Chinese (zh)** - Full support with character-based segmentation
- **Japanese (ja)** - Full support with character-based segmentation
- **Spanish (es)** - Full support
- **French (fr)** - Full support
- **German (de)** - Full support
- **Italian (it)** - Full support
- **Portuguese (pt)** - Full support
- **Russian (ru)** - Full support
- **Arabic (ar)** - Full support
- **Korean (ko)** - Full support
- And 15+ additional languages

## Advanced Usage

### Custom Configuration

```typescript
const config = new Configuration();
config.setBrowserHeaders();      // Use browser-like headers
config.setMobileHeaders();       // Use mobile headers
config.setMaxContentMode();      // Extract maximum content
config.setFastMode();           // Optimize for speed
config.setHighQualityMode();    // Only high-quality articles
```

### Error Handling

```typescript
try {
  const article = await article(url);
  if (!article.isValidArticle()) {
    console.warn('Article did not meet quality thresholds');
  }
} catch (error) {
  console.error('Failed to extract article:', error);
}
```

### Extraction Statistics

```typescript
const stats = article.getStats();
console.log({
  wordCount: stats.wordCount,
  readingTime: stats.readingTime,
  complexity: stats.complexity,
  imageCount: stats.imageCount
});
```

## Integration with News Aggregator

This package is designed to work seamlessly with the Babel Feed news aggregation system:

```typescript
// In news aggregator processor
import { fulltext } from '@babel-feed/newspaper4k-ts';

async function extractContent(rawHtml: string) {
  const extractedText = await fulltext(rawHtml, 'en');
  return {
    text: extractedText,
    summary: extractedText.substring(0, 500)
  };
}
```

## Architecture

The package follows a modular architecture inspired by newspaper4k:

- **Extractors**: Specialized extraction classes for different content types
- **NLP**: Natural language processing for keywords, summarization, and language detection
- **Utils**: HTTP client, URL utilities, and text processing helpers
- **Configuration**: Flexible configuration management
- **Types**: Comprehensive TypeScript type definitions

## Dependencies

- **cheerio**: HTML parsing and DOM manipulation
- **axios**: HTTP client with retry logic
- **date-fns**: Date parsing and manipulation
- **franc**: Language detection
- **compromise**: Natural language processing
- **natural**: Additional NLP utilities
- **stopword**: Multi-language stopword removal
- **sharp**: Image processing (optional)

## Performance

- Optimized for speed with configurable timeouts and retries
- Memory-efficient processing of large articles
- Supports concurrent processing of multiple articles
- Caching of extracted content to avoid re-processing

## Testing

```bash
# Run simple test
bun run src/simple-test.ts

# Run comprehensive tests (when implemented)
bun test
```

## Contributing

This package is part of the Babel Feed monorepo. Contributions should follow the established patterns and maintain compatibility with the news aggregation system.

## License

MIT License - see LICENSE file for details.

## Credits

Inspired by the original newspaper4k Python library. This TypeScript implementation is designed specifically for modern Node.js/Bun environments and the Babel Feed ecosystem.