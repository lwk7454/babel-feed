package com.babelfeed.app.translation.core

/**
 * Interface for selecting the optimal translation model for given content
 */
interface ModelSelector {
    /**
     * Select the best translation strategy for a content segment
     * Uses priority to determine channel (local vs assisted) and complexity for model selection
     * @param segment The content segment to translate
     * @param availableStrategies List of available translation strategies
     * @return The optimal strategy for this content
     */
    fun selectOptimalStrategy(
        segment: ContentSegment,
        availableStrategies: List<TranslationStrategy>
    ): TranslationStrategy?
    
    /**
     * Select translation strategy based on channel preference
     * @param channel Preferred translation channel (local vs assisted)
     * @param complexity Content complexity for model selection within channel
     * @param availableStrategies Available strategies
     * @return The optimal strategy for the given channel and complexity
     */
    fun selectStrategyByChannel(
        channel: TranslationChannel,
        complexity: ComplexityLevel,
        availableStrategies: List<TranslationStrategy>
    ): TranslationStrategy?
    
    /**
     * Get all available translation strategies
     * @return List of currently available strategies
     */
    suspend fun getAvailableStrategies(): List<TranslationStrategy>
    
    /**
     * Assess device capabilities for on-device models
     * @return Device capability assessment
     */
    suspend fun assessDeviceCapabilities(): DeviceCapability
    
    /**
     * Get model capabilities for a specific strategy
     * @param strategy The strategy to evaluate
     * @return Capabilities of the model
     */
    fun getModelCapabilities(strategy: TranslationStrategy): ModelCapability
    
    /**
     * Predict the best strategy without executing translation
     * @param request The translation request to evaluate
     * @return Recommended strategy with confidence score
     */
    suspend fun predictOptimalStrategy(request: TranslationRequest): StrategyRecommendation
}

/**
 * Device capability assessment for on-device models
 */
data class DeviceCapability(
    val availableMemoryMB: Long,
    val cpuCores: Int,
    val hasNPU: Boolean,
    val thermalState: ThermalState,
    val batteryLevel: Float,
    val isCharging: Boolean,
    val networkQuality: NetworkQuality,
    val mlKitSupported: Boolean,
    val geminiNanoSupported: Boolean,
    val deviceScore: Float // Overall capability score 0-1
)

/**
 * Thermal state of the device
 */
enum class ThermalState {
    OPTIMAL,
    MODERATE,
    THROTTLED,
    SEVERE
}

/**
 * Network quality assessment
 */
enum class NetworkQuality {
    EXCELLENT,
    GOOD,
    POOR,
    OFFLINE
}

/**
 * Model capability information
 */
data class ModelCapability(
    val modelType: ModelType,
    val supportedLanguages: Set<String>,
    val supportedLanguagePairs: Set<Pair<String, String>>,
    val maxTokensPerRequest: Int,
    val averageLatencyMs: Long,
    val qualityScore: Float, // 0-1 quality rating
    val resourceRequirements: ResourceRequirements,
    val specializations: Set<ContentSpecialization>
)

/**
 * Resource requirements for a model
 */
data class ResourceRequirements(
    val minMemoryMB: Long,
    val diskSpaceMB: Long,
    val networkRequired: Boolean,
    val apiKeyRequired: Boolean,
    val batteryImpact: BatteryImpact
)

/**
 * Battery impact levels
 */
enum class BatteryImpact {
    MINIMAL,
    LOW,
    MODERATE,
    HIGH
}

/**
 * Content specializations that models excel at
 */
enum class ContentSpecialization {
    GENERAL_TEXT,
    HTML_STRUCTURE,
    TECHNICAL_CONTENT,
    CREATIVE_CONTENT,
    REAL_TIME_TRANSLATION,
    MULTILINGUAL,
    CULTURAL_ADAPTATION
}

/**
 * Strategy recommendation with confidence
 */
data class StrategyRecommendation(
    val strategy: TranslationStrategy,
    val confidence: Float, // 0-1 confidence in recommendation
    val reasoning: String,
    val alternativeStrategies: List<TranslationStrategy> = emptyList(),
    val estimatedPerformance: PerformanceEstimate
)

/**
 * Estimated performance metrics
 */
data class PerformanceEstimate(
    val estimatedLatencyMs: Long,
    val estimatedQuality: Float,
    val estimatedCost: Float, // In credits/tokens
    val estimatedBatteryImpact: BatteryImpact
)

/**
 * Selection criteria weights for model selection
 */
data class SelectionCriteria(
    val prioritizeSpeed: Float = 0.3f,
    val prioritizeQuality: Float = 0.4f,
    val prioritizePrivacy: Float = 0.2f,
    val prioritizeCost: Float = 0.1f,
    val requireOffline: Boolean = false,
    val maxLatencyMs: Long = 5000,
    val minQualityScore: Float = 0.7f
) {
    init {
        val totalWeight = prioritizeSpeed + prioritizeQuality + prioritizePrivacy + prioritizeCost
        require(totalWeight <= 1.1f && totalWeight >= 0.9f) {
            "Selection criteria weights must sum to approximately 1.0"
        }
    }
}

/**
 * Context for model selection decisions
 */
data class SelectionContext(
    val deviceCapability: DeviceCapability,
    val userPreferences: UserTranslationPreferences,
    val selectionCriteria: SelectionCriteria,
    val currentLoad: SystemLoad
)

/**
 * Current system load information
 */
data class SystemLoad(
    val activeTranslations: Int,
    val pendingRequests: Int,
    val cpuUsage: Float,
    val memoryUsage: Float,
    val thermalPressure: Float
)