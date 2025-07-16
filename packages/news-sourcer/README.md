# @babel-feed/news-sourcer

`news-sourcer` performs automated source discovery and builds an extraction pipeline for each news site. It is **not** responsible for parsing article content—that is handled by `news-extractor`. Instead, this package discovers how a site publishes new articles and saves a reproducible guide that later produces a list of article URLs.

## Requirements

- Accept a news website URL and learn how that site organises its articles.
- Prefer RSS feeds when available.
- If no feeds exist, create a repeatable HTML crawling plan.
- Use the LLM directly (no heuristics) to inspect pages and generate selectors, pagination hints and other metadata.
- The LLM may make several calls per site, effectively acting as an agent that browses the website until it understands the layout.
- Store all knowledge in the database so that the aggregator can run the guide later without LLM involvement.
- Support multiple endpoints per source, such as separate feeds or category pages.

## Implementation Plan

1. **Database Schema**
   - Add a new `source_endpoints` table linked to `news_sources`.
   - Fields: `endpoint_url`, `type` (`rss`, `html`, `json`, ...), `category`, CSS selector or script, pagination hints, polling interval and reliability metrics.
   - Keep a versioned `script` or `metadata` column to store the LLM produced instructions used to fetch article URLs.

2. **Agentic Source Analysis**
   - Implement a `NewsSourcer` class that repeatedly fetches pages and invokes the LLM until reliable endpoints are produced.
   - The LLM receives trimmed HTML and returns candidate endpoints with the required selectors or scripts.
   - Validate endpoints by running them and ensuring the resulting pages contain article links; `news-extractor` can be used for spot checks.

3. **Pipeline Construction**
   - For each valid endpoint, save the necessary metadata and script to the database.
   - Multiple endpoints can belong to the same source so that category feeds or pages are handled individually.

4. **Integration**
   - The aggregator queries `source_endpoints` on a schedule and uses the saved scripts or selectors to fetch fresh article URLs.
   - The URLs are passed to `news-extractor` for detailed parsing.

This design allows `news-sourcer` to operate automatically in messy real-world scenarios while keeping long-term extraction logic stored in the database.
