(function() {
    'use strict';

    window.BabelContentInjector = {
        
        // Store original content for toggle functionality
        originalContent: new Map(),
        translatedContent: new Map(),
        isTranslationActive: false,
        
        // Inject translations into the DOM
        injectTranslations: function(translationBatchJson) {
            try {
                const batch = JSON.parse(translationBatchJson);
                let injectedCount = 0;
                
                batch.textNodes.forEach(translation => {
                    const element = this.findElementByTextNodeId(translation.id);
                    if (element) {
                        // Store original content if not already stored
                        if (!this.originalContent.has(translation.id)) {
                            this.originalContent.set(translation.id, element.textContent);
                        }
                        
                        // Store translated content
                        this.translatedContent.set(translation.id, translation.translatedText);
                        
                        // Inject translation if translation is active
                        if (this.isTranslationActive) {
                            element.textContent = translation.translatedText;
                            element.setAttribute('data-babel-translated', 'true');
                            element.setAttribute('data-babel-original', translation.originalText);
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
            // Look for elements with the babel ID attribute
            const textNode = document.querySelector(`[data-babel-id="${nodeId}"]`);
            if (textNode) {
                return textNode.parentElement || textNode;
            }
            
            // Fallback: search through all text nodes
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                if (node.getAttribute && node.getAttribute('data-babel-id') === nodeId) {
                    return node.parentElement || node;
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
        }
    };

})();