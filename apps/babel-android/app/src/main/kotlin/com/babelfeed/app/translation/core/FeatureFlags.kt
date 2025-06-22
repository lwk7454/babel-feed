package com.babelfeed.app.translation.core

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Feature flag system for gradual rollout and A/B testing of translation features
 */
interface FeatureFlags {
    /**
     * Check if a feature is enabled
     * @param flag The feature flag to check
     * @return true if the feature is enabled
     */
    fun isEnabled(flag: TranslationFeatureFlag): Boolean
    
    /**
     * Enable a feature flag
     * @param flag The feature flag to enable
     */
    fun enable(flag: TranslationFeatureFlag)
    
    /**
     * Disable a feature flag
     * @param flag The feature flag to disable
     */
    fun disable(flag: TranslationFeatureFlag)
    
    /**
     * Set a feature flag value
     * @param flag The feature flag to set
     * @param enabled Whether the flag should be enabled
     */
    fun setEnabled(flag: TranslationFeatureFlag, enabled: Boolean)
    
    /**
     * Get all feature flag states
     * @return Map of all flags and their states
     */
    fun getAllFlags(): Map<TranslationFeatureFlag, Boolean>
    
    /**
     * Observable state of feature flags
     */
    val flagsFlow: StateFlow<Map<TranslationFeatureFlag, Boolean>>
    
    /**
     * Reset all flags to default values
     */
    fun resetToDefaults()
}

/**
 * Translation-specific feature flags
 */
enum class TranslationFeatureFlag(
    val key: String,
    val defaultValue: Boolean,
    val description: String
) {
    // Core translation features
    ENABLE_ML_KIT_TRANSLATION(
        "enable_ml_kit_translation",
        true,
        "Enable ML Kit on-device translation"
    ),
    
    ENABLE_ASSISTED_TRANSLATION(
        "enable_assisted_translation", 
        true,
        "Enable assisted translation via backend API"
    ),
    
    ENABLE_GEMINI_NANO(
        "enable_gemini_nano",
        false,
        "Enable Gemini Nano on-device AI (experimental)"
    ),
    
    // Quality and optimization features
    ENABLE_QUALITY_FALLBACK(
        "enable_quality_fallback",
        true,
        "Enable automatic fallback when translation quality is poor"
    ),
    
    ENABLE_TRANSLATION_CACHING(
        "enable_translation_caching",
        true,
        "Enable caching of translation results"
    ),
    
    ENABLE_SMART_MODEL_SELECTION(
        "enable_smart_model_selection",
        true,
        "Enable intelligent model selection based on content"
    ),
    
    // Content analysis features
    ENABLE_CONTENT_SEGMENTATION(
        "enable_content_segmentation",
        true,
        "Enable smart content segmentation"
    ),
    
    ENABLE_CONTEXT_ENHANCEMENT(
        "enable_context_enhancement",
        false,
        "Enable context-aware translation with background research"
    ),
    
    ENABLE_HTML_STRUCTURE_PRESERVATION(
        "enable_html_structure_preservation",
        true,
        "Preserve HTML structure during translation"
    ),
    
    // Performance features
    
    ENABLE_PARALLEL_PROCESSING(
        "enable_parallel_processing",
        true,
        "Enable parallel translation of multiple segments"
    ),
    
    ENABLE_PERFORMANCE_MONITORING(
        "enable_performance_monitoring",
        true,
        "Enable performance monitoring and optimization"
    ),
    
    // Future features
    ENABLE_REAL_TIME_DUBBING(
        "enable_real_time_dubbing",
        false,
        "Enable real-time video dubbing (future feature)"
    ),
    
    ENABLE_AI_NARRATION(
        "enable_ai_narration",
        false,
        "Enable AI-powered article narration (future feature)"
    ),
    
    ENABLE_ENHANCED_SUBTITLES(
        "enable_enhanced_subtitles",
        false,
        "Enable AI-enhanced subtitle generation (future feature)"
    ),
    
    // Development and testing
    ENABLE_MOCK_TRANSLATION(
        "enable_mock_translation",
        false,
        "Enable mock translation for testing"
    ),
    
    ENABLE_DEBUG_LOGGING(
        "enable_debug_logging",
        false,
        "Enable detailed debug logging for translation"
    ),
    
    FORCE_ASSISTED_TRANSLATION(
        "force_assisted_translation",
        false,
        "Force assisted translation (for emulator development)"
    ),
    
    ENABLE_CHANNEL_SELECTION_LOGGING(
        "enable_channel_selection_logging",
        false,
        "Enable detailed logging for channel selection decisions"
    ),
    
    ENABLE_STREAMING_TRANSLATION(
        "enable_streaming_translation",
        true,
        "Enable streaming translation for progressive results"
    ),
    
    PREFER_LOCAL_FOR_HIGH_PRIORITY(
        "prefer_local_for_high_priority",
        true,
        "Prefer local translation for high priority content"
    )
}

/**
 * Default implementation of FeatureFlags using SharedPreferences
 */
