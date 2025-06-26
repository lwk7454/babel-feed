package com.babelfeed.app.webview

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import com.babelfeed.app.utils.PreferencesManager
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Serializable
data class TranslationState(
    val isEnabled: Boolean = false,
    val isDynamicModeEnabled: Boolean = false,
    val isAdBlockingEnabled: Boolean = true,
    val targetLanguage: String = "en",
    val sourceLanguage: String = "auto",
    val lastTranslatedAt: Long = 0L,
    val translationCache: Map<String, String> = emptyMap(), // nodeId -> translatedText
    val userPreferences: UserTranslationPreferences = UserTranslationPreferences()
)

@Serializable
data class UserTranslationPreferences(
    val autoTranslateOnNavigation: Boolean = true,
    val persistDynamicMode: Boolean = true,
    val showTranslationProgress: Boolean = true,
    val translationTimeout: Long = 30000L,
    val preferredLanguages: List<String> = listOf("en")
)

@Serializable
data class DomainTranslationConfig(
    val domain: String,
    val isTranslationEnabled: Boolean = true,
    val preferredSourceLanguage: String = "auto",
    val customSettings: Map<String, String> = emptyMap()
)

/**
 * Manages translation state persistence across WebView navigation
 * Provides domain-specific translation preferences and state restoration
 */
class TranslationStateManager(private val context: Context) {
    
    private val preferences: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    
    // In-memory cache for active session
    private val sessionState = ConcurrentHashMap<String, TranslationState>()
    private val domainConfigs = ConcurrentHashMap<String, DomainTranslationConfig>()
    
