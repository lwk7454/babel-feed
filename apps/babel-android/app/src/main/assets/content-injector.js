(function() {
    'use strict';

    window.BabelContentInjector = {
        
        // Store original content for toggle functionality
        originalContent: new Map(),
        translatedContent: new Map(),
        elementLocators: new Map(), // Store element locators for NDJSON mapping
        isTranslationActive: false,
        
        // Inject translations into the DOM
        injectTranslations: function(translationBatchJson) {
            try {
                const batch = JSON.parse(translationBatchJson);
                let injectedCount = 0;
                
                // Automatically activate translation when injecting
                this.isTranslationActive = true;
                
                batch.textNodes.forEach(translation => {
                    const element = this.findElementByTextNodeId(translation.id);
                    if (element) {
                        // Store original content if not already stored
                        if (!this.originalContent.has(translation.id)) {
                            this.originalContent.set(translation.id, element.textContent);
                        }
                        
                        // Store translated content
                        this.translatedContent.set(translation.id, translation.translatedText);
                        
                        // Always inject translation when this method is called
                        element.textContent = translation.translatedText;
                        element.setAttribute('data-babel-translated', 'true');
                        element.setAttribute('data-babel-original', translation.originalText);
                        
                        injectedCount++;
                    }
                });
                
                return {
                    success: true,
                    injectedCount: injectedCount,
                    totalTranslations: batch.textNodes.length,
                    timestamp: Date.now()
                };
                
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        },
        
        // Toggle between original and translated content
        toggleTranslation: function() {
            this.isTranslationActive = !this.isTranslationActive;
            
            let toggledCount = 0;
            
            if (this.isTranslationActive) {
                // Switch to translated content
                this.translatedContent.forEach((translatedText, nodeId) => {
                    const element = this.findElementByTextNodeId(nodeId);
                    if (element) {
                        element.textContent = translatedText;
                        element.setAttribute('data-babel-translated', 'true');
                        toggledCount++;
                    }
                });
            } else {
                // Switch back to original content
                this.originalContent.forEach((originalText, nodeId) => {
                    const element = this.findElementByTextNodeId(nodeId);
                    if (element) {
                        element.textContent = originalText;
                        element.removeAttribute('data-babel-translated');
                        toggledCount++;
                    }
                });
            }
            
            return {
                success: true,
                translationActive: this.isTranslationActive,
                toggledCount: toggledCount,
                timestamp: Date.now()
            };
        },
        
        // Remove all translations and restore original content
        removeAllTranslations: function() {
            let restoredCount = 0;
            
            this.originalContent.forEach((originalText, nodeId) => {
                const element = this.findElementByTextNodeId(nodeId);
                if (element) {
                    element.textContent = originalText;
                    element.removeAttribute('data-babel-translated');
                    element.removeAttribute('data-babel-original');
                    restoredCount++;
                }
            });
            
            // Clear stored content
            this.originalContent.clear();
            this.translatedContent.clear();
            this.isTranslationActive = false;
            
            return {
                success: true,
                restoredCount: restoredCount,
                timestamp: Date.now()
            };
        },
        
        // Find DOM element by text node ID
        findElementByTextNodeId: function(nodeId) {
            // Look for elements with the babel text IDs attribute
            const elements = document.querySelectorAll(`[data-babel-text-ids]`);
            for (let element of elements) {
                const textIds = element.getAttribute('data-babel-text-ids');
                if (textIds && textIds.includes(nodeId)) {
                    return element;
                }
            }
            
            // Fallback: search through all elements with text content
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                const textIds = node.getAttribute('data-babel-text-ids');
                if (textIds && textIds.includes(nodeId)) {
                    return node;
                }
            }
            
            return null;
        },
        
        // Get current translation state
        getTranslationState: function() {
            return {
                isActive: this.isTranslationActive,
                originalCount: this.originalContent.size,
                translatedCount: this.translatedContent.size,
                timestamp: Date.now()
            };
        },
        
        // Highlight translated content for debugging
        highlightTranslations: function(highlight = true) {
            const translatedElements = document.querySelectorAll('[data-babel-translated="true"]');
            translatedElements.forEach(element => {
                if (highlight) {
                    element.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                    element.style.border = '1px dashed #ff9900';
                } else {
                    element.style.backgroundColor = '';
                    element.style.border = '';
                }
            });
            
            return {
                success: true,
                highlightedCount: translatedElements.length,
                highlighted: highlight
            };
        },

        // Inject partial translations for real-time updates during NDJSON streaming
        injectPartialTranslations: function(translationBatchJson) {
            try {
                const batch = JSON.parse(translationBatchJson);
                let injectedCount = 0;
                
                // Process new translations without overriding existing ones
                batch.textNodes.forEach(translation => {
                    const element = this.findElementByTextNodeId(translation.id);
                    if (element) {
                        // Store original content if not already stored
                        if (!this.originalContent.has(translation.id)) {
                            this.originalContent.set(translation.id, element.textContent);
                        }
                        
                        // Update translated content
                        this.translatedContent.set(translation.id, translation.translatedText);
                        
                        // Inject translation if translation is active
                        if (this.isTranslationActive || !element.hasAttribute('data-babel-translated')) {
                            element.textContent = translation.translatedText;
                            element.setAttribute('data-babel-translated', 'true');
                            element.setAttribute('data-babel-original', translation.originalText);
                            element.setAttribute('data-babel-confidence', translation.confidence);
                            this.isTranslationActive = true;
                        }
                        
                        injectedCount++;
                    }
                });
                
                return {
                    success: true,
                    injectedCount: injectedCount,
                    totalTranslations: batch.textNodes.length,
                    timestamp: Date.now()
                };
                
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        },

        // Find DOM element by locator (CSS selector or XPath)
        findElementByLocator: function(locator) {
            try {
                // Try as CSS selector first
                if (locator.startsWith('#') || locator.startsWith('.') || locator.includes(' > ')) {
                    const element = document.querySelector(locator);
                    if (element) return element;
                }
                
                // Try as XPath if CSS selector fails
                if (locator.startsWith('xpath://') || locator.startsWith('//')) {
                    const xpath = locator.replace('xpath://', '');
                    const result = document.evaluate(
                        xpath,
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    );
                    if (result.singleNodeValue) return result.singleNodeValue;
                }
                
                return null;
            } catch (error) {
                console.warn('Failed to find element by locator:', locator, error);
                return null;
            }
        },

        // Inject translations using element locators from batched NDJSON response
        injectTranslationsByLocator: function(ndjsonResults) {
            try {
                const results = ndjsonResults.split('\n').filter(line => line.trim());
                let injectedCount = 0;
                
                // Automatically activate translation when injecting
                this.isTranslationActive = true;
                
                results.forEach(line => {
                    try {
                        const translation = JSON.parse(line);
                        
                        // Skip non-translation lines (like batch completion status)
                        if (!translation.id || !translation.translatedText) return;
                        
                        // Find element by locator stored during extraction
                        const locator = this.elementLocators.get(translation.id);
                        let element = null;
                        
                        if (locator) {
                            element = this.findElementByLocator(locator);
                        }
                        
                        // Fallback to text node ID search if locator fails
                        if (!element) {
                            element = this.findElementByTextNodeId(translation.id);
                        }
                        
                        if (element) {
                            // Store original content if not already stored
                            if (!this.originalContent.has(translation.id)) {
                                this.originalContent.set(translation.id, element.textContent);
                            }
                            
                            // Store translated content
                            this.translatedContent.set(translation.id, translation.translatedText);
                            
                            // Inject translation
                            element.textContent = translation.translatedText;
                            element.setAttribute('data-babel-translated', 'true');
                            element.setAttribute('data-babel-confidence', translation.confidence || '0.5');
                            element.setAttribute('data-babel-progress', translation.progress || '1.0');
                            
                            injectedCount++;
                        } else {
                            console.warn('Could not find element for translation ID:', translation.id);
                        }
                    } catch (parseError) {
                        console.warn('Failed to parse NDJSON line:', line, parseError);
                    }
                });
                
                return {
                    success: true,
                    injectedCount: injectedCount,
                    totalLines: results.length,
                    timestamp: Date.now()
                };
                
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        },

        // Store element locator mapping for later use
        registerElementLocator: function(elementId, locator) {
            this.elementLocators.set(elementId, locator);
        },

        // Clear all locator mappings
        clearElementLocators: function() {
            this.elementLocators.clear();
        }
    };

})();