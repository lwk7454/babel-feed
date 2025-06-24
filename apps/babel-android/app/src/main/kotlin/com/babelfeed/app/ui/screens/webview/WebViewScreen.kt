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
import androidx.compose.foundation.layout.WindowInsets
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.babelfeed.app.R
import com.babelfeed.app.webview.BabelWebViewBridge
import com.babelfeed.app.webview.BabelWebViewClient
import com.babelfeed.app.webview.DynamicWebViewBridge
import com.babelfeed.app.webview.StreamingTranslationService
import com.babelfeed.app.webview.ExtractedContent
import com.babelfeed.app.webview.TranslationBatch
import com.babelfeed.app.webview.DynamicContentUpdate
import com.babelfeed.app.webview.StreamingTranslationResult
import com.babelfeed.app.webview.TranslationBatchUpdate
import com.babelfeed.app.webview.TranslationStateManager
import com.babelfeed.app.webview.TranslationState
import androidx.compose.ui.platform.LocalContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WebViewScreen(
    url: String,
    onBackClick: () -> Unit,
    translationService: StreamingTranslationService
) {
    val context = LocalContext.current
    val stateManager = remember { TranslationStateManager.getInstance(context) }
    
    // Restore translation state for the current URL
    val restoredState = remember(url) { stateManager.restoreTranslationState(url) }
    
    var currentUrl by remember { mutableStateOf(url) }
    var isTranslationEnabled by remember { mutableStateOf(restoredState.isEnabled) }
    var isAdBlockingEnabled by remember { mutableStateOf(restoredState.isAdBlockingEnabled) }
    var isDynamicModeEnabled by remember { mutableStateOf(restoredState.isDynamicModeEnabled) }
    var targetLanguage by remember { mutableStateOf(restoredState.targetLanguage) }
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
    
    // Function to save current translation state
    val saveTranslationState = {
        val state = TranslationState(
            isEnabled = isTranslationEnabled,
            isDynamicModeEnabled = isDynamicModeEnabled,
            isAdBlockingEnabled = isAdBlockingEnabled,
            targetLanguage = targetLanguage,
            sourceLanguage = "auto",
            lastTranslatedAt = System.currentTimeMillis(),
            translationCache = emptyMap(), // TODO: Implement cache
            userPreferences = stateManager.getGlobalPreferences()
        )
        stateManager.saveTranslationState(currentUrl, state)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(stringResource(R.string.article)) },
            navigationIcon = {
                IconButton(onClick = onBackClick) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                }
            },
            actions = {
                IconButton(onClick = { showDropdown = true }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = stringResource(R.string.menu))
                }
                DropdownMenu(
                    expanded = showDropdown,
                    onDismissRequest = { showDropdown = false }
                ) {
                    DropdownMenuItem(
                        text = { 
                            Text(if (isTranslationEnabled) stringResource(R.string.disable_translation) else stringResource(R.string.enable_translation)) 
                        },
                        onClick = {
                            if (isDynamicModeEnabled) {
                                dynamicBridge?.toggleAllTranslations()
                            } else {
                                bridge?.toggleTranslation()
                            }
                            isTranslationEnabled = !isTranslationEnabled
                            saveTranslationState() // Save state when toggling translation
                            showDropdown = false
                        }
                    )
                    DropdownMenuItem(
                        text = { 
                            Text(if (isDynamicModeEnabled) stringResource(R.string.disable_dynamic_mode) else stringResource(R.string.enable_dynamic_mode)) 
                        },
                        onClick = {
                            if (isDynamicModeEnabled) {
                                dynamicBridge?.stopDynamicMode()
                            } else {
                                dynamicBridge?.startDynamicMode()
                            }
                            isDynamicModeEnabled = !isDynamicModeEnabled
                            saveTranslationState() // Save state when toggling dynamic mode
                            showDropdown = false
                        }
                    )
                    DropdownMenuItem(
                        text = { 
                            Text(if (isAdBlockingEnabled) stringResource(R.string.disable_ad_block) else stringResource(R.string.enable_ad_block)) 
                        },
                        onClick = {
                            if (isAdBlockingEnabled) {
                                bridge?.disableAds()
                            } else {
                                bridge?.blockAds()
                            }
                            isAdBlockingEnabled = !isAdBlockingEnabled
                            saveTranslationState() // Save state when toggling ad blocking
                            showDropdown = false
                        }
                    )
                }
            },
            windowInsets = WindowInsets(0)
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
                        contentDescription = stringResource(R.string.translation_error),
                        tint = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.translation_service_error),
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
                            contentDescription = stringResource(R.string.dismiss),
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
                        stateManager = stateManager,
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
                        stateManager = stateManager,
                        adBlockingEnabled = isAdBlockingEnabled,
                        autoTranslateEnabled = stateManager.shouldAutoTranslate(url),
                        onUrlChanged = { newUrl ->
                            // Handle URL navigation - restore translation state for new URL
                            Log.d("BabelWebView", "URL changed from $currentUrl to $newUrl")
                            val newState = stateManager.restoreTranslationState(newUrl)
                            
                            // Update UI state
                            currentUrl = newUrl
                            isTranslationEnabled = newState.isEnabled
                            isDynamicModeEnabled = newState.isDynamicModeEnabled
                            isAdBlockingEnabled = newState.isAdBlockingEnabled
                            targetLanguage = newState.targetLanguage
                            
                            // Notify dynamic bridge of URL change
                            dynamicBridge?.onUrlChanged(newUrl)
                            
                            // Clear previous state
                            extractedContent = null
                            translationBatch = null
                            dynamicContentUpdate = null
                            streamingResults = emptyList()
                            translationError = null
                            showErrorBanner = false
                        }
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
                    
                    // Set initial URL for dynamic bridge
                    dynamicWebViewBridge.setCurrentUrl(url)
                    
                    Log.d("WebViewScreen", "Loading URL in WebView: '$url'")
                    Log.d("WebViewScreen", "URL is valid: ${android.util.Patterns.WEB_URL.matcher(url).matches()}")
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
    
    // Auto-start dynamic mode when bridges are available (content extraction handled by WebViewClient)
    LaunchedEffect(bridge, dynamicBridge, currentUrl) {
        val currentBridge = bridge
        val currentDynamicBridge = dynamicBridge
        
        if (currentBridge != null && currentDynamicBridge != null) {
            // Add a small delay to ensure page is loaded
            kotlinx.coroutines.delay(1000)
            
            // Only start dynamic mode if enabled - content extraction is handled by BabelWebViewClient
            if (isDynamicModeEnabled) {
                Log.d("BabelWebView", "Auto-starting dynamic mode for $currentUrl")
                currentDynamicBridge.startDynamicMode()
            }
        }
    }
    
    // Save translation state when component unmounts or URL changes
    DisposableEffect(currentUrl) {
        onDispose {
            saveTranslationState()
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            saveTranslationState()
            bridge?.cleanup()
            dynamicBridge?.cleanup()
        }
    }
}