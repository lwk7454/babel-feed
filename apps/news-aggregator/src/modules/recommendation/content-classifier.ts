import { logger } from '@babel-feed/utils'
import { AiProviderManager } from '@babel-feed/llm-provider'

export interface ContentTag {
  id: string
  label: string
  category: string
  level: number
  parentId?: string
  confidence: number
  metadata?: Record<string, unknown>
}

export interface ClassificationResult {
  hierarchicalTags: ContentTag[]
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentScore: number
  geographic: GeographicTag[]
  industry: IndustryTag[]
  topicScores: Record<string, number>
}

export interface GeographicTag {
  type: 'country' | 'region' | 'city'
  name: string
  code?: string
  confidence: number
}

export interface IndustryTag {
  sector: string
  subsector?: string
  confidence: number
}

export class ContentClassifier {
  private aiProviders: AiProviderManager

  // Hierarchical tag taxonomy
  private readonly TOPIC_HIERARCHY = {
    'news': {
      'politics': ['elections', 'government', 'policy', 'legislation', 'diplomacy'],
      'business': ['finance', 'markets', 'economy', 'companies', 'startups'],
      'technology': ['ai', 'software', 'hardware', 'cybersecurity', 'innovation'],
      'science': ['research', 'health', 'environment', 'space', 'medicine'],
      'sports': ['football', 'basketball', 'olympics', 'soccer', 'tennis'],
      'entertainment': ['movies', 'music', 'tv', 'celebrities', 'culture'],
      'lifestyle': ['travel', 'food', 'fashion', 'wellness', 'family']
    }
  }

  private readonly GEOGRAPHIC_PATTERNS = {
    countries: ['usa', 'china', 'japan', 'germany', 'france', 'uk', 'canada', 'australia'],
    regions: ['asia', 'europe', 'africa', 'americas', 'middle east', 'oceania'],
    cities: ['new york', 'london', 'tokyo', 'paris', 'shanghai', 'hong kong']
  }

  private readonly INDUSTRY_SECTORS = {
    'technology': ['software', 'hardware', 'telecommunications', 'internet'],
    'finance': ['banking', 'investment', 'insurance', 'fintech'],
    'healthcare': ['pharmaceuticals', 'biotechnology', 'medical devices'],
    'energy': ['oil', 'gas', 'renewable', 'nuclear'],
    'automotive': ['cars', 'electric vehicles', 'autonomous driving'],
    'retail': ['e-commerce', 'fashion', 'consumer goods'],
    'media': ['broadcasting', 'publishing', 'social media', 'streaming']
  }

  constructor(aiProviders?: AiProviderManager) {
    this.aiProviders = aiProviders || new AiProviderManager()
  }

  async initialize(): Promise<void> {
    await this.aiProviders.initialize()
    logger.info('Content classifier initialized')
  }

  async classifyContent(title: string, content: string, summary?: string): Promise<ClassificationResult> {
    const text = `${title}\n\n${summary || ''}\n\n${content}`.slice(0, 4000)
    
    const [hierarchicalTags, sentiment, geographic, industry] = await Promise.all([
      this.extractHierarchicalTags(text),
      this.analyzeSentiment(text),
      this.extractGeographicTags(text),
      this.extractIndustryTags(text)
    ])

    const topicScores = this.calculateTopicScores(hierarchicalTags)

    return {
      hierarchicalTags,
      sentiment: sentiment.sentiment,
      sentimentScore: sentiment.score,
      geographic,
      industry,
      topicScores
    }
  }

  private async extractHierarchicalTags(text: string): Promise<ContentTag[]> {
    try {
      // Use AI for sophisticated tagging
      const aiTags = await this.getAITags(text)
      
      // Combine with rule-based tagging
      const ruleTags = this.getRuleBasedTags(text)
      
      // Merge and deduplicate
      const allTags = [...aiTags, ...ruleTags]
      return this.deduplicateTags(allTags)
    } catch (error) {
      logger.warn('AI tagging failed, falling back to rule-based', error)
      return this.getRuleBasedTags(text)
    }
  }

