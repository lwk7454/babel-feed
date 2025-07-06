(function() {
    'use strict'

    window.BabelDynamicExtractor = {
        
        // State tracking
        isMonitoring: false,
        translationActive: false,
        observer: null,
        debounceTimer: null,
        contentCache: new Map(),
        translationCache: new Map(),
        
        // Configuration
        config: {
            debounceDelay: 300, // ms
            maxBatchSize: 50,   // nodes per batch
            minTextLength: 2,   // minimum characters to translate
            observerThrottle: 100, // ms between observer callbacks
        },
        
        // Initialize dynamic content monitoring
        startMonitoring: function() {
            if (this.isMonitoring) {
                return { success: true, message: "Already monitoring" }
            }
            
            try {
                this.setupMutationObserver()
                this.performInitialScan()
                this.isMonitoring = true
                
                return {
                    success: true,
                    timestamp: Date.now(),
                    message: "Dynamic content monitoring started"
                }
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                }
            }
        },
        
        // Stop monitoring dynamic content
        stopMonitoring: function() {
            if (this.observer) {
                this.observer.disconnect()
                this.observer = null
            }
            
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer)
                this.debounceTimer = null
            }
            
            this.isMonitoring = false
            
            return {
                success: true,
                timestamp: Date.now(),
                message: "Dynamic content monitoring stopped"
            }
        },
        
        // Set up MutationObserver for DOM changes
        setupMutationObserver: function() {
            let lastCallTime = 0
            
            this.observer = new MutationObserver((mutations) => {
                const now = Date.now()
                if (now - lastCallTime < this.config.observerThrottle) {
                    return // Throttle rapid changes
                }
                lastCallTime = now
                
                this.handleMutations(mutations)
            })
            
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: false // Skip attribute changes for performance
            })
        },
        
        // Handle DOM mutations with debouncing
        handleMutations: function(mutations) {
            let hasTextChanges = false
            const newNodes = []
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (this.isContentNode(node)) {
                            newNodes.push(node)
                            hasTextChanges = true
                        }
                    })
                } else if (mutation.type === 'characterData') {
                    const text = mutation.target.textContent?.trim()
                    if (text && text.length >= this.config.minTextLength) {
                        hasTextChanges = true
                    }
                }
            })
            
            if (hasTextChanges) {
                this.debouncedExtraction(newNodes)
            }
        },
        
        // Debounced content extraction to handle rapid changes
        debouncedExtraction: function(newNodes = []) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer)
            }
            
            this.debounceTimer = setTimeout(() => {
                this.performIncrementalExtraction(newNodes)
            }, this.config.debounceDelay)
        },
        
        // Perform initial scan of all content
        performInitialScan: function() {
            const result = this.extractAllContent()
            
            if (window.BabelDynamicBridge && typeof window.BabelDynamicBridge.onDynamicContentExtracted === 'function') {
                window.BabelDynamicBridge.onDynamicContentExtracted(JSON.stringify({
                    type: 'initial_scan',
                    ...result
                }))
            }
            
            return result
        },
        
        // Extract content incrementally from new/changed nodes
        performIncrementalExtraction: function(targetNodes = []) {
            try {
                const newContent = this.extractIncrementalContent(targetNodes)
                
                if (newContent.textNodes.length > 0) {
                    // Cache new content
                    newContent.textNodes.forEach(node => {
                        this.contentCache.set(node.id, node)
                    })
                    
                    // Notify bridge of new content
                    if (window.BabelDynamicBridge && typeof window.BabelDynamicBridge.onDynamicContentExtracted === 'function') {
                        window.BabelDynamicBridge.onDynamicContentExtracted(JSON.stringify({
                            type: 'incremental_update',
                            ...newContent
                        }))
                    }
                }
                
                return newContent
            } catch (error) {
                console.error('Incremental extraction failed:', error)
                if (window.BabelDynamicBridge && typeof window.BabelDynamicBridge.onError === 'function') {
                    window.BabelDynamicBridge.onError('Incremental extraction failed: ' + error.message)
                }
            }
        },
        
        // Extract all content (initial scan)
        extractAllContent: function() {
            const textNodes = []
            this.traverseAndExtract(document.body, [], textNodes)
            
            // Cache all content
            textNodes.forEach(node => {
                this.contentCache.set(node.id, node)
            })
            
            return {
                timestamp: Date.now(),
                url: window.location.href,
                title: document.title,
                textNodes: textNodes,
                totalNodes: textNodes.length,
                extractionType: 'full'
            }
        },
        
        // Extract content from specific nodes (incremental)
        extractIncrementalContent: function(targetNodes) {
            const textNodes = []
            
            if (targetNodes.length === 0) {
                // No specific targets, scan for changes in entire document
                this.traverseAndExtract(document.body, [], textNodes, true)
            } else {
                // Extract from specific new nodes
                targetNodes.forEach(node => {
                    this.traverseAndExtract(node, [], textNodes, false)
                })
            }
            
            // Filter out content we've already seen
            const newTextNodes = textNodes.filter(node => {
                const cached = this.contentCache.get(node.id)
                return !cached || cached.text !== node.text
            })
            
            return {
                timestamp: Date.now(),
                url: window.location.href,
                title: document.title,
                textNodes: newTextNodes,
                totalNodes: newTextNodes.length,
                extractionType: 'incremental'
            }
        },
        
        // Enhanced traversal with change detection
        traverseAndExtract: function(node, path, textNodes, detectChanges = false) {
            if (!node) return
            
            let childIndex = 0
            for (const child of node.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent?.trim()
                    if (text && text.length >= this.config.minTextLength) {
                        const textNodeId = this.generateTextNodeId(child)
                        
                        // Check if this is new or changed content
                        let shouldInclude = true
                        if (detectChanges) {
                            const cached = this.contentCache.get(textNodeId)
                            shouldInclude = !cached || cached.text !== text
                        }
                        
                        if (shouldInclude) {
                            const textNodeData = {
                                id: textNodeId,
                                text: text,
                                path: [...path, childIndex],
                                parentTag: node.tagName,
                                parentId: node.id || null,
                                parentClass: node.className || null,
                                boundingRect: this.getTextBoundingRect(child),
                                context: this.getTextContext(child),
                                timestamp: Date.now(),
                                language: this.detectLanguage(text)
                            }
                            
                            textNodes.push(textNodeData)
                            
                            // Mark the text node for tracking
                            if (child.parentElement) {
                                child.parentElement.setAttribute('data-babel-id', textNodeId)
                            }
                        }
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE && this.isContentNode(child)) {
                    this.traverseAndExtract(child, [...path, childIndex], textNodes, detectChanges)
                }
                childIndex++
            }
        },
        
        // Generate unique ID for text nodes with collision detection
        generateTextNodeId: function(textNode) {
            const parent = textNode.parentElement
            if (parent && parent.getAttribute('data-babel-id')) {
                return parent.getAttribute('data-babel-id')
            }
            
            // Create unique ID based on content and position
            const text = textNode.textContent?.trim() || ''
            const position = this.getNodePosition(textNode)
            const hash = this.simpleHash(text + position)
            
            return `babel-dynamic-${hash}-${Date.now().toString(36)}`
        },
        
        // Get node position for unique identification
        getNodePosition: function(node) {
            let position = ''
            let current = node
            
            while (current && current !== document.body) {
                const parent = current.parentNode
                if (parent) {
                    const siblings = Array.from(parent.childNodes)
                    const index = siblings.indexOf(current)
                    position = index + '-' + position
                }
                current = parent
            }
            
            return position
        },
        
        // Simple hash function for content identification
        simpleHash: function(str) {
            let hash = 0
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i)
                hash = ((hash << 5) - hash) + char
                hash = hash & hash // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(36)
        },
        
        // Basic language detection
        detectLanguage: function(text) {
            // Chinese characters
            if (/[\u4e00-\u9fff]/.test(text)) {
                return 'zh'
            }
            // Japanese characters (Hiragana, Katakana, Kanji)
            if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text)) {
                return 'ja'
            }
            // Korean characters
            if (/[\uac00-\ud7af]/.test(text)) {
                return 'ko'
            }
            // Default to English
            return 'en'
        },
        
        // Check if node contains translatable content
        isContentNode: function(node) {
            if (!node || node.nodeType !== Node.ELEMENT_NODE) {
                return false
            }
            
            const tagName = node.tagName?.toLowerCase()
            
            // Skip non-content elements
            const skipTags = ['script', 'style', 'noscript', 'iframe', 'object', 'embed']
            if (skipTags.includes(tagName)) {
                return false
            }
            
            // Skip hidden elements
            const style = window.getComputedStyle(node)
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false
            }
            
            return true
        },
        
        // Get text bounding rectangle
        getTextBoundingRect: function(textNode) {
            try {
                const parent = textNode.parentElement
                if (parent) {
                    const rect = parent.getBoundingClientRect()
                    return {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    }
                }
            } catch (e) {
                // Ignore errors for performance
            }
            return null
        },
        
        // Get text context for better translation
        getTextContext: function(textNode) {
            try {
                const parent = textNode.parentElement
                if (parent) {
                    return {
                        beforeText: this.getSiblingText(textNode, -1),
                        afterText: this.getSiblingText(textNode, 1),
                        parentText: parent.textContent?.trim().substring(0, 200) || '',
                        semanticRole: this.getSemanticRole(parent)
                    }
                }
            } catch (e) {
                // Ignore errors for performance
            }
            return null
        },
        
        // Get sibling text for context
        getSiblingText: function(node, direction) {
            const parent = node.parentNode
            if (!parent) return ''
            
            const siblings = Array.from(parent.childNodes)
            const index = siblings.indexOf(node)
            const siblingIndex = index + direction
            
            if (siblingIndex >= 0 && siblingIndex < siblings.length) {
                const sibling = siblings[siblingIndex]
                return sibling.textContent?.trim().substring(0, 50) || ''
            }
            
            return ''
        },
        
        // Determine semantic role of element
        getSemanticRole: function(element) {
            const tagName = element.tagName?.toLowerCase()
            
            const roleMap = {
                'h1': 'heading-1', 'h2': 'heading-2', 'h3': 'heading-3',
                'h4': 'heading-4', 'h5': 'heading-5', 'h6': 'heading-6',
                'p': 'paragraph', 'span': 'text', 'div': 'container',
                'a': 'link', 'button': 'button', 'label': 'label',
                'li': 'list-item', 'td': 'table-cell', 'th': 'table-header'
            }
            
            return roleMap[tagName] || 'text'
        },
        
        // Get current monitoring status
        getMonitoringStatus: function() {
            return {
                isMonitoring: this.isMonitoring,
                translationActive: this.translationActive,
                cachedNodes: this.contentCache.size,
                cachedTranslations: this.translationCache.size,
                config: this.config
            }
        },
        
        // Update configuration
        updateConfig: function(newConfig) {
            this.config = { ...this.config, ...newConfig }
            return {
                success: true,
                config: this.config
            }
        },
        
        // Force immediate scan (bypass debouncing)
        forceScan: function() {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer)
                this.debounceTimer = null
            }
            
            return this.performIncrementalExtraction([])
        }
    }

})()