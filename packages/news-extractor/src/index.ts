/**
 * @babel-feed/news-extractor
 * 
 * TypeScript port of newspaper4k Python library
 * For news article extraction and parsing
 */

export { Article } from './article.js'
export { Source } from './source.js'
export { Configuration } from './configuration.js'
export { fulltext, build, hot } from './api.js'
export * from './types.js'

// Re-export extractors for advanced usage
export * from './extractors/index.js'

// Export utility modules
export * as network from './network.js'
export * as parsers from './parsers.js'
export * as text from './text.js'
export * as urls from './urls.js'