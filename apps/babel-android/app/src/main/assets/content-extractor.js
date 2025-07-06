(function() {
    'use strict'

    // Helper function to safely get className as string
    const getClassName = (node) => {
        if (!node.className) return ''
        if (typeof node.className === 'string') return node.className
        if (node.className.toString) return node.className.toString()
        if (node.className.baseVal) return node.className.baseVal // SVG case
        return ''
    }

    window.BabelContentExtractor = {
        
        // Helper method to get className
        getClassName: getClassName,
        
        // Content extraction with DOM structure preservation
        extractContent: function() {
            const result = {
                timestamp: Date.now(),
                url: window.location.href,
                title: document.title,
                textNodes: [],
                structure: this.buildDOMStructure(),
                metadata: this.extractMetadata()
            }

            this.traverseAndExtract(document.body, [], result.textNodes)
            
            return JSON.stringify(result)
        },

        // Build hierarchical DOM structure for accurate placement
        buildDOMStructure: function() {
            const structure = []
            this.buildNodeStructure(document.body, structure, [])
            return structure
        },

        buildNodeStructure: function(node, structure, path) {
            if (!node) return

            const nodeInfo = {
                tagName: node.tagName,
                id: node.id || null,
                className: this.getClassName(node),
                attributes: this.getRelevantAttributes(node),
                path: [...path],
                hasText: false,
                textNodeId: null
            }

            // Check if this node has direct text content
            for (const child of node.childNodes) {
                if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    nodeInfo.hasText = true
                    break
                }
            }

            structure.push(nodeInfo)

            // Recursively process children
            let childIndex = 0
            for (const child of node.children) {
                if (this.isContentNode(child)) {
                    this.buildNodeStructure(child, structure, [...path, childIndex])
                }
                childIndex++
            }
        },

        // Extract text nodes with precise positioning data
        traverseAndExtract: function(node, path, textNodes) {
            if (!node) return

            let childIndex = 0
            for (const child of node.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent.trim()
                    if (text && text.length > 1) {
                        const textNodeId = this.generateTextNodeId()
                        
                        textNodes.push({
                            id: textNodeId,
                            text: text,
                            path: [...path, childIndex],
                            parentTag: node.tagName,
                            parentId: node.id || null,
                            parentClass: this.getClassName(node),
                            boundingRect: this.getTextBoundingRect(child),
                            context: this.getTextContext(child)
                        })

                        // Mark the parent element for later identification
                        if (node && node.nodeType === Node.ELEMENT_NODE) {
                            if (!node.hasAttribute('data-babel-text-ids')) {
                                node.setAttribute('data-babel-text-ids', textNodeId)
                            } else {
                                const existingIds = node.getAttribute('data-babel-text-ids')
                                node.setAttribute('data-babel-text-ids', existingIds + ',' + textNodeId)
                            }
                        }
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE && this.isContentNode(child)) {
                    this.traverseAndExtract(child, [...path, childIndex], textNodes)
                }
                childIndex++
            }
        },

        // Generate unique ID for text nodes
        generateTextNodeId: function() {
            return 'babel-text-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
        },

        // Get bounding rectangle for text positioning
        getTextBoundingRect: function(textNode) {
            try {
                const range = document.createRange()
                range.selectNodeContents(textNode)
                const rect = range.getBoundingClientRect()
                return {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                }
            } catch (e) {
                return null
            }
        },

        // Get surrounding context for better translation accuracy
        getTextContext: function(textNode) {
            const parent = textNode.parentElement
            if (!parent) return null

            return {
                beforeText: this.getPreviousText(textNode),
                afterText: this.getNextText(textNode),
                parentText: parent.textContent.trim().substring(0, 200),
                semanticRole: this.getSemanticRole(parent)
            }
        },

        getPreviousText: function(node) {
            let prev = node.previousSibling
            while (prev) {
                if (prev.nodeType === Node.TEXT_NODE && prev.textContent.trim()) {
                    return prev.textContent.trim().slice(-50)
                }
                prev = prev.previousSibling
            }
            return ''
        },

        getNextText: function(node) {
            let next = node.nextSibling
            while (next) {
                if (next.nodeType === Node.TEXT_NODE && next.textContent.trim()) {
                    return next.textContent.trim().slice(0, 50)
                }
                next = next.nextSibling
            }
            return ''
        },

        // Determine semantic role for context-aware translation
        getSemanticRole: function(element) {
            const tag = element.tagName.toLowerCase()
            
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading'
            if (['p', 'div', 'span'].includes(tag)) return 'paragraph'
            if (['a'].includes(tag)) return 'link'
            if (['strong', 'b'].includes(tag)) return 'emphasis'
            if (['em', 'i'].includes(tag)) return 'italic'
            if (['blockquote'].includes(tag)) return 'quote'
            if (['li'].includes(tag)) return 'listItem'
            if (['td', 'th'].includes(tag)) return 'tableCell'
            if (['figcaption'].includes(tag)) return 'caption'
            
            return 'text'
        },

        // Extract page metadata
        extractMetadata: function() {
            return {
                language: document.documentElement.lang || this.detectLanguage(),
                charset: document.characterSet,
                viewport: this.getViewportInfo(),
                wordCount: this.countWords()
            }
        },

        detectLanguage: function() {
            // Simple language detection based on common patterns
            const text = document.body.textContent.substring(0, 1000)
            
            // Check for common Chinese characters
            if (/[\u4e00-\u9fff]/.test(text)) return 'zh'
            // Check for Japanese characters
            if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'
            // Default to English
            return 'en'
        },

        getViewportInfo: function() {
            return {
                width: window.innerWidth,
                height: window.innerHeight,
                scrollTop: window.pageYOffset,
                scrollLeft: window.pageXOffset
            }
        },

        countWords: function() {
            const text = document.body.textContent || ''
            return text.trim().split(/\s+/).length
        },

        // Check if node should be processed for content extraction
        isContentNode: function(node) {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) return false
            
            const tagName = node.tagName.toLowerCase()
            
            // Skip non-content elements
            if (['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(tagName)) {
                return false
            }
            
            // Skip hidden elements
            const style = window.getComputedStyle(node)
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false
            }
            
            // Skip likely ad elements
            if (this.isLikelyAd(node)) {
                return false
            }
            
            return true
        },

        // Basic ad detection
        isLikelyAd: function(node) {
            const adPatterns = [
                'advertisement', 'ads', 'banner', 'popup', 'promo',
                'sponsored', 'affiliate', 'google-ads', 'doubleclick'
            ]
            
            const className = this.getClassName(node).toLowerCase()
            const id = (node.id || '').toLowerCase()
            
            return adPatterns.some(pattern => 
                className.includes(pattern) || id.includes(pattern)
            )
        },

        getRelevantAttributes: function(node) {
            const relevantAttrs = ['id', 'class', 'data-*', 'role', 'aria-*']
            const attrs = {}
            
            for (const attr of node.attributes) {
                if (relevantAttrs.some(pattern => 
                    pattern.includes('*') ? attr.name.startsWith(pattern.replace('*', '')) : attr.name === pattern
                )) {
                    attrs[attr.name] = attr.value
                }
            }
            
            return attrs
        }
    }

    // Content injection system
    window.BabelContentInjector = {
        
        injectTranslations: function(translationsJson) {
            try {
                const translations = JSON.parse(translationsJson)
                
                for (const translation of translations.textNodes) {
                    this.injectSingleTranslation(translation)
                }
                
                return { success: true, injected: translations.textNodes.length }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },

        injectSingleTranslation: function(translation) {
            // Find the parent element containing the text node ID
            const parentElement = document.querySelector(`[data-babel-text-ids*="${translation.id}"]`)
            
            if (parentElement) {
                this.replaceTextInElementById(parentElement, translation)
            } else {
                // Fallback: find by path and context
                this.injectByPathAndContext(translation)
            }
        },

        replaceTextInElementById: function(parentElement, translation) {
            const walker = document.createTreeWalker(
                parentElement,
                NodeFilter.SHOW_TEXT,
                null,
                false
            )

            let node
            while ((node = walker.nextNode())) {
                if (node.textContent.trim() === translation.originalText.trim()) {
                    this.replaceTextContent(node, translation.translatedText)
                    break
                }
            }
        },

        replaceTextContent: function(textNode, translatedText) {
            // Create a wrapper span to maintain structure
            const wrapper = document.createElement('span')
            wrapper.className = 'babel-translated'
            wrapper.setAttribute('data-original', textNode.textContent)
            wrapper.textContent = translatedText
            
            // Replace the text node with the wrapper
            textNode.parentNode.replaceChild(wrapper, textNode)
        },

        injectByPathAndContext: function(translation) {
            // Alternative injection method using DOM path and context matching
            const elements = document.querySelectorAll(translation.parentTag)
            
            for (const element of elements) {
                if (this.matchesContext(element, translation.context)) {
                    this.replaceTextInElement(element, translation.text, translation.translatedText)
                    break
                }
            }
        },

        matchesContext: function(element, context) {
            if (!context) return false
            
            const elementText = element.textContent.trim()
            return elementText.includes(context.parentText.substring(0, 50))
        },

        replaceTextInElement: function(element, originalText, translatedText) {
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null,
                false
            )

            let node
            while ((node = walker.nextNode())) {
                if (node.textContent.trim() === originalText.trim()) {
                    this.replaceTextContent(node, translatedText)
                    break
                }
            }
        },

        // Toggle between original and translated content
        toggleTranslation: function() {
            const translatedElements = document.querySelectorAll('.babel-translated')
            
            for (const element of translatedElements) {
                const original = element.getAttribute('data-original')
                const current = element.textContent
                
                element.textContent = original
                element.setAttribute('data-original', current)
            }
        },

        // Remove all translations and restore original content
        removeAllTranslations: function() {
            const translatedElements = document.querySelectorAll('.babel-translated')
            
            for (const element of translatedElements) {
                const original = element.getAttribute('data-original')
                const textNode = document.createTextNode(original)
                element.parentNode.replaceChild(textNode, element)
            }
        }
    }

    // Ad blocking functionality
    window.BabelAdBlocker = {
        
        blockAds: function() {
            this.hideAdElements()
            this.blockAdRequests()
            this.cleanupAdScripts()
            
            return { success: true, blocked: this.getBlockedCount() }
        },

        hideAdElements: function() {
            const adSelectors = [
                '[class*="ad-"]', '[class*="ads-"]', '[class*="advertisement"]',
                '[id*="ad-"]', '[id*="ads-"]', '[id*="advertisement"]',
                'iframe[src*="googlesyndication"]', 'iframe[src*="doubleclick"]',
                '.banner', '.popup', '.overlay', '.sponsored'
            ]

            for (const selector of adSelectors) {
                const elements = document.querySelectorAll(selector)
                for (const element of elements) {
                    element.style.display = 'none'
                    element.setAttribute('data-babel-blocked', 'true')
                }
            }
        },

        blockAdRequests: function() {
            // This would be implemented at the WebView level
            // Mark for network request filtering
            window.babelAdDomainsToBlock = [
                'googlesyndication.com',
                'doubleclick.net',
                'googletagmanager.com',
                'facebook.com/tr',
                'analytics.google.com'
            ]
        },

        cleanupAdScripts: function() {
            const scripts = document.querySelectorAll('script')
            for (const script of scripts) {
                const src = script.src || ''
                if (this.isAdScript(src)) {
                    script.remove()
                }
            }
        },

        isAdScript: function(src) {
            const adDomains = window.babelAdDomainsToBlock || []
            return adDomains.some(domain => src.includes(domain))
        },

        getBlockedCount: function() {
            return document.querySelectorAll('[data-babel-blocked="true"]').length
        }
    }

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Babel Content Extractor loaded')
        })
    }

})()