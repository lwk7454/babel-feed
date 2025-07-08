# @babel-feed/news-extractor

TypeScript port of the newspaper4k Python library for news article extraction and parsing.

## Overview

This package provides comprehensive news article extraction capabilities including:

- Article content extraction from HTML
- Multi-language support (English, Chinese, Japanese, and more)
- Metadata extraction (title, authors, publication date, images)
- Source/website analysis and bulk article processing
- Configurable extraction settings

**🚫 NLP Features Explicitly Excluded**: This package does NOT include keyword extraction, text summarization, or content analysis features from the original newspaper4k library. These features are handled by LLM integration in other parts of the Babel Feed system.

## Installation

```bash
bun add @babel-feed/news-extractor
```

## Quick Start

```typescript
import { Article, fulltext, build } from '@babel-feed/news-extractor';

// Extract article content
const article = new Article('https://example.com/article');
await article.process();

console.log(article.title);
console.log(article.text);
console.log(article.authors);

// Quick text extraction
const text = await fulltext('https://example.com/article');

// Build source and extract all articles
const source = await build('https://example.com');
const articles = await source.generateArticles();
```

## API Reference

### Classes

#### Article
Main class for processing individual news articles.

```typescript
const article = new Article(url, config?);
await article.download();  // Download HTML
await article.parse();     // Parse content
await article.process();   // Download + parse

// Access extracted data
article.title
article.text
article.authors
article.publishDate
article.images
article.metadata
```

#### Source
Represents a news website/domain for bulk processing.

```typescript
const source = new Source(url, config?);
await source.build();
const articles = await source.generateArticles();
```

#### Configuration
Customize extraction behavior.

```typescript
const config = new Configuration({
  processing: {
    minWordCount: 300,
    maxKeywords: 35,
    language: 'en'
  },
  network: {
    timeout: 7000,
    retries: 3
  }
});
```

### Functions

#### fulltext(url, config?)
Extract text content from URL.

#### build(url, config?)
Build source from URL.

#### extract(url, config?)
Full article extraction with processing.

#### quickExtract(url)
Minimal extraction with essential fields.

## Multi-Language Support

Supported languages:
- English (en)
- Chinese Simplified (zh-CN)
- Chinese Traditional (zh-TW)
- Japanese (ja)
- And 80+ more languages

```typescript
const config = Configuration.forLanguage('zh');
const article = new Article(url, config);
```

## Testing

```bash
# Run all tests
bun run test

# Run with coverage
bun run test:coverage

# Run specific test types
bun run test:unit
bun run test:integration
```

## Implementation Status

This package is currently under development. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed progress and roadmap.

### Completed Features ✅
- Package structure and configuration
- Core class architecture (Article, Source, Configuration)
- TypeScript type definitions
- Basic API structure
- Test framework setup

### In Progress 🚧
- Network layer implementation
- Content extraction algorithms
- HTML parsing and cleaning
- Metadata extraction

### Planned Features 📋
- Multi-language tokenization
- Performance optimization
- Comprehensive test coverage
- Documentation and examples

## Contributing

This package is part of the Babel Feed monorepo. See the main project documentation for development guidelines.

## License

MIT