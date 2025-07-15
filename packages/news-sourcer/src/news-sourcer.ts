import axios from 'axios'
import { load } from 'cheerio'
import { AiProviderManager } from '@babel-feed/llm-provider'
import { logger } from '@babel-feed/utils'
import type { SourceEndpoint, LlmProviderClient } from './types.js'

export class NewsSourcer {
  constructor(private llm: LlmProviderClient = new AiProviderManager()) {}

  async initialize(): Promise<void> {
    await this.llm.initialize()
  }

  async analyzeSource(url: string): Promise<SourceEndpoint[]> {
    const res = await axios.get(url, { timeout: 10000 })
    const html: string = res.data
    const $ = load(html)
    // Remove script/style to keep prompt short
    $('script, style').remove()
    const snippet = $.html().slice(0, 4000)

    const providers = await this.llm.getEnabledProviders('translation')
    for (const provider of providers) {
      try {
        const output = await this.llm.executeWithProvider(provider.id, async (p, key) => {
          const { OpenAI } = await import('openai')
          const client = new OpenAI({ apiKey: key.apiKey || key.keyValue, baseURL: p.baseUrl })
          const result = await client.chat.completions.create({
            model: p.metadata?.models?.[0] || 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a web crawling expert. Extract RSS feed URLs or HTML list pages for news articles. Respond ONLY with JSON.' },
              { role: 'user', content: `Website: ${url}\nHTML:\n${snippet}` }
            ]
          })
          return result.choices[0]?.message?.content?.trim() || ''
        })
        const endpoints: SourceEndpoint[] = JSON.parse(output)
        if (Array.isArray(endpoints) && endpoints.length > 0) return endpoints
      } catch (error) {
        logger.warn(`Provider ${provider.name} failed analysis:`, error)
      }
    }
    throw new Error('All providers failed to analyze source')
  }
}
