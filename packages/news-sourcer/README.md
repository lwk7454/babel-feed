# @babel-feed/news-sourcer

`news-sourcer` automatically discovers how a news website publishes new articles and stores a repeatable guide for fetching article URLs. It does **not** parse article pages—`news-extractor` handles that part.

## Purpose

- Build a per-site extraction pipeline so `news-aggregator` can fetch article lists without worrying about each site's layout.
- Use an agentic LLM workflow that makes multiple calls and browses pages directly. No heuristics.
- Prefer RSS or Atom feeds when available, otherwise learn how to crawl HTML list pages.
- Persist all knowledge in the database so later runs do not require another LLM call.

## Requirements

- Accept a news website URL and figure out how the site organises its articles.
- If feeds exist, record each feed as an endpoint.
- If only HTML pages exist, ask the LLM to produce CSS selectors or a small script for collecting article links, including pagination hints.
- Support multiple endpoints per site (e.g. separate categories).
- Track reliability metrics and polling intervals for each endpoint.

## Implementation Plan

1. **Database Schema**
   - Add a `source_endpoints` table linked to `news_sources.id`.
   - Fields include `endpoint_url`, `type` (`rss`, `html`, etc.), `category`, `link_selector`, `polling_interval`, `reliability`, `priority`, and `metadata` for the LLM-produced script.
   - Maintain success and error counts plus last fetch timestamps.
   - Optionally keep a `discovered_sources` table for new domains awaiting approval.

2. **Agentic Analysis**
   - Implement a `NewsSourcer` class that repeatedly fetches pages and sends trimmed HTML to the LLM.
   - The LLM proposes endpoints. `NewsSourcer` validates each by crawling and ensuring the result contains article URLs.
   - Continue calling the LLM until a reliable set of endpoints is produced.

3. **Pipeline Construction**
   - Store validated endpoints in `source_endpoints` with their selectors or script.
   - Allow multiple endpoints per source so the crawler can follow several feeds or category pages.
   - Periodically re-run analysis to adapt when site layouts change.

4. **Integration with Aggregator**
   - `news-aggregator` polls `source_endpoints` on a schedule and uses the stored instructions to obtain fresh article URLs.
   - These URLs are then passed to `news-extractor` for content parsing.
   - Reliability metrics from each run update the corresponding endpoint records.

This design avoids brittle heuristics and keeps long-term crawling logic in the database, allowing autonomous source discovery and robust article extraction.
