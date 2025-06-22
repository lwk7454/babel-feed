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
    private val adBlockingEnabled: Boolean = true,
    private val autoTranslateEnabled: Boolean = false
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
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        Log.d(TAG, "Page finished loading: $url")
        
        view?.let { webView ->
            // Initialize the bridge after page load
            bridge.initialize()
            
            // Block ads if enabled
            if (adBlockingEnabled) {
                bridge.blockAds()
            }
            
            // Auto-translate if enabled
            if (autoTranslateEnabled) {
                // Wait a bit for the page to fully render
                webView.postDelayed({
                    bridge.extractContent()
                }, 1000)
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
        // Allow normal navigation
        return false
    }
}