  private async getAITags(text: string): Promise<ContentTag[]> {
    const providers = await this.aiProviders.getEnabledProviders('general')
    
    for (const provider of providers) {
      try {
        const result = await this.aiProviders.executeWithProvider(provider.id, async (p, key) => {
          const { OpenAI } = await import('openai')
          const client = new OpenAI({ apiKey: key.apiKey || key.keyValue, baseURL: p.baseUrl })
          
          const prompt = `Analyze this news article and extract hierarchical tags. Return a JSON array of tags with format:
[{"category": "main_category", "label": "specific_tag", "level": 1-3, "confidence": 0.0-1.0}]

Categories: politics, business, technology, science, sports, entertainment, lifestyle
Levels: 1=broad category, 2=subcategory, 3=specific topic

Text: ${text.slice(0, 2000)}`

          const res = await client.chat.completions.create({
            model: p.metadata?.models?.[0] || 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are an expert content classifier. Return only valid JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 500
          })
          
          const content = res.choices[0]?.message?.content?.trim()
          if (!content) return []
          
          try {
            const parsed = JSON.parse(content)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })
        
        if (result && result.length > 0) {
          return result.map((tag: { label?: string; category?: string; level?: number; confidence?: number }, index: number) => ({
            id: `ai-${index}`,
            label: tag.label || '',
            category: tag.category || 'general',
            level: tag.level || 1,
            confidence: tag.confidence || 0.5
          }))
        }
      } catch (error) {
        logger.warn(`AI provider ${provider.name} failed for tagging:`, error)
      }
    }
    
    return []
  }

  private getRuleBasedTags(text: string): ContentTag[] {
    const tags: ContentTag[] = []
    const lowerText = text.toLowerCase()
    
    let tagId = 0
    
    // Level 1: Main categories
    for (const [mainCategory, subcategories] of Object.entries(this.TOPIC_HIERARCHY.news)) {
      const categoryKeywords = [mainCategory, ...Object.keys(subcategories)]
      const categoryRegex = new RegExp(`\\b(${categoryKeywords.join('|')})\\b`, 'gi')
      const matches = lowerText.match(categoryRegex) || []
      
      if (matches.length > 0) {
        const confidence = Math.min(matches.length * 0.2, 1.0)
        tags.push({
          id: `rule-${tagId++}`,
          label: mainCategory,
          category: 'topic',
          level: 1,
          confidence
        })
        
        // Level 2: Subcategories
        for (const [subCategory, keywords] of Object.entries(subcategories)) {
          if (!Array.isArray(keywords)) continue
          const subRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi')
          const subMatches = lowerText.match(subRegex) || []
          
          if (subMatches.length > 0) {
            const subConfidence = Math.min(subMatches.length * 0.3, 1.0)
            tags.push({
              id: `rule-${tagId++}`,
              label: subCategory,
              category: 'topic',
              level: 2,
              parentId: `rule-${tagId - 2}`,
              confidence: subConfidence
            })
            
            // Level 3: Specific keywords
            for (const keyword of keywords) {
              if (lowerText.includes(keyword)) {
                tags.push({
                  id: `rule-${tagId++}`,
                  label: keyword,
                  category: 'topic',
                  level: 3,
                  parentId: `rule-${tagId - 2}`,
                  confidence: 0.8
                })
              }
            }
          }
        }
      }
    }
    
    return tags
  }

  private async analyzeSentiment(text: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral', score: number }> {
    try {
      // Try AI-powered sentiment analysis first
      const aiSentiment = await this.getAISentiment(text)
      if (aiSentiment) return aiSentiment
    } catch (error) {
      logger.warn('AI sentiment analysis failed, using rule-based', error)
    }
    
    // Fallback to rule-based sentiment
    return this.getRuleBasedSentiment(text)
  }

  private async getAISentiment(text: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral', score: number } | null> {
    const providers = await this.aiProviders.getEnabledProviders('general')
    
    for (const provider of providers) {
      try {
        const result = await this.aiProviders.executeWithProvider(provider.id, async (p, key) => {
          const { OpenAI } = await import('openai')
          const client = new OpenAI({ apiKey: key.apiKey || key.keyValue, baseURL: p.baseUrl })
          
          const res = await client.chat.completions.create({
            model: p.metadata?.models?.[0] || 'gpt-3.5-turbo',
            messages: [
              { 
                role: 'system', 
                content: 'Analyze sentiment and return JSON: {"sentiment": "positive|negative|neutral", "score": 0.0-1.0}' 
              },
              { role: 'user', content: `Analyze sentiment of: ${text.slice(0, 1000)}` }
            ],
            temperature: 0.1,
            max_tokens: 100
          })
          
          const content = res.choices[0]?.message?.content?.trim()
          if (!content) return null
          
          try {
            return JSON.parse(content)
          } catch {
            return null
          }
        })
        
        if (result && result.sentiment) {
          return result
        }
      } catch (error) {
        logger.warn(`AI provider ${provider.name} failed for sentiment:`, error)
      }
    }
    
    return null
  }

  private getRuleBasedSentiment(text: string): { sentiment: 'positive' | 'negative' | 'neutral', score: number } {
    const positive = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'success', 'win', 'positive', 'growth', 'improve']
    const negative = ['bad', 'terrible', 'awful', 'horrible', 'failure', 'lose', 'negative', 'decline', 'crisis', 'problem']
    
    const lowerText = text.toLowerCase()
    let positiveScore = 0
    let negativeScore = 0
    
    for (const word of positive) {
      const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length
      positiveScore += matches
    }
    
    for (const word of negative) {
      const matches = (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length
      negativeScore += matches
    }
    
    const total = positiveScore + negativeScore
    if (total === 0) return { sentiment: 'neutral', score: 0.5 }
    
    const ratio = positiveScore / total
    
    if (ratio > 0.6) return { sentiment: 'positive', score: ratio }
    if (ratio < 0.4) return { sentiment: 'negative', score: 1 - ratio }
    return { sentiment: 'neutral', score: 0.5 }
  }

  private extractGeographicTags(text: string): GeographicTag[] {
    const tags: GeographicTag[] = []
    const lowerText = text.toLowerCase()
    
    // Countries
    for (const country of this.GEOGRAPHIC_PATTERNS.countries) {
      if (lowerText.includes(country)) {
        const matches = (lowerText.match(new RegExp(`\\b${country}\\b`, 'g')) || []).length
        tags.push({
          type: 'country',
          name: country,
          confidence: Math.min(matches * 0.3, 1.0)
        })
      }
    }
    
    // Regions
    for (const region of this.GEOGRAPHIC_PATTERNS.regions) {
      if (lowerText.includes(region)) {
        const matches = (lowerText.match(new RegExp(`\\b${region}\\b`, 'g')) || []).length
        tags.push({
          type: 'region',
          name: region,
          confidence: Math.min(matches * 0.2, 1.0)
        })
      }
    }
    
    // Cities
    for (const city of this.GEOGRAPHIC_PATTERNS.cities) {
      if (lowerText.includes(city)) {
        const matches = (lowerText.match(new RegExp(`\\b${city}\\b`, 'g')) || []).length
        tags.push({
          type: 'city',
          name: city,
          confidence: Math.min(matches * 0.4, 1.0)
        })
      }
    }
    
    return tags.sort((a, b) => b.confidence - a.confidence)
  }

  private extractIndustryTags(text: string): IndustryTag[] {
    const tags: IndustryTag[] = []
    const lowerText = text.toLowerCase()
    
    for (const [sector, subsectors] of Object.entries(this.INDUSTRY_SECTORS)) {
      const sectorRegex = new RegExp(`\\b${sector}\\b`, 'gi')
      const sectorMatches = (lowerText.match(sectorRegex) || []).length
      
      if (sectorMatches > 0) {
        tags.push({
          sector,
          confidence: Math.min(sectorMatches * 0.3, 1.0)
        })
      }
      
      for (const subsector of subsectors) {
        const subsectorRegex = new RegExp(`\\b${subsector}\\b`, 'gi')
        const subsectorMatches = (lowerText.match(subsectorRegex) || []).length
        
        if (subsectorMatches > 0) {
          tags.push({
            sector,
            subsector,
            confidence: Math.min(subsectorMatches * 0.4, 1.0)
          })
        }
      }
    }
    
    return tags.sort((a, b) => b.confidence - a.confidence)
  }

  private calculateTopicScores(tags: ContentTag[]): Record<string, number> {
    const scores: Record<string, number> = {}
    
    for (const tag of tags) {
      const weight = tag.level === 1 ? 3 : tag.level === 2 ? 2 : 1
      const score = tag.confidence * weight
      scores[tag.label] = (scores[tag.label] || 0) + score
    }
    
    // Normalize scores
    const maxScore = Math.max(...Object.values(scores))
    if (maxScore > 0) {
      for (const key of Object.keys(scores)) {
        scores[key] = scores[key] / maxScore
      }
    }
    
    return scores
  }

  private deduplicateTags(tags: ContentTag[]): ContentTag[] {
    const seen = new Set<string>()
    const result: ContentTag[] = []
    
    for (const tag of tags.sort((a, b) => b.confidence - a.confidence)) {
      const key = `${tag.category}:${tag.label}:${tag.level}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(tag)
      }
    }
    
    return result
  }
}