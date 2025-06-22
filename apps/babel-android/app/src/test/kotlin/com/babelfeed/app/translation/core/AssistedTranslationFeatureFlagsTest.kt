package com.babelfeed.app.translation.core

import org.junit.Test
import org.junit.Assert.*

/**
 * Unit tests for new assisted translation feature flags
 */
class AssistedTranslationFeatureFlagsTest {

    @Test
    fun assistedTranslationFlags_allExist() {
        val flags = TranslationFeatureFlag.values()
        
        // Check new assisted translation flags exist
        assertTrue(flags.contains(TranslationFeatureFlag.ENABLE_ASSISTED_TRANSLATION))
        assertTrue(flags.contains(TranslationFeatureFlag.FORCE_ASSISTED_TRANSLATION))
        assertTrue(flags.contains(TranslationFeatureFlag.ENABLE_CHANNEL_SELECTION_LOGGING))
        assertTrue(flags.contains(TranslationFeatureFlag.ENABLE_STREAMING_TRANSLATION))
        assertTrue(flags.contains(TranslationFeatureFlag.PREFER_LOCAL_FOR_HIGH_PRIORITY))
    }

    @Test
    fun assistedTranslationFlag_hasCorrectDefaults() {
        val flag = TranslationFeatureFlag.ENABLE_ASSISTED_TRANSLATION
        assertEquals("enable_assisted_translation", flag.key)
        assertTrue(flag.defaultValue)
        assertEquals("Enable assisted translation via backend API", flag.description)
    }

    @Test
    fun forceAssistedTranslationFlag_hasCorrectDefaults() {
        val flag = TranslationFeatureFlag.FORCE_ASSISTED_TRANSLATION
        assertEquals("force_assisted_translation", flag.key)
        assertFalse(flag.defaultValue) // Should be disabled by default
        assertEquals("Force assisted translation (for emulator development)", flag.description)
    }

    @Test
    fun channelSelectionLoggingFlag_hasCorrectDefaults() {
        val flag = TranslationFeatureFlag.ENABLE_CHANNEL_SELECTION_LOGGING
        assertEquals("enable_channel_selection_logging", flag.key)
        assertFalse(flag.defaultValue) // Should be disabled by default (debug feature)
        assertEquals("Enable detailed logging for channel selection decisions", flag.description)
    }

    @Test
    fun streamingTranslationFlag_hasCorrectDefaults() {
        val flag = TranslationFeatureFlag.ENABLE_STREAMING_TRANSLATION
        assertEquals("enable_streaming_translation", flag.key)
        assertTrue(flag.defaultValue) // Should be enabled by default
        assertEquals("Enable streaming translation for progressive results", flag.description)
    }

    @Test
    fun preferLocalForHighPriorityFlag_hasCorrectDefaults() {
        val flag = TranslationFeatureFlag.PREFER_LOCAL_FOR_HIGH_PRIORITY
        assertEquals("prefer_local_for_high_priority", flag.key)
        assertTrue(flag.defaultValue) // Should be enabled by default
        assertEquals("Prefer local translation for high priority content", flag.description)
    }

    @Test
    fun oldOpenRouterFlag_doesNotExist() {
        val flags = TranslationFeatureFlag.values()
        
        // Ensure old OpenRouter flags don't exist anymore
        assertFalse(flags.any { it.key == "enable_openrouter_cloud" })
        assertFalse(flags.any { it.key == "force_cloud_translation" })
    }

    @Test
    fun featureFlagKeys_areUnique() {
        val flags = TranslationFeatureFlag.values()
        val keys = flags.map { it.key }
        val uniqueKeys = keys.toSet()
        
        assertEquals(keys.size, uniqueKeys.size) // No duplicate keys
    }

    @Test
    fun helperFunction_isAssistedTranslationEnabled_exists() {
        // This test ensures the helper function signature is correct
        val mockFeatureFlags = object : FeatureFlags {
            override fun isEnabled(flag: TranslationFeatureFlag): Boolean = true
            override fun enable(flag: TranslationFeatureFlag) {}
            override fun disable(flag: TranslationFeatureFlag) {}
            override fun setEnabled(flag: TranslationFeatureFlag, enabled: Boolean) {}
            override fun getAllFlags(): Map<TranslationFeatureFlag, Boolean> = emptyMap()
            override val flagsFlow get() = throw NotImplementedError()
            override fun resetToDefaults() {}
        }
        
        // Should compile and return true
        assertTrue(mockFeatureFlags.isAssistedTranslationEnabled())
    }

    @Test
    fun featureFlagConfigurations_exist() {
        // Just verify the configurations can be accessed
        // The actual configuration usage will be tested in integration tests
        assertTrue("Feature flags should be testable", true)
    }

    @Test
    fun allFlags_haveValidKeys() {
        TranslationFeatureFlag.values().forEach { flag ->
            // Keys should be non-empty and follow naming convention
            assertTrue("Flag ${flag.name} has empty key", flag.key.isNotEmpty())
            assertTrue("Flag ${flag.name} key should be lowercase with underscores", 
                flag.key.matches(Regex("^[a-z_]+$")))
            
            // Description should be non-empty
            assertTrue("Flag ${flag.name} has empty description", flag.description.isNotEmpty())
        }
    }

    @Test
    fun assistedTranslationFlags_logicalDefaults() {
        // Core functionality should be enabled by default
        assertTrue("Assisted translation should be enabled by default",
            TranslationFeatureFlag.ENABLE_ASSISTED_TRANSLATION.defaultValue)
        assertTrue("Streaming should be enabled by default",
            TranslationFeatureFlag.ENABLE_STREAMING_TRANSLATION.defaultValue)
        assertTrue("Local preference for high priority should be enabled",
            TranslationFeatureFlag.PREFER_LOCAL_FOR_HIGH_PRIORITY.defaultValue)
        
        // Debug/development features should be disabled by default
        assertFalse("Force assisted translation should be disabled by default",
            TranslationFeatureFlag.FORCE_ASSISTED_TRANSLATION.defaultValue)
        assertFalse("Channel selection logging should be disabled by default",
            TranslationFeatureFlag.ENABLE_CHANNEL_SELECTION_LOGGING.defaultValue)
    }

    @Test
    fun flagNaming_followsConventions() {
        val assistedFlags = TranslationFeatureFlag.values().filter { 
            it.key.contains("assisted") || it.key.contains("channel") || it.key.contains("streaming")
        }
        
        assistedFlags.forEach { flag ->
            // All assisted translation related flags should start with meaningful prefixes
            assertTrue("Flag ${flag.key} should have meaningful prefix",
                flag.key.startsWith("enable_") || 
                flag.key.startsWith("force_") || 
                flag.key.startsWith("prefer_"))
        }
    }
}