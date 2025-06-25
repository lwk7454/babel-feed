# Babel Feed News Aggregator

A standalone service that continuously aggregates news from multiple sources, translates content into supported languages using OpenRouter free models, and stores everything in the database for the Babel Feed mobile app.

## Features

- **Multi-source Aggregation**: Collects news from diverse RSS feeds across different languages
- **Intelligent Translation**: Uses OpenRouter free models to translate content into all supported languages
- **Cost Optimization**: Designed to minimize costs using free translation models
- **Configurable Providers**: Easy to add/remove news sources through configuration
- **Rate Limiting**: Respectful API usage with built-in rate limiting
- **Batch Processing**: Efficient batch processing to handle large volumes
- **Local Development**: Runs entirely on your local machine for development and testing

## Supported Languages

- English (en)
- Chinese Simplified (zh-CN)
- Chinese Traditional (zh-TW)
- Japanese (ja)

## Quick Start

### Prerequisites

1. **Bun runtime** (for running the service)
2. **OpenRouter API key** (free tier available)
3. **PostgreSQL database** (same as main Babel Feed app)

### Installation

```bash
cd services/news-aggregator
bun install
```

### Configuration

Create a `.env` file:

```bash
# Required
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Database (should match your main app)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=babel_feed
DB_USER=postgres
DB_PASSWORD=your_password

# Optional: Aggregation settings
AGGREGATION_INTERVAL=30        # minutes
BATCH_SIZE=10                  # articles per batch
MAX_ARTICLES_PER_PROVIDER=20   # max articles per source
```

### Usage

```bash
# Start continuous aggregation service
bun run start
# or
bun src/index.ts start

# Run once for testing
bun run once
# or  
bun src/index.ts once

# Check configuration
bun src/index.ts status

# Show help
bun src/index.ts help
```

## News Sources

The service currently aggregates from:

### English Sources
- BBC World News
- Reuters World News
- TechCrunch

### Chinese Sources
- Xinhua News

### Japanese Sources
- NHK World

### Adding New Sources

Edit `src/config.ts` and add new providers to the `NEWS_PROVIDERS` array:

```typescript
{
  id: 'unique-provider-id',
  name: 'Provider Display Name',
  url: 'https://example.com/rss.xml',
  language: 'en',
  category: 'world',
  enabled: true
}
```

## How It Works

1. **Aggregation**: Fetches RSS feeds from configured providers
2. **Content Extraction**: Parses articles, extracts title, summary, images
3. **Translation**: Translates content to all supported languages using OpenRouter
4. **Storage**: Saves articles with all translations to the database
5. **Scheduling**: Repeats process at configured intervals

## Translation Strategy

- Uses OpenRouter's free models for cost-effective translation
- Rate limiting to respect API limits
- Fallback handling for translation failures
- Batch processing to optimize API usage

## Database Integration

The service integrates with the main Babel Feed database schema, storing:

- Original article content
- Translations in all supported languages
- Source language metadata
- Article metadata (source, published date, images)

## Development

### Local Testing

```bash
# Test single aggregation run
bun src/index.ts once

# Start development server with file watching
bun run dev
```

### Configuration Testing

```bash
# Validate providers and translation config
bun src/index.ts status
```

## Production Deployment

For production use:

1. Set up environment variables
2. Configure database connection
3. Set appropriate aggregation intervals
4. Monitor logs for errors
5. Set up process management (PM2, systemd, etc.)

## Cost Optimization

- Uses only free OpenRouter models
- Intelligent rate limiting
- Batch processing
- Configurable limits on articles per provider
- Efficient duplicate detection

## Monitoring

The service logs:
- Aggregation progress
- Translation status
- Database operations
- Error conditions
- Performance metrics

## Troubleshooting

### Common Issues

1. **Translation API Errors**: Check OpenRouter API key and rate limits
2. **Database Connection**: Verify database credentials and connectivity
3. **RSS Feed Errors**: Some providers may have temporary outages
4. **Memory Usage**: Adjust batch sizes for large-scale operations

### Debug Mode

Enable verbose logging by setting `DEBUG=true` environment variable.

## Future Enhancements

- Support for additional news sources
- Enhanced content extraction (images, videos)
- Real-time translation quality assessment
- Content categorization and filtering
- Advanced duplicate detection
- Performance metrics dashboard