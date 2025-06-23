package com.babelfeed.app.webview

import android.graphics.Bitmap
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.ByteArrayInputStream

class BabelWebViewClient(
    private val bridge: BabelWebViewBridge,
    private val stateManager: TranslationStateManager? = null,
    private val adBlockingEnabled: Boolean = true,
    private val autoTranslateEnabled: Boolean = false,
    private val onUrlChanged: ((String) -> Unit)? = null
) : WebViewClient() {

    companion object {
        private const val TAG = "BabelWebViewClient"
        
        // Common ad domains to block
        private val AD_DOMAINS = setOf(
            "googlesyndication.com",
            "doubleclick.net",
            "googletagmanager.com",
            "facebook.com",
            "analytics.google.com",
            "google-analytics.com",
            "googleadservices.com",
            "amazon-adsystem.com",
            "scorecardresearch.com",
            "outbrain.com",
            "taboola.com",
            "adsystem.amazon.com"
        )
        
        // Ad-related URL patterns
        private val AD_PATTERNS = setOf(
            "/ads/",
            "/advertisement/",
            "/banner/",
            "ads.",
            "ad.",
            "analytics",
            "tracking",
            "doubleclick",
            "googleadservices"
        )
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        Log.d(TAG, "Page started loading: $url")
        
        // Notify URL change for state management
        url?.let { newUrl ->
            onUrlChanged?.invoke(newUrl)
        }
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        Log.d(TAG, "Page finished loading: $url")
        
        view?.let { webView ->
            // Initialize the bridge after page load
            bridge.initialize()
            
            // Check translation state for this URL
            val translationState = url?.let { stateManager?.restoreTranslationState(it) }
            
            // Block ads based on saved state or default setting
            val shouldBlockAds = translationState?.isAdBlockingEnabled ?: adBlockingEnabled
            if (shouldBlockAds) {
                bridge.blockAds()
            }
            
            // Auto-translate based on saved state or default setting
            val shouldAutoTranslate = url?.let { stateManager?.shouldAutoTranslate(it) } ?: autoTranslateEnabled
            if (shouldAutoTranslate || (translationState?.isEnabled == true)) {
                Log.d(TAG, "Auto-translating page: $url (state=${translationState?.isEnabled}, auto=$shouldAutoTranslate)")
                // Wait a bit for the page to fully render
                webView.postDelayed({
                    bridge.extractContent()
                }, 1000)
            } else {
                Log.d(TAG, "Skipping auto-translation for: $url (state=${translationState?.isEnabled}, auto=$shouldAutoTranslate)")
            }
        }
    }

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
    ): WebResourceResponse? {
        request?.url?.let { uri ->
            val url = uri.toString()
            
            // Block ad requests if ad blocking is enabled
            if (adBlockingEnabled && isAdRequest(url)) {
                Log.d(TAG, "Blocked ad request: $url")
                return createEmptyResponse()
            }
            
            // Log network requests for debugging
            if (Log.isLoggable(TAG, Log.DEBUG)) {
                Log.d(TAG, "Network request: $url")
            }
        }
        
        return super.shouldInterceptRequest(view, request)
    }

    private fun isAdRequest(url: String): Boolean {
        val lowerUrl = url.lowercase()
        
        // Check against known ad domains
        if (AD_DOMAINS.any { domain -> lowerUrl.contains(domain) }) {
            return true
        }
        
        // Check against ad patterns
        if (AD_PATTERNS.any { pattern -> lowerUrl.contains(pattern) }) {
            return true
        }
        
        // Check for common ad file extensions
        if (lowerUrl.matches(Regex(".*\\.(gif|jpg|jpeg|png).*[?&](ad|ads|banner).*"))) {
            return true
        }
        
        return false
    }

    private fun createEmptyResponse(): WebResourceResponse {
        return WebResourceResponse(
            "text/plain",
            "utf-8",
            ByteArrayInputStream("".toByteArray())
        )
    }
    
    /**
     * Check if the URL represents a page navigation (not an asset or API call)
     */
    private fun isNavigationUrl(url: String): Boolean {
        val lowerUrl = url.lowercase()
        
        // Exclude common asset types
        val assetExtensions = listOf(
            ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff", ".woff2", ".ttf", ".eot"
        )
        
        // Exclude API endpoints
        val apiPatterns = listOf(
            "/api/", "/ajax/", "/xhr/", "analytics", "tracking", "ads"
        )
        
        // Check if it's not an asset or API call
        return !assetExtensions.any { ext -> lowerUrl.endsWith(ext) } &&
               !apiPatterns.any { pattern -> lowerUrl.contains(pattern) } &&
               (lowerUrl.startsWith("http://") || lowerUrl.startsWith("https://"))
    }

    override fun onReceivedError(
        view: WebView?,
        errorCode: Int,
        description: String?,
        failingUrl: String?
    ) {
        super.onReceivedError(view, errorCode, description, failingUrl)
        Log.e(TAG, "WebView error: $errorCode - $description for URL: $failingUrl")
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        // Handle URL navigation for state management
        request?.url?.toString()?.let { newUrl ->
            Log.d(TAG, "URL loading: $newUrl")
            
            // Check if this is a navigation to a new page
            if (isNavigationUrl(newUrl)) {
                // Save current state before navigation if stateManager is available
                stateManager?.let { manager ->
                    // The state will be saved by the WebViewScreen's onUrlChanged callback
                    Log.d(TAG, "Preparing for navigation to: $newUrl")
                }
            }
        }
        
        // Allow normal navigation
        return false
    }
}