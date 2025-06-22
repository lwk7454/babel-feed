package com.babelfeed.app.translation.core

/**
 * Selects translation channel (local vs assisted) based on priority and device capabilities
 * Priority determines channel: HIGH/URGENT -> prefer local, NORMAL/LOW -> prefer assisted
 * Complexity is passed to the selected channel for model selection
 */
interface ChannelSelector {
    /**
     * Select the appropriate translation channel based on priority and device state
     * @param priority Translation priority (determines local vs remote preference)
     * @param deviceCapability Current device capabilities
     * @param systemLoad Current system load
     * @return The selected translation channel
     */
    suspend fun selectChannel(
        priority: TranslationPriority,
        deviceCapability: DeviceCapability,
        systemLoad: SystemLoad
    ): TranslationChannel
    
    /**
     * Check if local translation is available and capable
     * @param deviceCapability Current device capabilities
     * @param systemLoad Current system load
     * @return true if local translation is viable
     */
    suspend fun isLocalTranslationViable(
        deviceCapability: DeviceCapability,
        systemLoad: SystemLoad
    ): Boolean
    
    /**
     * Check if assisted translation is available
     * @return true if backend is reachable
     */
    suspend fun isAssistedTranslationAvailable(): Boolean
}

/**
 * Translation channels representing local vs assisted translation
 */
enum class TranslationChannel {
    LOCAL,      // On-device translation (ML Kit, Gemini Nano)
    ASSISTED    // Backend-assisted translation via ElysiaJS API
}

/**
 * Channel selection criteria for decision making
 */
data class ChannelSelectionCriteria(
    val preferLocal: Boolean = true,
    val maxLocalLoad: Float = 0.8f,
    val minBatteryForLocal: Float = 0.2f,
    val thermalThrottleThreshold: ThermalState = ThermalState.MODERATE,
    val allowFallback: Boolean = true
)

/**
 * Default implementation of ChannelSelector
 */
class DefaultChannelSelector(
    private val criteria: ChannelSelectionCriteria = ChannelSelectionCriteria()
) : ChannelSelector {
    
    override suspend fun selectChannel(
        priority: TranslationPriority,
        deviceCapability: DeviceCapability,
        systemLoad: SystemLoad
    ): TranslationChannel {
        
        // Priority-based channel preference
        val preferLocal = when (priority) {
            TranslationPriority.URGENT -> true      // Real-time needs local
            TranslationPriority.HIGH -> true        // User-visible content prefers local
            TranslationPriority.NORMAL -> false     // Standard content can use assisted
            TranslationPriority.LOW -> false        // Background content uses assisted
            TranslationPriority.BACKGROUND -> false // Definitely use assisted
        }
        
        // Check if local is viable when preferred
        if (preferLocal && isLocalTranslationViable(deviceCapability, systemLoad)) {
            return TranslationChannel.LOCAL
        }
        
        // Check if assisted is available as fallback
        if (isAssistedTranslationAvailable()) {
            return TranslationChannel.ASSISTED
        }
        
        // Last resort: use local even if not optimal
        return TranslationChannel.LOCAL
    }
    
    override suspend fun isLocalTranslationViable(
        deviceCapability: DeviceCapability,
        systemLoad: SystemLoad
    ): Boolean {
        // Check thermal state
        if (deviceCapability.thermalState >= criteria.thermalThrottleThreshold) {
            return false
        }
        
        // Check battery level
        if (deviceCapability.batteryLevel < criteria.minBatteryForLocal && !deviceCapability.isCharging) {
            return false
        }
        
        // Check system load
        if (systemLoad.cpuUsage > criteria.maxLocalLoad || 
            systemLoad.memoryUsage > criteria.maxLocalLoad) {
            return false
        }
        
        // Check if too many active translations
        if (systemLoad.activeTranslations > 3) {
            return false
        }
        
        // Check device capabilities
        return deviceCapability.mlKitSupported || deviceCapability.geminiNanoSupported
    }
    
    override suspend fun isAssistedTranslationAvailable(): Boolean {
        // TODO: Implement actual network check to backend
        // For now, return true if network is available
        return true // Placeholder - should check backend health
    }
}

/**
 * Channel selection result with reasoning
 */
data class ChannelSelectionResult(
    val selectedChannel: TranslationChannel,
    val confidence: Float,
    val reasoning: String,
    val fallbackChannel: TranslationChannel? = null
)

/**
 * Enhanced selector that provides detailed reasoning
 */
interface EnhancedChannelSelector : ChannelSelector {
    /**
     * Select channel with detailed reasoning
     */
    suspend fun selectChannelWithReasoning(
        priority: TranslationPriority,
        deviceCapability: DeviceCapability,
        systemLoad: SystemLoad
    ): ChannelSelectionResult
}

/**
 * Enhanced implementation with detailed decision logging
 */
class EnhancedChannelSelectorImpl(
    private val criteria: ChannelSelectionCriteria = ChannelSelectionCriteria()
) : EnhancedChannelSelector {
    
    private val baseSelector = DefaultChannelSelector(criteria)
    
    override suspend fun selectChannel(
        priority: TranslationPriority,
        deviceCapability: DeviceCapability,
        systemLoad: SystemLoad
    ): TranslationChannel = baseSelector.selectChannel(priority, deviceCapability, systemLoad)
    
    override suspend fun isLocalTranslationViable(
        deviceCapability: DeviceCapability,
        systemLoad: SystemLoad
    ): Boolean = baseSelector.isLocalTranslationViable(deviceCapability, systemLoad)
    
    override suspend fun isAssistedTranslationAvailable(): Boolean = 
        baseSelector.isAssistedTranslationAvailable()
    
    override suspend fun selectChannelWithReasoning(
        priority: TranslationPriority,
        deviceCapability: DeviceCapability,
        systemLoad: SystemLoad
    ): ChannelSelectionResult {
        val reasons = mutableListOf<String>()
        
        // Analyze priority preference
        val priorityPrefersLocal = when (priority) {
            TranslationPriority.URGENT, TranslationPriority.HIGH -> {
                reasons.add("Priority $priority prefers local translation")
                true
            }
            else -> {
                reasons.add("Priority $priority allows assisted translation")
                false
            }
        }
        
        // Check local viability
        val localViable = isLocalTranslationViable(deviceCapability, systemLoad)
        if (!localViable) {
            reasons.add("Local translation not viable: thermal=${deviceCapability.thermalState}, battery=${deviceCapability.batteryLevel}, load=${systemLoad.cpuUsage}")
        }
        
        // Check assisted availability
        val assistedAvailable = isAssistedTranslationAvailable()
        if (!assistedAvailable) {
            reasons.add("Assisted translation not available")
        }
        
        // Make decision
        val selectedChannel = when {
            priorityPrefersLocal && localViable -> TranslationChannel.LOCAL
            assistedAvailable -> TranslationChannel.ASSISTED
            else -> TranslationChannel.LOCAL // Last resort
        }
        
        val confidence = when {
            priorityPrefersLocal && localViable -> 0.9f
            !priorityPrefersLocal && assistedAvailable -> 0.85f
            localViable -> 0.7f
            else -> 0.5f // Forced fallback
        }
        
        val fallback = when (selectedChannel) {
            TranslationChannel.LOCAL -> if (assistedAvailable) TranslationChannel.ASSISTED else null
            TranslationChannel.ASSISTED -> if (localViable) TranslationChannel.LOCAL else null
        }
        
        return ChannelSelectionResult(
            selectedChannel = selectedChannel,
            confidence = confidence,
            reasoning = reasons.joinToString("; "),
            fallbackChannel = fallback
        )
    }
}