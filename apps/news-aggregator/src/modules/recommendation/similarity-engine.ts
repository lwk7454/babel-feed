import { logger } from '@babel-feed/utils'
import { AiProviderManager } from '@babel-feed/llm-provider'
import { ContentSimilarity } from './types'

export interface SimilarityVector {
  articleId: string
  titleVector: number[]
  contentVector: number[]
  tagVector: number[]
  compositeVector: number[]
  metadata: {
    language: string
    category: string
    wordCount: number
    publishedAt: Date
  }
}

export interface SimilarityResult {
  similarity: number
  type: 'semantic' | 'topic' | 'entity' | 'collaborative'
  features: Record<string, number>
  explanation: string
}

export class SimilarityEngine {
  private aiProviders: AiProviderManager
  private vectorCache = new Map<string, SimilarityVector>()
  
  // Pre-computed word embeddings for common terms (simplified)
  private readonly WORD_EMBEDDINGS: Record<string, number[]> = {
    'politics': [0.2, 0.8, 0.1, 0.3, 0.6],
    'technology': [0.9, 0.1, 0.7, 0.2, 0.4],
    'business': [0.4, 0.6, 0.3, 0.8, 0.2],
    'sports': [0.1, 0.3, 0.9, 0.2, 0.7],
    'science': [0.7, 0.2, 0.4, 0.9, 0.1],
    'entertainment': [0.3, 0.7, 0.2, 0.1, 0.9]
  }

  constructor(aiProviders?: AiProviderManager) {
    this.aiProviders = aiProviders || new AiProviderManager()
  }

  async initialize(): Promise<void> {
    await this.aiProviders.initialize()
    logger.info('Similarity engine initialized')
  }

  async computeContentVector(
    articleId: string,
    title: string,
    content: string,
    tags: string[],
    metadata: { language: string; category: string; publishedAt: Date }
  ): Promise<SimilarityVector> {
    // Check cache first
    const cached = this.vectorCache.get(articleId)
    if (cached) return cached

    try {
      // Try AI-powered embeddings first
      const aiVector = await this.getAIEmbeddings(title, content)
      if (aiVector) {
        const vector: SimilarityVector = {
          articleId,
          titleVector: aiVector.title,
          contentVector: aiVector.content,
          tagVector: this.computeTagVector(tags),
          compositeVector: this.createCompositeVector(aiVector.title, aiVector.content, this.computeTagVector(tags)),
          metadata: { ...metadata, wordCount: content.split(/\s+/).length }
        }
        this.vectorCache.set(articleId, vector)
        return vector
      }
    } catch (error) {
      logger.warn('AI embeddings failed, using fallback method', error)
    }

    // Fallback to rule-based embeddings
    const titleVector = this.computeTextVector(title)
    const contentVector = this.computeTextVector(content)
    const tagVector = this.computeTagVector(tags)
    const compositeVector = this.createCompositeVector(titleVector, contentVector, tagVector)

    const vector: SimilarityVector = {
      articleId,
      titleVector,
      contentVector,
      tagVector,
      compositeVector,
      metadata: { ...metadata, wordCount: content.split(/\s+/).length }
    }

    this.vectorCache.set(articleId, vector)
    return vector
  }

