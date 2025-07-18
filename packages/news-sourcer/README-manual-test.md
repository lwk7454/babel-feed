# Manual Testing Guide for News Sourcer

This guide explains how to run the news-sourcer manually to test website URL analysis and database record creation.

## Prerequisites

1. **Database Setup**: Make sure you have a PostgreSQL database running and set the required environment variables:
   ```bash
   # Option 1: Use DATABASE_URL (for the news-sourcer)
   export DATABASE_URL="postgresql://babel_dev:babel_dev_password@localhost:5432/babel_feed_dev"
   
   # Option 2: Use individual variables (for migrations)
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_USER=babel_dev
   export DB_PASSWORD=babel_dev_password
   export DB_NAME=babel_feed_dev
   ```

2. **Dependencies**: Ensure all dependencies are installed:
   ```bash
   bun install
   ```

3. **Database Migrations**: Run database migrations to ensure the schema is up to date:
   ```bash
   # From the workspace root
   bun run nx run pgdb:migrate
   
   # Or manually from the pgdb package
   cd packages/pgdb
   bun run drizzle-kit migrate --config=drizzle.config.cjs
   ```

## Running the Manual Test

### Basic Usage

```bash
# From the news-sourcer package directory
cd packages/news-sourcer

# Run the test script with a URL
bun run test-manual.ts https://example.com
```

### Example Commands

```bash
# Test a news website with RSS feeds
bun run test-manual.ts https://feeds.bbci.co.uk/news/rss.xml

# Test a news website that might need HTML analysis
bun run test-manual.ts https://www.bbc.com/news

# Test a blog or news site
bun run test-manual.ts https://techcrunch.com
```

## What the Test Does

The manual test script performs the following steps:

1. **Initialization**: Sets up the NewsSourcer with appropriate configuration
2. **RSS/Atom Discovery**: Searches for RSS and Atom feeds on the website
3. **Feed Validation**: Validates discovered feeds and extracts sample article URLs
4. **HTML Analysis** (if no RSS feeds found): Uses LLM to analyze HTML structure
5. **Database Operations**: Creates database records for discovered endpoints
6. **Performance Metrics**: Shows HTTP request metrics and circuit breaker status

## Expected Output

The script will output detailed information about:

- **Feed Discovery**: Number of RSS/Atom feeds found
- **Validation Results**: Which feeds are valid and contain articles
- **HTML Analysis**: If applicable, shows discovered endpoints with CSS selectors
- **Database Records**: Confirms creation of endpoint records in the database
- **Performance Metrics**: HTTP request counts, response times, and protection status

## Troubleshooting

### Common Issues

1. **Database Connection Error**:
   - Ensure `DATABASE_URL` is set correctly
   - Check that PostgreSQL is running
   - Verify database exists and migrations are applied

2. **LLM Provider Error** (for HTML analysis):
   - Ensure LLM provider configuration is set up
   - Check API keys for AI providers

3. **Network Timeout**:
   - The script uses reasonable timeouts (10 seconds)
   - Some websites may be slow to respond

### Environment Variables

The following environment variables may be needed:

```bash
# Required for database connection
export DATABASE_URL="postgresql://username:password@localhost:5432/babel_feed"

# Optional: For LLM analysis (if testing HTML analysis)
export OPENROUTER_API_KEY="your-api-key"
export OPENAI_API_KEY="your-api-key"

# Optional: For debugging
export DB_DEBUG="true"
export NODE_ENV="development"
```

## Database Schema

The test creates records in the following tables:

- `news_sources`: News source information
- `source_endpoints`: Discovered RSS/Atom feeds and HTML endpoints
- `articles`: Article metadata (for testing)

## Next Steps

After running the manual test:

1. **Verify Database Records**: Check that endpoints were created correctly
2. **Test Endpoint Validation**: Use the `validateEndpoint` method to test specific endpoints
3. **Monitor Performance**: Use the metrics collection to monitor endpoint reliability
4. **Integration Testing**: Test the endpoints with the news-aggregator

## Example Database Queries

After running the test, you can verify the results with these queries:

```sql
-- Check created endpoints
SELECT * FROM source_endpoints ORDER BY created_at DESC LIMIT 5;

-- Check news sources
SELECT * FROM news_sources ORDER BY created_at DESC LIMIT 5;

-- Check articles
SELECT * FROM articles ORDER BY created_at DESC LIMIT 5;
``` 