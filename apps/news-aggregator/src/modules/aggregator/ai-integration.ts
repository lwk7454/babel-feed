import { logger } from '../common/logger'
import { AiProviderManager } from '../../services/ai-provider-manager'
import { CacheManager } from '../../services/cache-manager'

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

    const url = 'https://libretranslate.de/translate'
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: content, source: 'auto', target: targetLanguage, format: 'text' })
    })
    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`)
    }
    const data = await response.json()
    const translated = data.translatedText as string
    await this.translationCache.set(cacheKey, translated)
    return translated
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

  async detectTrends(articles: any[]): Promise<any[]> {
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