  async computeSimilarity(vector1: SimilarityVector, vector2: SimilarityVector): Promise<SimilarityResult> {
    // Compute multiple similarity types
    const semanticSim = this.cosineSimilarity(vector1.compositeVector, vector2.compositeVector)
    const topicSim = this.cosineSimilarity(vector1.tagVector, vector2.tagVector)
    const titleSim = this.cosineSimilarity(vector1.titleVector, vector2.titleVector)
    const contentSim = this.cosineSimilarity(vector1.contentVector, vector2.contentVector)
    
    // Entity similarity (based on common entities)
    const entitySim = this.computeEntitySimilarity(vector1, vector2)
    
    // Time-based similarity
    const timeSim = this.computeTemporalSimilarity(vector1.metadata.publishedAt, vector2.metadata.publishedAt)
    
    // Category similarity
    const categorySim = vector1.metadata.category === vector2.metadata.category ? 1.0 : 0.0
    
    // Language similarity
    const languageSim = vector1.metadata.language === vector2.metadata.language ? 1.0 : 0.0

    // Weighted composite score
    const weights = {
      semantic: 0.3,
      topic: 0.25,
      title: 0.15,
      content: 0.15,
      entity: 0.05,
      temporal: 0.05,
      category: 0.03,
      language: 0.02
    }

    const compositeScore = 
      semanticSim * weights.semantic +
      topicSim * weights.topic +
      titleSim * weights.title +
      contentSim * weights.content +
      entitySim * weights.entity +
      timeSim * weights.temporal +
      categorySim * weights.category +
      languageSim * weights.language

    // Determine primary similarity type
    const similarities = { semantic: semanticSim, topic: topicSim, entity: entitySim }
    const primaryType = Object.entries(similarities).reduce((a, b) => a[1] > b[1] ? a : b)[0] as 'semantic' | 'topic' | 'entity'

    return {
      similarity: compositeScore,
      type: primaryType,
      features: {
        semantic: semanticSim,
        topic: topicSim,
        title: titleSim,
        content: contentSim,
        entity: entitySim,
        temporal: timeSim,
        category: categorySim,
        language: languageSim
      },
      explanation: this.generateSimilarityExplanation(compositeScore, primaryType, {
        semantic: semanticSim,
        topic: topicSim,
        category: categorySim
      })
    }
  }

  async findSimilarArticles(targetVector: SimilarityVector, candidateVectors: SimilarityVector[], limit = 10): Promise<Array<{ articleId: string; similarity: SimilarityResult }>> {
    const similarities: Array<{ articleId: string; similarity: SimilarityResult }> = []

    for (const candidate of candidateVectors) {
      if (candidate.articleId === targetVector.articleId) continue
      
      const similarity = await this.computeSimilarity(targetVector, candidate)
      similarities.push({ articleId: candidate.articleId, similarity })
    }

    // Sort by similarity score and apply diversity filters
    return similarities
      .sort((a, b) => b.similarity.similarity - a.similarity.similarity)
      .slice(0, limit * 2) // Get more candidates for diversity filtering
      .filter((item, index, array) => {
        // Diversity filter: avoid too many articles from same category
        const sameCategory = array.slice(0, index).filter(other => 
          candidateVectors.find(v => v.articleId === other.articleId)?.metadata.category === 
          candidateVectors.find(v => v.articleId === item.articleId)?.metadata.category
        ).length
        return sameCategory < 3 // Max 3 articles per category
      })
      .slice(0, limit)
  }

  private async getAIEmbeddings(title: string, content: string): Promise<{ title: number[]; content: number[] } | null> {
    const providers = await this.aiProviders.getEnabledProviders('general')
    
    for (const provider of providers) {
      try {
        const result = await this.aiProviders.executeWithProvider(provider.id, async (p, key) => {
          // Check if provider supports embeddings
          if (!p.metadata?.supportsEmbeddings) return null
          
          const { OpenAI } = await import('openai')
          const client = new OpenAI({ apiKey: key.apiKey || key.keyValue, baseURL: p.baseUrl })
          
          // Get embeddings for title and content
          const titleEmbedding = await client.embeddings.create({
            model: (p.metadata?.embeddingModel as string) || 'text-embedding-ada-002',
            input: title.slice(0, 500)
          })
          
          const contentEmbedding = await client.embeddings.create({
            model: (p.metadata?.embeddingModel as string) || 'text-embedding-ada-002',
            input: content.slice(0, 2000)
          })
          
          return {
            title: titleEmbedding.data[0]?.embedding || [],
            content: contentEmbedding.data[0]?.embedding || []
          }
        })
        
        if (result && result.title.length > 0 && result.content.length > 0) {
          return result
        }
      } catch (error) {
        logger.warn(`AI provider ${provider.name} failed for embeddings:`, error)
      }
    }
    
    return null
  }

