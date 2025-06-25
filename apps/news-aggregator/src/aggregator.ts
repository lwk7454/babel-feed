import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { NEWS_PROVIDERS, AGGREGATION_CONFIG, type NewsProvider } from './config.js';
import { saveArticle, articleExists, type ArticleData } from './database.js';
import { translateContent } from './translator.js';

/**
 * News aggregation service
 */

const parser = new Parser({
  timeout: AGGREGATION_CONFIG.requestTimeout,
  headers: {
    'User-Agent': 'Babel Feed News Aggregator/1.0'
  }
});

/**
 * Generate unique ID for article based on URL
 */
function generateArticleId(url: string): string {
  return createHash('md5').update(url).digest('hex');
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&[^;]+;/g, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract article data from RSS feed item
 */
function extractArticleFromFeedItem(item: any, provider: NewsProvider): Partial<ArticleData> {
  const title = cleanText(item.title || '');
  const summary = cleanText(item.contentSnippet || item.summary || item.description || '');
  const url = item.link || item.guid || '';
  const publishedAt = item.pubDate || item.isoDate || new Date().toISOString();
  
  // Extract image URL if available
  let imageUrl: string | undefined;
  if (item.enclosure?.url && item.enclosure?.type?.startsWith('image/')) {
    imageUrl = item.enclosure.url;
  } else if (item['media:thumbnail']) {
    imageUrl = item['media:thumbnail']['$']?.url;
  } else if (item['media:content']) {
    const mediaContent = Array.isArray(item['media:content']) ? item['media:content'][0] : item['media:content'];
    if (mediaContent?.['$']?.type?.startsWith('image/')) {
      imageUrl = mediaContent['$'].url;
    }
  }

  return {
    id: generateArticleId(url),
    title,
    summary: summary || undefined,
    url,
    source: provider.name,
    sourceLanguage: provider.language,
    publishedAt,
    imageUrl
  };
}

/**
 * Fetch and parse RSS feed from a provider
 */
async function fetchProviderFeed(provider: NewsProvider): Promise<Partial<ArticleData>[]> {
  try {
    console.log(`Fetching feed from ${provider.name}...`);
    const feed = await parser.parseURL(provider.url);
    
    const articles = feed.items
      .slice(0, AGGREGATION_CONFIG.maxArticlesPerProvider)
      .map(item => extractArticleFromFeedItem(item, provider))
      .filter(article => article.title && article.url);

    console.log(`Extracted ${articles.length} articles from ${provider.name}`);
    return articles;
  } catch (error) {
    console.error(`Error fetching feed from ${provider.name}:`, error);
    return [];
  }
}

/**
 * Process a single article with translations
 */
async function processArticle(partialArticle: Partial<ArticleData>): Promise<void> {
  if (!partialArticle.url || await articleExists(partialArticle.url)) {
    return;
  }

  try {
    console.log(`Processing article: ${partialArticle.title}`);
    
    // Get translations for title and summary
    const titleTranslations = await translateContent(
      partialArticle.title || '',
      partialArticle.sourceLanguage || 'en'
    );
    
    const summaryTranslations = partialArticle.summary 
      ? await translateContent(partialArticle.summary, partialArticle.sourceLanguage || 'en')
      : {};

    // Create complete article data
    const completeArticle: ArticleData = {
      id: partialArticle.id || generateArticleId(partialArticle.url),
      title: partialArticle.title || '',
      titleTranslations,
      summary: partialArticle.summary,
      summaryTranslations,
      url: partialArticle.url,
      source: partialArticle.source || '',
      sourceLanguage: partialArticle.sourceLanguage || 'en',
      availableLanguages: [
        partialArticle.sourceLanguage || 'en',
        ...Object.keys(titleTranslations)
      ],
      publishedAt: partialArticle.publishedAt || new Date().toISOString(),
      imageUrl: partialArticle.imageUrl
    };

    await saveArticle(completeArticle);
    console.log(`Successfully processed article: ${completeArticle.title}`);
  } catch (error) {
    console.error(`Error processing article ${partialArticle.title}:`, error);
  }
}

/**
 * Run aggregation for all enabled providers
 */
export async function runAggregation(): Promise<void> {
  console.log('Starting news aggregation...');
  
  const enabledProviders = NEWS_PROVIDERS.filter(provider => provider.enabled);
  console.log(`Processing ${enabledProviders.length} enabled providers`);

  for (const provider of enabledProviders) {
    try {
      const articles = await fetchProviderFeed(provider);
      
      // Process articles in batches to avoid overwhelming translation service
      for (let i = 0; i < articles.length; i += AGGREGATION_CONFIG.batchSize) {
        const batch = articles.slice(i, i + AGGREGATION_CONFIG.batchSize);
        await Promise.all(batch.map(processArticle));
        
        // Small delay between batches to be respectful to translation API
        if (i + AGGREGATION_CONFIG.batchSize < articles.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error(`Error processing provider ${provider.name}:`, error);
    }
  }

  console.log('News aggregation completed');
}

/**
 * Validate provider configuration
 */
export function validateProviders(): boolean {
  const errors: string[] = [];

  for (const provider of NEWS_PROVIDERS) {
    if (!provider.id) errors.push(`Provider missing ID: ${provider.name}`);
    if (!provider.name) errors.push(`Provider missing name: ${provider.id}`);
    if (!provider.url) errors.push(`Provider missing URL: ${provider.id}`);
    if (!provider.language) errors.push(`Provider missing language: ${provider.id}`);
  }

  if (errors.length > 0) {
    console.error('Provider validation errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  return true;
}