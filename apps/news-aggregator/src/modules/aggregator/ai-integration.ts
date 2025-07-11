import { logger } from '@babel-feed/utils'
import { AiProviderManager } from '@babel-feed/llm-provider'
import { CacheManager } from '../../services/cache-manager'
import { RawArticle } from '../common/types'

export class AIIntegrationService {
  private translationCache = CacheManager.createTranslationCache()
  constructor(private aiProviders = new AiProviderManager()) {}

  async initialize(): Promise<void> {
    await this.aiProviders.initialize()
    logger.info('AI integration service initialized')
  }

  async translateContent(content: string, targetLanguage: string): Promise<string> {
    const cacheKey = `${targetLanguage}:${content}`
    const cached = await this.translationCache.get(cacheKey)
    if (cached) return cached

    const providers = await this.aiProviders.getEnabledProviders('translation')
    for (const provider of providers) {
      try {
        const translated = await this.aiProviders.executeWithProvider(provider.id, async (p, key) => {
          const { OpenAI } = await import('openai')
          const client = new OpenAI({ apiKey: key.apiKey || key.keyValue, baseURL: p.baseUrl })
          const res = await client.chat.completions.create({
            model: p.metadata?.models?.[0] || 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: `Translate the following text to ${targetLanguage}` },
              { role: 'user', content }
            ]
          })
          return res.choices[0]?.message?.content?.trim() || ''
        })
        if (translated) {
          await this.translationCache.set(cacheKey, translated)
          return translated
        }
      } catch (error) {
        logger.warn(`Provider ${provider.name} failed translation:`, error)
      }
    }
    throw new Error('All translation providers failed')
  }

  async summarizeArticle(content: string): Promise<string> {
    const sentences = content
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0)

    const summary = sentences.slice(0, 2).join(' ')
    return sentences.length > 2 ? summary + '…' : summary
  }

  async tagContent(content: string): Promise<string[]> {
    const words = (content.toLowerCase().match(/[a-z]{4,}/g) || [])
    const freq: Record<string, number> = {}
    for (const w of words) freq[w] = (freq[w] || 0) + 1
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w)
  }

  async analyzeSentiment(content: string): Promise<'positive' | 'negative' | 'neutral'> {
    const positive = /(good|great|excellent|positive|love)/i
    const negative = /(bad|terrible|poor|hate|negative)/i
    if (positive.test(content)) return 'positive'
    if (negative.test(content)) return 'negative'
    return 'neutral'
  }

  async categorizeContent(content: string): Promise<string> {
    if (/\b(sports?|football|soccer)\b/i.test(content)) return 'sports'
    if (/\b(politics?|government|election)\b/i.test(content)) return 'politics'
    if (/\b(technology|tech|software|hardware)\b/i.test(content)) return 'technology'
    return 'general'
  }

  async detectTrends(articles: RawArticle[]): Promise<Array<[string, number]>> {
    const counts: Record<string, number> = {}
    for (const a of articles) {
      (a.tags || []).forEach((t: string) => {
        counts[t] = (counts[t] || 0) + 1
      })
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }

  getAiProviderManager() {
    return this.aiProviders
  }}
