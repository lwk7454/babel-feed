# @babel-feed/news-sourcer

This package implements automated news source discovery. It runs separately from
`news-extractor` and learns how to fetch article URLs from each website.

## Requirements

- Accept a news website URL and determine how it publishes new articles.
- Prefer RSS feeds when available. If none exist, use HTML crawling.
- Use LLM calls to inspect page structure and produce extraction hints
  (CSS selectors, pagination info, etc.). Do **not** rely solely on heuristics.
- Persist discovered endpoints in the database so the aggregator can poll them.
- Multiple endpoints may exist per source (different categories or feeds).

## Implementation Plan

1. **Database Schema**
   - Add a `source_endpoints` table referencing `news_sources`.
   - Fields include endpoint URL, type (`rss` or `html`), optional category,
     CSS selector, polling interval, reliability and priority scores.

2. **LLM Driven Analysis**
   - Create a `NewsSourcer` class which fetches a homepage and sends trimmed HTML
     to the `AiProviderManager`.
   - The LLM returns a JSON list of endpoints with selectors when needed.
   - The class validates the response and stores it using `pgdb` helpers.

3. **Integration**
   - The news aggregator will query `source_endpoints` instead of raw URLs.
   - `news-extractor` receives article URLs gathered via these endpoints.

This package will evolve as we refine the discovery workflow.
