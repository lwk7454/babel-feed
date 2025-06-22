package com.babelfeed.app.ui.screens.webview

import android.webkit.WebView
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.babelfeed.app.webview.BabelWebViewBridge
import com.babelfeed.app.webview.BabelWebViewClient
import com.babelfeed.app.webview.DynamicWebViewBridge
import com.babelfeed.app.webview.StreamingTranslationService
import com.babelfeed.app.webview.ExtractedContent
import com.babelfeed.app.webview.TranslationBatch
import com.babelfeed.app.webview.DynamicContentUpdate
import com.babelfeed.app.webview.StreamingTranslationResult
import com.babelfeed.app.webview.TranslationBatchUpdate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebViewScreen(
    url: String,
    onBackClick: () -> Unit,
    translationService: StreamingTranslationService
) {
    var isTranslationEnabled by remember { mutableStateOf(true) }
    var isAdBlockingEnabled by remember { mutableStateOf(true) }
    var isDynamicModeEnabled by remember { mutableStateOf(true) }
    var extractedContent by remember { mutableStateOf<ExtractedContent?>(null) }
    var translationBatch by remember { mutableStateOf<TranslationBatch?>(null) }
    var dynamicContentUpdate by remember { mutableStateOf<DynamicContentUpdate?>(null) }
    var streamingResults by remember { mutableStateOf<List<StreamingTranslationResult>>(emptyList()) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var bridge by remember { mutableStateOf<BabelWebViewBridge?>(null) }
    var dynamicBridge by remember { mutableStateOf<DynamicWebViewBridge?>(null) }
    var showDropdown by remember { mutableStateOf(false) }
    var translationError by remember { mutableStateOf<String?>(null) }
    var showErrorBanner by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Article") },
            navigationIcon = {
                IconButton(onClick = onBackClick) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                }
            },
            actions = {
                IconButton(onClick = { showDropdown = true }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = "Menu")
                }
                DropdownMenu(
                    expanded = showDropdown,
                    onDismissRequest = { showDropdown = false }
                ) {
                    DropdownMenuItem(
                        text = { 
                            Text("${if (isTranslationEnabled) "Disable" else "Enable"} Translation") 
                        },
                        onClick = {
                            if (!isTranslationEnabled) {
                                // First time enabling translation - extract content
                                Log.d("BabelWebView", "Enabling translation, extracting content...")
                                bridge?.extractContent()
                            }
                            
                            if (isDynamicModeEnabled) {
                                dynamicBridge?.toggleAllTranslations()
                            } else {
                                bridge?.toggleTranslation()
                            }
                            isTranslationEnabled = !isTranslationEnabled
                            showDropdown = false
                        }
                    )
                    DropdownMenuItem(
                        text = { 
                            Text("${if (isDynamicModeEnabled) "Disable" else "Enable"} Dynamic Mode") 
                        },
                        onClick = {
                            if (isDynamicModeEnabled) {
                                dynamicBridge?.stopDynamicMode()
                            } else {
                                dynamicBridge?.startDynamicMode()
                            }
                            isDynamicModeEnabled = !isDynamicModeEnabled
                            showDropdown = false
                        }
                    )
                    DropdownMenuItem(
                        text = { 
                            Text("${if (isAdBlockingEnabled) "Disable" else "Enable"} Ad Block") 
                        },
                        onClick = {
                            if (isAdBlockingEnabled) {
                                bridge?.disableAds()
                            } else {
                                bridge?.blockAds()
                            }
                            isAdBlockingEnabled = !isAdBlockingEnabled
                            showDropdown = false
                        }
                    )
                }
            }
        )

        // Translation Error Banner
        if (showErrorBanner && translationError != null) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Filled.Warning,
                        contentDescription = "Translation Error",
                        tint = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Translation service is experiencing issues. Please try again later.",
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = { 
                            showErrorBanner = false
                            translationError = null
                        },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Dismiss",
                            tint = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }

        AndroidView(
            factory = { context ->
                WebView(context).apply {
                    val webViewBridge = BabelWebViewBridge(
                        webView = this,
                        translationService = translationService,
                        onContentExtracted = { content ->
                            Log.d("BabelWebView", "Content extracted: ${content.textNodes.size} nodes")
                            extractedContent = content
                        },
                        onTranslationComplete = { batch ->
                            Log.d("BabelWebView", "Translation complete: ${batch.totalProcessed} items")
                            translationBatch = batch
                        },
                        onTranslationError = { error ->
                            Log.e("BabelWebView", "Translation error: $error")
                            translationError = error
                            showErrorBanner = true
                        }
                    )
                    
                    val dynamicWebViewBridge = DynamicWebViewBridge(
                        webView = this,
                        streamingTranslationService = translationService,
                        onDynamicContentExtracted = { update ->
                            Log.d("BabelWebView", "Dynamic content: ${update.textNodes.size} nodes (${update.type})")
                            dynamicContentUpdate = update
                        },
                        onStreamingTranslationUpdate = { result ->
                            Log.d("BabelWebView", "Streaming translation: ${result.id} (${result.progress})")
                            streamingResults = streamingResults + result
                        },
                        onTranslationError = { error ->
                            Log.e("BabelWebView", "Dynamic translation error: $error")
                            translationError = error
                            showErrorBanner = true
                        }
                    )
                    
                    webViewClient = BabelWebViewClient(
                        bridge = webViewBridge,
                        adBlockingEnabled = isAdBlockingEnabled,
                        autoTranslateEnabled = false
                    )
                    
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        allowFileAccess = true
                        allowContentAccess = true
                        setSupportZoom(true)
                        builtInZoomControls = true
                        displayZoomControls = false
                    }
                    
                    webView = this
                    bridge = webViewBridge
                    dynamicBridge = dynamicWebViewBridge
                    
                    // Initialize both bridges after WebView is set up
                    webViewBridge.initialize()
                    dynamicWebViewBridge.initialize()
                    
                    loadUrl(url)
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            update = { _ ->
                // WebView is updated
            }
        )
    }
    
    // Auto-start translation and dynamic mode when bridges are available
    LaunchedEffect(bridge, dynamicBridge) {
        val currentBridge = bridge
        val currentDynamicBridge = dynamicBridge
        
        if (currentBridge != null && currentDynamicBridge != null && isTranslationEnabled && isDynamicModeEnabled) {
            // Add a small delay to ensure page is loaded
            kotlinx.coroutines.delay(1000)
            
            // Start dynamic mode first
            currentDynamicBridge.startDynamicMode()
            
            // Then extract content for translation
            currentBridge.extractContent()
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            bridge?.cleanup()
            dynamicBridge?.cleanup()
        }
    }
}