  private computeTextVector(text: string): number[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)

    // Simple TF-IDF-like vector (5 dimensions for simplicity)
    const vector = new Array(5).fill(0)
    const wordCounts: Record<string, number> = {}
    
    // Count word frequencies
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1
    }
    
    // Map words to vector dimensions using hash
    for (const [word, count] of Object.entries(wordCounts)) {
      const hash = this.simpleHash(word) % 5
      vector[hash] += count / words.length
      
      // Add semantic meaning for known words
      if (this.WORD_EMBEDDINGS[word]) {
        for (let i = 0; i < 5; i++) {
          vector[i] += this.WORD_EMBEDDINGS[word][i] * count / words.length
        }
      }
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector
  }

  private computeTagVector(tags: string[]): number[] {
    const vector = new Array(5).fill(0)
    
    for (const tag of tags) {
      if (this.WORD_EMBEDDINGS[tag.toLowerCase()]) {
        const embedding = this.WORD_EMBEDDINGS[tag.toLowerCase()]
        for (let i = 0; i < 5; i++) {
          vector[i] += embedding[i] / tags.length
        }
      } else {
        // Fallback to hash-based positioning
        const hash = this.simpleHash(tag) % 5
        vector[hash] += 1 / tags.length
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector
  }

  private createCompositeVector(titleVector: number[], contentVector: number[], tagVector: number[]): number[] {
    const weights = { title: 0.4, content: 0.4, tags: 0.2 }
    const composite = new Array(5).fill(0)
    
    for (let i = 0; i < 5; i++) {
      composite[i] = 
        titleVector[i] * weights.title +
        contentVector[i] * weights.content +
        tagVector[i] * weights.tags
    }
    
    return composite
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0
    
    let dotProduct = 0
    let magnitude1 = 0
    let magnitude2 = 0
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      magnitude1 += vec1[i] * vec1[i]
      magnitude2 += vec2[i] * vec2[i]
    }
    
    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2)
    return magnitude > 0 ? dotProduct / magnitude : 0
  }

  private computeEntitySimilarity(vector1: SimilarityVector, vector2: SimilarityVector): number {
    // Simple entity extraction based on capitalized words
    const extractEntities = (text: string) => {
      return text.match(/\b[A-Z][a-z]+\b/g) || []
    }
    
    // This would normally come from the article content, but we'll approximate
    const entities1 = new Set([vector1.metadata.category])
    const entities2 = new Set([vector2.metadata.category])
    
    const intersection = new Set(Array.from(entities1).filter(x => entities2.has(x)))
    const union = new Set([...Array.from(entities1), ...Array.from(entities2)])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  private computeTemporalSimilarity(date1: Date, date2: Date): number {
    const hoursDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60)
    
    // Exponential decay: articles published close together are more similar
    return Math.exp(-hoursDiff / 24) // 24-hour half-life
  }

  private generateSimilarityExplanation(score: number, type: string, features: Record<string, number>): string {
    if (score > 0.8) {
      return `Very similar articles (${(score * 100).toFixed(1)}%) - Strong ${type} similarity`
    } else if (score > 0.6) {
      return `Moderately similar (${(score * 100).toFixed(1)}%) - Related ${type} content`
    } else if (score > 0.4) {
      return `Somewhat similar (${(score * 100).toFixed(1)}%) - Shared ${type} elements`
    } else {
      return `Low similarity (${(score * 100).toFixed(1)}%) - Different content`
    }
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  // Clean up cache periodically
  clearCache(): void {
    this.vectorCache.clear()
    logger.info('Similarity vector cache cleared')
  }

  getCacheSize(): number {
    return this.vectorCache.size
  }
}