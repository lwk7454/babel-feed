(function() {
    'use strict'

    window.BabelAdBlocker = {
        
        // Store blocked elements for restoration
        blockedElements: new Map(),
        hiddenElements: new Set(),
        isAdBlockingActive: false,
        
        // Common ad selectors and patterns
        adSelectors: [
            // Generic ad selectors
            '[class*="ad-"]', '[class*="ads-"]', '[class*="advertisement"]',
            '[id*="ad-"]', '[id*="ads-"]', '[id*="advertisement"]',
            '.banner', '.popup', '.overlay', '.sponsored',
            
            // Common ad networks
            '[src*="googlesyndication"]', '[src*="doubleclick"]',
            '[src*="amazon-adsystem"]', '[src*="facebook.com/tr"]',
            '[src*="google-analytics"]', '[src*="googletagmanager"]',
            
            // Video ads
            '.video-ads', '.preroll', '.midroll', '.postroll',
            '[class*="video-ad"]', '[id*="video-ad"]',
            
            // Social media widgets that can be intrusive
            '.fb-like', '.twitter-timeline', '.instagram-media',
            
            // Cookie banners and privacy notices
            '[class*="cookie"]', '[class*="gdpr"]', '[class*="privacy"]',
            '[id*="cookie"]', '[id*="gdpr"]', '[id*="privacy"]'
        ],
        
        // URL patterns for blocking network requests
        adUrlPatterns: [
            /googlesyndication\.com/,
            /doubleclick\.net/,
            /amazon-adsystem\.com/,
            /facebook\.com\/tr/,
            /google-analytics\.com/,
            /googletagmanager\.com/,
            /adsystem\.amazon/,
            /ads\.twitter\.com/,
            /analytics\.tiktok\.com/,
            /connect\.facebook\.net/
        ],
        
        // Block ads in the current page
        blockAds: function() {
            if (this.isAdBlockingActive) {
                return {
                    success: true,
                    message: "Ad blocking already active",
                    blockedCount: this.hiddenElements.size
                }
            }
            
            let blockedCount = 0
            
            try {
                // Block elements by selectors
                this.adSelectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector)
                        elements.forEach(element => {
                            if (!this.hiddenElements.has(element)) {
                                // Store original display style
                                const originalStyle = element.style.display
                                this.blockedElements.set(element, {
                                    originalDisplay: originalStyle,
                                    originalVisibility: element.style.visibility,
                                    originalOpacity: element.style.opacity
                                })
                                
                                // Hide the element
                                element.style.display = 'none'
                                element.style.visibility = 'hidden'
                                element.style.opacity = '0'
                                element.setAttribute('data-babel-blocked', 'true')
                                
                                this.hiddenElements.add(element)
                                blockedCount++
                            }
                        })
                    } catch (e) {
                        console.warn('Ad blocker: Error with selector', selector, e)
                    }
                })
                
                // Block iframe ads
                const iframes = document.querySelectorAll('iframe')
                iframes.forEach(iframe => {
                    const src = iframe.src || iframe.getAttribute('data-src') || ''
                    if (this.isAdUrl(src)) {
                        if (!this.hiddenElements.has(iframe)) {
                            this.blockedElements.set(iframe, {
                                originalDisplay: iframe.style.display,
                                originalVisibility: iframe.style.visibility,
                                originalOpacity: iframe.style.opacity
                            })
                            
                            iframe.style.display = 'none'
                            iframe.setAttribute('data-babel-blocked', 'true')
                            this.hiddenElements.add(iframe)
                            blockedCount++
                        }
                    }
                })
                
                // Block script tags with ad URLs
                const scripts = document.querySelectorAll('script[src]')
                scripts.forEach(script => {
                    if (this.isAdUrl(script.src)) {
                        if (!this.hiddenElements.has(script)) {
                            script.remove()
                            blockedCount++
                        }
                    }
                })
                
                this.isAdBlockingActive = true
                
                // Set up mutation observer to catch dynamically added ads
                this.setupMutationObserver()
                
                return {
                    success: true,
                    blockedCount: blockedCount,
                    totalHidden: this.hiddenElements.size,
                    timestamp: Date.now()
                }
                
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    blockedCount: blockedCount
                }
            }
        },
        
        // Disable ad blocking and restore content
        disableAds: function() {
            if (!this.isAdBlockingActive) {
                return {
                    success: true,
                    message: "Ad blocking not active",
                    restoredCount: 0
                }
            }
            
            let restoredCount = 0
            
            try {
                // Restore blocked elements
                this.blockedElements.forEach((originalStyles, element) => {
                    if (element.parentNode) {
                        element.style.display = originalStyles.originalDisplay
                        element.style.visibility = originalStyles.originalVisibility
                        element.style.opacity = originalStyles.originalOpacity
                        element.removeAttribute('data-babel-blocked')
                        restoredCount++
                    }
                })
                
                // Clear tracking sets
                this.blockedElements.clear()
                this.hiddenElements.clear()
                this.isAdBlockingActive = false
                
                // Disconnect mutation observer
                if (this.mutationObserver) {
                    this.mutationObserver.disconnect()
                }
                
                return {
                    success: true,
                    restoredCount: restoredCount,
                    timestamp: Date.now()
                }
                
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    restoredCount: restoredCount
                }
            }
        },
        
        // Check if URL matches ad patterns
        isAdUrl: function(url) {
            if (!url) return false
            return this.adUrlPatterns.some(pattern => pattern.test(url))
        },
        
        // Set up mutation observer to catch dynamically added ads
        setupMutationObserver: function() {
            if (this.mutationObserver) {
                this.mutationObserver.disconnect()
            }
            
            this.mutationObserver = new MutationObserver(mutations => {
                if (!this.isAdBlockingActive) return
                
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if the new element matches ad selectors
                            this.adSelectors.forEach(selector => {
                                try {
                                    if (node.matches && node.matches(selector)) {
                                        this.hideElement(node)
                                    }
                                    
                                    // Check children as well
                                    const childAds = node.querySelectorAll(selector)
                                    childAds.forEach(ad => this.hideElement(ad))
                                } catch (e) {
                                    // Ignore selector errors
                                }
                            })
                        }
                    })
                })
            })
            
            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            })
        },
        
        // Helper to hide an element
        hideElement: function(element) {
            if (!this.hiddenElements.has(element)) {
                this.blockedElements.set(element, {
                    originalDisplay: element.style.display,
                    originalVisibility: element.style.visibility,
                    originalOpacity: element.style.opacity
                })
                
                element.style.display = 'none'
                element.setAttribute('data-babel-blocked', 'true')
                this.hiddenElements.add(element)
            }
        },
        
        // Get current ad blocking state
        getBlockingState: function() {
            return {
                isActive: this.isAdBlockingActive,
                blockedCount: this.hiddenElements.size,
                timestamp: Date.now()
            }
        },
        
        // Highlight blocked elements for debugging
        highlightBlocked: function(highlight = true) {
            const blockedElements = document.querySelectorAll('[data-babel-blocked="true"]')
            blockedElements.forEach(element => {
                if (highlight) {
                    element.style.outline = '2px solid red'
                    element.style.backgroundColor = 'rgba(255, 0, 0, 0.1)'
                } else {
                    element.style.outline = ''
                    element.style.backgroundColor = ''
                }
            })
            
            return {
                success: true,
                highlightedCount: blockedElements.length,
                highlighted: highlight
            }
        }
    }

})()