/**
 * ArticleBodyExtractor - Core content extraction using gravity scoring
 * Exact port from Python newspaper4k articlebody_extractor.py
 */

import * as cheerio from 'cheerio'
import { Configuration } from '../configuration.js'
import { SCORE_WEIGHTS, ARTICLE_BODY_TAGS } from './defines.js'
import { getStopWords } from '../text.js'

export class ArticleBodyExtractor {
  private config: Configuration
  public topNode: cheerio.Cheerio<cheerio.Element> | null = null
  public topNodeComplemented: cheerio.Cheerio<cheerio.Element> | null = null

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse HTML document - exact port of Python parse method
   */
  public parse(doc: cheerio.CheerioAPI): void {
    this.topNode = this.calculateBestNode(doc)
    this.topNodeComplemented = this.complementWithSiblings(this.topNode)
  }

  /**
   * Parse HTML with existing Cheerio instance
   */
  public parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html)
  }

  /**
   * Calculate best node - exact port of Python calculate_best_node
   */
  public calculateBestNode(doc: cheerio.CheerioAPI): cheerio.Cheerio<cheerio.Element> | null {
    let topNode: cheerio.Cheerio<cheerio.Element> | null = null
    this.boostHighlyLikelyNodes(doc)

    let parentNodes: cheerio.Cheerio<cheerio.Element>[] = []
    const nodesWithText = this.computeFeatures(doc)

    // Process the tree from bottom up, farthest nodes first
    nodesWithText.sort((a, b) => {
      const aLevel = this.getAttribute(a, 'node_level', 0)
      const bLevel = this.getAttribute(b, 'node_level', 0)
      return bLevel - aLevel // Reverse order (highest level first)
    })

    parentNodes = this.computeGravityScores(nodesWithText)

    if (parentNodes.length > 0) {
      parentNodes.sort((a, b) => {
        const aScore = this.getNodeGravityScore(a)
        const bScore = this.getNodeGravityScore(b)
        return bScore - aScore // Reverse order (highest score first)
      })
      topNode = parentNodes[0]
    }

    return topNode
  }

  /**
   * Compute gravity scores - exact port of Python compute_gravity_scores
   */
  private computeGravityScores(nodesWithText: cheerio.Cheerio<cheerio.Element>[]): cheerio.Cheerio<cheerio.Element>[] {
    const parentNodes: cheerio.Cheerio<cheerio.Element>[] = []
    let boostDiscount = 1
    const nodesCount = nodesWithText.length
    let negativeScoring = 0

    const bottomNegativeScoreNodes = nodesCount * SCORE_WEIGHTS.bottom_negativescore_nodes

    for (let i = 0; i < nodesWithText.length; i++) {
      const node = nodesWithText[i]
      let boostScore = 0

      // Boost score decays with distance from the top node
      if (this.isBoostable(node)) {
        boostScore = SCORE_WEIGHTS.boost_score / boostDiscount
        boostDiscount += 1
      }

      // Nodes number logic
      if (nodesCount > SCORE_WEIGHTS.node_count_threshold) {
        // Higher number of possible top nodes
        const distFromEnd = nodesCount - i
        if (distFromEnd <= bottomNegativeScoreNodes) {
          const booster = bottomNegativeScoreNodes - distFromEnd
          boostScore = -(booster ** 2)
          const negScore = Math.abs(boostScore) + negativeScoring
          if (negScore > SCORE_WEIGHTS.negative_score_threshold) {
            boostScore = SCORE_WEIGHTS.negative_score_boost
          }
        }
      }

      const stopWordCount = this.getStopWords(node)
      const upScore = stopWordCount + boostScore

      const parentNode = node.parent()
      this.updateScore(parentNode, upScore)
      this.updateNodeCount(parentNode, 1)
      parentNodes.push(parentNode)

      // Parent of parent node
      const parentParentNode = parentNode.parent()
      if (parentParentNode.length > 0) {
        this.updateNodeCount(parentParentNode, 1)
        this.updateScore(parentParentNode, upScore * SCORE_WEIGHTS.parent_parent_node)
        parentNodes.push(parentParentNode)
      }
    }

    // Remove duplicates and nulls
    const uniqueParents = Array.from(new Set(parentNodes.map(n => n.get(0))))
      .filter(n => n != null)
      .map(n => cheerio(n))

    return uniqueParents
  }

  /**
   * Compute features - exact port of Python compute_features
   */
  private computeFeatures(doc: cheerio.CheerioAPI): cheerio.Cheerio<cheerio.Element>[] {
    const candidates: cheerio.Cheerio<cheerio.Element>[] = []
    const nodesToCheck = this.nodesToCheck(doc)

    // Sort by level (deepest first)
    nodesToCheck.sort((a, b) => {
      const aLevel = this.getLevel(doc(a))
      const bLevel = this.getLevel(doc(b))
      return bLevel - aLevel
    })

    for (const node of nodesToCheck) {
      const nodeElement = doc(node)
      const textContent = this.getText(nodeElement)
      if (!textContent) continue

      const wordStats = getStopWords(textContent, this.config.language)
      const isHighLinkDensity = this.isHighLinkDensity(nodeElement)

      // Calculate children word stats to avoid double counting
      const children = nodeElement.find('*[data-stop-words]').toArray()
      let childStopWords = 0
      let childWordCount = 0

      for (const child of children) {
        childStopWords += this.getStopWords(doc(child))
        childWordCount += this.getWordCount(doc(child))
      }

      const finalStopWords = Math.max(0, wordStats.stopWordCount - childStopWords)
      const finalWordCount = Math.max(0, wordStats.wordCount - childWordCount)

      this.setAttribute(nodeElement, 'stop_words', finalStopWords)
      this.setAttribute(nodeElement, 'word_count', finalWordCount)
      this.setAttribute(nodeElement, 'is_highlink_density', isHighLinkDensity ? 1 : 0)
      this.setAttribute(nodeElement, 'node_level', this.getLevel(nodeElement))

      if (finalStopWords > 2 && !isHighLinkDensity) {
        candidates.push(nodeElement)
      }
    }

    return candidates
  }

  /**
   * Nodes to check - exact port of Python nodes_to_check
   */
  private nodesToCheck(doc: cheerio.CheerioAPI): cheerio.Element[] {
    const nodesToCheck: cheerio.Element[] = []
    const tags = ['p', 'pre', 'td', 'article', 'div']

    for (const tag of tags) {
      if (tag === 'div') {
        let items: cheerio.Element[] = []
        const attrs = ['articlebody', 'article', 'story']
        
        for (const attr of attrs) {
          // Match by ID with word matching
          doc(`div[id*="${attr}"]`).each((_, el) => {
            if (this.matchesWord(doc(el).attr('id') || '', attr)) {
              items.push(el)
            }
          })
          // Match by class with word matching
          doc(`div[class*="${attr}"]`).each((_, el) => {
            if (this.matchesWord(doc(el).attr('class') || '', attr)) {
              items.push(el)
            }
          })
        }

        // Paragraph class match
        doc('div[class*="paragraph"]').each((_, el) => {
          items.push(el)
        })

        if (items.length === 0 && nodesToCheck.length < 5) {
          doc('div').each((_, el) => {
            items.push(el)
          })
        }

        items = [...new Set(items)] // Remove duplicates
        nodesToCheck.push(...items)
      } else {
        doc(tag).each((_, el) => {
          nodesToCheck.push(el)
        })
      }
    }

    return nodesToCheck
  }

  /**
   * Check if boostable - exact port of Python is_boostable
   */
  private isBoostable(node: cheerio.Cheerio<cheerio.Element>): boolean {
    const maxStepsAwayFromNode = SCORE_WEIGHTS.boost_max_steps_from_node
    const siblings = this.walkSiblings(node)

    for (let i = 0; i < Math.min(siblings.length, maxStepsAwayFromNode); i++) {
      const currentNode = siblings[i]
      if (currentNode.get(0)?.tagName === node.get(0)?.tagName) {
        const stopWordCount = this.getAttribute(currentNode, 'stop_words', 0)
        if (stopWordCount > SCORE_WEIGHTS.boost_min_stopword_count) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Boost highly likely nodes - exact port of Python boost_highly_likely_nodes
   */
  private boostHighlyLikelyNodes(doc: cheerio.CheerioAPI): void {
    const candidates = doc('p, pre, td, article, div').toArray()

    for (const el of candidates) {
      const boost = this.isHighlyLikely(doc(el))
      if (boost > 0) {
        this.updateScore(doc(el), boost * SCORE_WEIGHTS.parent_node)
      }
    }
  }

  /**
   * Is highly likely - exact port of Python is_highly_likely
   */
  private isHighlyLikely(node: cheerio.Cheerio<cheerio.Element>): number {
    const scores: number[] = []

    for (const tag of ARTICLE_BODY_TAGS) {
      if (this.isTagMatch(node, tag)) {
        scores.push(tag.score_boost)
      }
    }

    return scores.length > 0 ? Math.max(...scores) : 0
  }

  /**
   * Check tag match - exact port of Python tag matching logic
   */
  private isTagMatch(node: cheerio.Cheerio<cheerio.Element>, tagDict: any): boolean {
    if (tagDict.tag && node.get(0)?.tagName?.toLowerCase() !== tagDict.tag) {
      return false
    }

    for (const [k, v] of Object.entries(tagDict)) {
      if (k === 'tag' || k === 'score_boost') continue
      
      const attrValue = node.attr(k as string) || ''
      const pattern = v as string
      
      if (pattern.startsWith('re:')) {
        const regex = new RegExp(pattern.substring(3), 'i')
        if (!regex.test(attrValue)) {
          return false
        }
      } else if (attrValue.toLowerCase() !== pattern.toLowerCase()) {
        return false
      }
    }

    return true
  }

  /**
   * Complement with siblings - exact port of Python complement_with_siblings
   */
  private complementWithSiblings(node: cheerio.Cheerio<cheerio.Element> | null): cheerio.Cheerio<cheerio.Element> | null {
    if (!node) return null
    return this.addSameLevelCandidates(node)
  }

  /**
   * Add same level candidates - exact port of Python add_same_level_candidates
   */
  private addSameLevelCandidates(node: cheerio.Cheerio<cheerio.Element>): cheerio.Cheerio<cheerio.Element> {
    const nodeLevel = this.getLevel(node)
    const baseScore = this.getNodeGravityScore(node)
    
    // Create new container
    const newNode = cheerio('<html><body></body></html>').find('body')
    const candidates = this.getNodesAtLevel(node, nodeLevel)

    for (const n of candidates) {
      if (n.get(0) === node.get(0)) {
        newNode.append(node.clone())
        continue
      }

      // Avoid adding nodes that do not resemble the top node
      if (n.get(0)?.tagName !== node.get(0)?.tagName) {
        continue
      }

      const score = this.getNodeGravityScore(n)
      if (score > baseScore * 0.3 && !this.isHighLinkDensity(n)) {
        newNode.append(n.clone())
      }
    }

    return newNode
  }

  // Helper methods - exact ports of Python parser functions

  private getAttribute(node: cheerio.Cheerio<cheerio.Element>, attr: string, defaultValue: number): number {
    return parseInt(node.attr(`data-${attr}`) || defaultValue.toString(), 10)
  }

  private setAttribute(node: cheerio.Cheerio<cheerio.Element>, attr: string, value: number | string): void {
    node.attr(`data-${attr}`, value.toString())
  }

  private getStopWords(node: cheerio.Cheerio<cheerio.Element>): number {
    return this.getAttribute(node, 'stop_words', 0)
  }

  private getWordCount(node: cheerio.Cheerio<cheerio.Element>): number {
    return this.getAttribute(node, 'word_count', 0)
  }

  private getNodeGravityScore(node: cheerio.Cheerio<cheerio.Element>): number {
    return parseFloat(node.attr('data-gravity-score') || '0')
  }

  private updateScore(node: cheerio.Cheerio<cheerio.Element>, addToScore: number): void {
    if (node.length === 0) return
    const newScore = this.getNodeGravityScore(node) + addToScore
    node.attr('data-gravity-score', newScore.toString())
  }

  private updateNodeCount(node: cheerio.Cheerio<cheerio.Element>, addToCount: number): void {
    if (node.length === 0) return
    const currentCount = parseFloat(node.attr('data-gravity-nodes') || '0')
    node.attr('data-gravity-nodes', (currentCount + addToCount).toString())
  }

  private getText(node: cheerio.Cheerio<cheerio.Element>): string {
    return node.text().trim()
  }

  private getLevel(node: cheerio.Cheerio<cheerio.Element>): number {
    let level = 0
    let current = node.parent()
    
    while (current.length > 0) {
      level++
      current = current.parent()
    }
    
    return level
  }

  private isHighLinkDensity(node: cheerio.Cheerio<cheerio.Element>): boolean {
    const text = this.getText(node)
    const links = node.find('a')
    
    if (text.length === 0) return true
    if (links.length === 0) return false

    let linkTextLength = 0
    links.each((_, link) => {
      linkTextLength += cheerio(link).text().length
    })

    const linkDensity = linkTextLength / text.length
    
    // Use exponential decay function for dynamic threshold
    const threshold = Math.max(0.3, Math.exp(-text.length / 1000))
    return linkDensity > threshold
  }

  private walkSiblings(node: cheerio.Cheerio<cheerio.Element>): cheerio.Cheerio<cheerio.Element>[] {
    const siblings: cheerio.Cheerio<cheerio.Element>[] = []
    let current = node.prev()

    while (current.length > 0) {
      siblings.push(current)
      current = current.prev()
    }

    return siblings
  }

  private getNodesAtLevel(node: cheerio.Cheerio<cheerio.Element>, level: number): cheerio.Cheerio<cheerio.Element>[] {
    const nodes: cheerio.Cheerio<cheerio.Element>[] = []
    const root = node.closest('html')
    
    root.find('*').each((_, el) => {
      const elNode = cheerio(el)
      if (this.getLevel(elNode) === level) {
        nodes.push(elNode)
      }
    })

    return nodes
  }

  private matchesWord(text: string, word: string): boolean {
    if (!text || !word) return false
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    return regex.test(text.replace(/-/g, ''))
  }
}