@Singleton
class DefaultFeatureFlags @Inject constructor(
    private val context: Context
) : FeatureFlags {
    
    private val prefs: SharedPreferences = context.getSharedPreferences(
        "translation_feature_flags",
        Context.MODE_PRIVATE
    )
    
    private val _flagsFlow = MutableStateFlow(getCurrentFlags())
    override val flagsFlow: StateFlow<Map<TranslationFeatureFlag, Boolean>> = 
        _flagsFlow.asStateFlow()
    
    override fun isEnabled(flag: TranslationFeatureFlag): Boolean {
        return prefs.getBoolean(flag.key, flag.defaultValue)
    }
    
    override fun enable(flag: TranslationFeatureFlag) {
        setEnabled(flag, true)
    }
    
    override fun disable(flag: TranslationFeatureFlag) {
        setEnabled(flag, false)
    }
    
    override fun setEnabled(flag: TranslationFeatureFlag, enabled: Boolean) {
        prefs.edit()
            .putBoolean(flag.key, enabled)
            .apply()
        updateFlagsFlow()
    }
    
    override fun getAllFlags(): Map<TranslationFeatureFlag, Boolean> {
        return TranslationFeatureFlag.values().associateWith { isEnabled(it) }
    }
    
    override fun resetToDefaults() {
        val editor = prefs.edit()
        TranslationFeatureFlag.values().forEach { flag ->
            editor.putBoolean(flag.key, flag.defaultValue)
        }
        editor.apply()
        updateFlagsFlow()
    }
    
    private fun getCurrentFlags(): Map<TranslationFeatureFlag, Boolean> {
        return TranslationFeatureFlag.values().associateWith { isEnabled(it) }
    }
    
    private fun updateFlagsFlow() {
        _flagsFlow.value = getCurrentFlags()
    }
}

/**
 * Feature flag configuration for different build types
 */
object FeatureFlagConfig {
    /**
     * Development configuration - enable experimental features
     */
    val DEVELOPMENT = mapOf(
        TranslationFeatureFlag.ENABLE_DEBUG_LOGGING to true,
        TranslationFeatureFlag.FORCE_ASSISTED_TRANSLATION to true,
        TranslationFeatureFlag.ENABLE_MOCK_TRANSLATION to false,
        TranslationFeatureFlag.ENABLE_GEMINI_NANO to false // Not available on emulator
    )
    
    /**
     * Testing configuration - controlled environment
     */
    val TESTING = mapOf(
        TranslationFeatureFlag.ENABLE_MOCK_TRANSLATION to true,
        TranslationFeatureFlag.ENABLE_DEBUG_LOGGING to true,
        TranslationFeatureFlag.ENABLE_PERFORMANCE_MONITORING to true
    )
    
    /**
     * Production configuration - stable features only
     */
    val PRODUCTION = mapOf(
        TranslationFeatureFlag.ENABLE_ML_KIT_TRANSLATION to true,
        TranslationFeatureFlag.ENABLE_ASSISTED_TRANSLATION to true,
        TranslationFeatureFlag.ENABLE_QUALITY_FALLBACK to true,
        TranslationFeatureFlag.ENABLE_TRANSLATION_CACHING to true,
        TranslationFeatureFlag.ENABLE_SMART_MODEL_SELECTION to true,
        TranslationFeatureFlag.ENABLE_CONTENT_SEGMENTATION to true,
        TranslationFeatureFlag.ENABLE_STREAMING_TRANSLATION to true,
        TranslationFeatureFlag.ENABLE_PARALLEL_PROCESSING to true,
        TranslationFeatureFlag.ENABLE_PERFORMANCE_MONITORING to true
    )
}

/**
 * Helper functions for easier feature flag usage
 */
fun FeatureFlags.isMLKitEnabled(): Boolean = isEnabled(TranslationFeatureFlag.ENABLE_ML_KIT_TRANSLATION)
fun FeatureFlags.isAssistedTranslationEnabled(): Boolean = isEnabled(TranslationFeatureFlag.ENABLE_ASSISTED_TRANSLATION)
fun FeatureFlags.isGeminiNanoEnabled(): Boolean = isEnabled(TranslationFeatureFlag.ENABLE_GEMINI_NANO)
fun FeatureFlags.isQualityFallbackEnabled(): Boolean = isEnabled(TranslationFeatureFlag.ENABLE_QUALITY_FALLBACK)
fun FeatureFlags.isCachingEnabled(): Boolean = isEnabled(TranslationFeatureFlag.ENABLE_TRANSLATION_CACHING)
fun FeatureFlags.isStreamingEnabled(): Boolean = isEnabled(TranslationFeatureFlag.ENABLE_STREAMING_TRANSLATION)
fun FeatureFlags.isDebugLoggingEnabled(): Boolean = isEnabled(TranslationFeatureFlag.ENABLE_DEBUG_LOGGING)

/**
 * Apply a configuration to feature flags
 */
fun FeatureFlags.applyConfig(config: Map<TranslationFeatureFlag, Boolean>) {
    config.forEach { (flag, enabled) ->
        setEnabled(flag, enabled)
    }
}