    companion object {
        private const val TAG = "TranslationStateManager"
        private const val PREFS_NAME = "babel_translation_state"
        private const val KEY_GLOBAL_STATE = "global_translation_state"
        private const val KEY_DOMAIN_CONFIGS = "domain_configs"
        private const val KEY_SESSION_STATE = "session_state"
        
        // Global settings keys
        private const val KEY_AUTO_TRANSLATE = "auto_translate_on_navigation"
        private const val KEY_PERSIST_DYNAMIC = "persist_dynamic_mode"
        private const val KEY_TARGET_LANGUAGE = "default_target_language"
        
        @Volatile
        private var INSTANCE: TranslationStateManager? = null
        
        fun getInstance(context: Context): TranslationStateManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: TranslationStateManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
    
    init {
        loadPersistedState()
        Log.d(TAG, "TranslationStateManager initialized with ${domainConfigs.size} domain configs")
    }
    
    fun getUserPreferredTargetLanguage(): String {
        return try {
            val entryPoint = EntryPointAccessors.fromApplication(
                context.applicationContext,
                TranslationStateManagerEntryPoint::class.java
            )
            val preferencesManager = entryPoint.preferencesManager()
            val targetLanguage = preferencesManager.getTranslationTargetLanguage(context)
            Log.d(TAG, "Using target language from preferences: $targetLanguage")
            targetLanguage
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get target language from preferences, using default: en", e)
            "en" // Fallback to English instead of Chinese
        }
    }

    /**
     * Save translation state for a specific URL
     */
    fun saveTranslationState(url: String, state: TranslationState) {
        try {
            val domain = extractDomain(url)
            val key = getStateKey(url)
            
            Log.d(TAG, "Saving translation state for $domain: enabled=${state.isEnabled}, dynamic=${state.isDynamicModeEnabled}")
            
            // Update session cache
            sessionState[key] = state
            
            // Persist to SharedPreferences
            val stateJson = json.encodeToString(state)
            preferences.edit()
                .putString(key, stateJson)
                .putLong("${key}_timestamp", System.currentTimeMillis())
                .apply()
                
            // Update domain config if needed
            updateDomainConfig(domain, state)
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save translation state for $url", e)
        }
    }

    /**
     * Restore translation state for a specific URL
     */
    fun restoreTranslationState(url: String): TranslationState {
        return try {
            val key = getStateKey(url)
            val domain = extractDomain(url)
            
            // First check session cache
            sessionState[key]?.let { cachedState ->
                Log.d(TAG, "Restored translation state from session cache for $domain")
                return cachedState
            }
            
            // Then check persistent storage
            val stateJson = preferences.getString(key, null)
            if (stateJson != null) {
                val state = json.decodeFromString<TranslationState>(stateJson)
                sessionState[key] = state // Cache for session
                Log.d(TAG, "Restored translation state from storage for $domain: enabled=${state.isEnabled}")
                return state
            }
            
            // Fall back to domain-specific config
            val domainConfig = getDomainConfig(domain)
            val defaultState = createDefaultState(domainConfig)
            Log.d(TAG, "Using default translation state for $domain: enabled=${defaultState.isEnabled}")
            
            defaultState
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to restore translation state for $url", e)
            createDefaultState()
        }
    }

    /**
     * Check if auto-translation should be enabled for a URL
     */
    fun shouldAutoTranslate(url: String): Boolean {
        val state = restoreTranslationState(url)
        val globalAutoTranslate = preferences.getBoolean(KEY_AUTO_TRANSLATE, true)
        
        return globalAutoTranslate && 
               state.userPreferences.autoTranslateOnNavigation && 
               state.isEnabled
    }

    /**
     * Get domain-specific translation configuration
     */
    fun getDomainConfig(domain: String): DomainTranslationConfig {
        return domainConfigs[domain] ?: createDefaultDomainConfig(domain)
    }

    /**
     * Update domain-specific configuration
     */
    fun updateDomainConfig(domain: String, state: TranslationState) {
        val config = DomainTranslationConfig(
            domain = domain,
            isTranslationEnabled = state.isEnabled,
            preferredSourceLanguage = state.sourceLanguage,
            customSettings = mapOf(
                "dynamicMode" to state.isDynamicModeEnabled.toString(),
                "targetLanguage" to state.targetLanguage,
                "adBlocking" to state.isAdBlockingEnabled.toString()
            )
        )
        
        domainConfigs[domain] = config
        persistDomainConfigs()
    }

    /**
     * Clear translation state for a specific URL or domain
     */
    fun clearTranslationState(url: String) {
        try {
            val key = getStateKey(url)
            val domain = extractDomain(url)
            
            // Remove from session cache
            sessionState.remove(key)
            
            // Remove from persistent storage
            preferences.edit()
                .remove(key)
                .remove("${key}_timestamp")
                .apply()
                
            Log.d(TAG, "Cleared translation state for $domain")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear translation state for $url", e)
        }
    }

    /**
     * Get global translation preferences
     */
    fun getGlobalPreferences(): UserTranslationPreferences {
        return try {
            val prefsJson = preferences.getString(KEY_GLOBAL_STATE, null)
            if (prefsJson != null) {
                json.decodeFromString<UserTranslationPreferences>(prefsJson)
            } else {
                UserTranslationPreferences()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load global preferences", e)
            UserTranslationPreferences()
        }
    }

    /**
     * Update global translation preferences
     */
    fun updateGlobalPreferences(preferences: UserTranslationPreferences) {
        try {
            val prefsJson = json.encodeToString(preferences)
            this.preferences.edit()
                .putString(KEY_GLOBAL_STATE, prefsJson)
                .putBoolean(KEY_AUTO_TRANSLATE, preferences.autoTranslateOnNavigation)
                .putBoolean(KEY_PERSIST_DYNAMIC, preferences.persistDynamicMode)
                .putString(KEY_TARGET_LANGUAGE, preferences.preferredLanguages.firstOrNull() ?: getUserPreferredTargetLanguage())
                .apply()
                
            Log.d(TAG, "Updated global translation preferences")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update global preferences", e)
        }
    }

    /**
     * Check if translation state exists for URL
     */
    fun hasTranslationState(url: String): Boolean {
        val key = getStateKey(url)
        return sessionState.containsKey(key) || preferences.contains(key)
    }

    /**
     * Get all domains with saved translation state
     */
    fun getSavedDomains(): List<String> {
        return domainConfigs.keys.toList()
    }

    /**
     * Get translation statistics
     */
    fun getTranslationStats(): Map<String, Any> {
        val totalDomains = domainConfigs.size
        val enabledDomains = domainConfigs.values.count { it.isTranslationEnabled }
        val sessionStates = sessionState.size
        
        return mapOf(
            "totalDomains" to totalDomains,
            "enabledDomains" to enabledDomains,
            "sessionStates" to sessionStates,
            "globalPreferences" to getGlobalPreferences(),
            "domains" to domainConfigs.keys.toList()
        )
    }

    /**
     * Clean up old translation states (older than 30 days)
     */
    fun cleanupOldStates() {
        try {
            val cutoffTime = System.currentTimeMillis() - (30 * 24 * 60 * 60 * 1000L) // 30 days
            val editor = preferences.edit()
            var cleanedCount = 0
            
            preferences.all.forEach { (key, _) ->
                if (key.endsWith("_timestamp")) {
                    val timestamp = preferences.getLong(key, 0L)
                    if (timestamp < cutoffTime) {
                        val stateKey = key.removeSuffix("_timestamp")
                        editor.remove(stateKey)
                        editor.remove(key)
                        cleanedCount++
                    }
                }
            }
            
            editor.apply()
            Log.d(TAG, "Cleaned up $cleanedCount old translation states")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cleanup old states", e)
        }
    }

    // Private helper methods
    
    private fun loadPersistedState() {
        try {
            // Load domain configs
            val domainConfigsJson = preferences.getString(KEY_DOMAIN_CONFIGS, null)
            if (domainConfigsJson != null) {
                val configs = json.decodeFromString<Map<String, DomainTranslationConfig>>(domainConfigsJson)
                domainConfigs.putAll(configs)
            }
            
            Log.d(TAG, "Loaded ${domainConfigs.size} domain configurations")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load persisted state", e)
        }
    }

    private fun persistDomainConfigs() {
        try {
            val configsJson = json.encodeToString(domainConfigs.toMap())
            preferences.edit()
                .putString(KEY_DOMAIN_CONFIGS, configsJson)
                .apply()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist domain configs", e)
        }
    }

    private fun getStateKey(url: String): String {
        val domain = extractDomain(url)
        return "state_$domain"
    }

    private fun extractDomain(url: String): String {
        return try {
            val urlObj = URL(url)
            urlObj.host.lowercase()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to extract domain from $url, using fallback")
            url.hashCode().toString()
        }
    }

    private fun createDefaultState(domainConfig: DomainTranslationConfig? = null): TranslationState {
        val globalPrefs = getGlobalPreferences()
        
        return TranslationState(
            isEnabled = domainConfig?.isTranslationEnabled ?: false,
            isDynamicModeEnabled = globalPrefs.persistDynamicMode,
            isAdBlockingEnabled = true,
            targetLanguage = globalPrefs.preferredLanguages.firstOrNull() ?: getUserPreferredTargetLanguage(),
            sourceLanguage = domainConfig?.preferredSourceLanguage ?: "auto",
            userPreferences = globalPrefs
        )
    }

    private fun createDefaultDomainConfig(domain: String): DomainTranslationConfig {
        return DomainTranslationConfig(
            domain = domain,
            isTranslationEnabled = true,
            preferredSourceLanguage = "auto"
        )
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface TranslationStateManagerEntryPoint {
    fun preferencesManager(): PreferencesManager
}