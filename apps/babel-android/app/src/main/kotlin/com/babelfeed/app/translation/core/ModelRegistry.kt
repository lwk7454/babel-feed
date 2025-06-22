package com.babelfeed.app.translation.core

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Registry for managing and accessing translation strategies
 * Provides plugin-based architecture for adding new translation models
 */
interface ModelRegistry {
    /**
     * Register a new translation strategy
     * @param strategy The strategy to register
     */
    fun registerStrategy(strategy: TranslationStrategy)
    
    /**
     * Unregister a translation strategy
     * @param modelType The type of model to unregister
     */
    fun unregisterStrategy(modelType: ModelType)
    
    /**
     * Get all registered strategies
     * @return List of all registered strategies
     */
    fun getAllStrategies(): List<TranslationStrategy>
    
    /**
     * Get strategies by model type
     * @param modelType The type of model to find
     * @return Strategy matching the model type, null if not found
     */
    fun getStrategy(modelType: ModelType): TranslationStrategy?
    
    /**
     * Get strategies that can handle a specific request
     * @param request The translation request
     * @return List of strategies that can handle the request
     */
    suspend fun getCompatibleStrategies(request: TranslationRequest): List<TranslationStrategy>
    
    /**
     * Get strategies by priority order
     * @return Strategies sorted by priority (ascending)
     */
    fun getStrategiesByPriority(): List<TranslationStrategy>
    
    /**
     * Observable state of registered strategies
     */
    val strategiesFlow: StateFlow<List<TranslationStrategy>>
    
    /**
     * Clear all registered strategies
     */
    fun clear()
}

/**
 * Default implementation of ModelRegistry
 */
@Singleton
class DefaultModelRegistry @Inject constructor() : ModelRegistry {
    
    private val strategies = ConcurrentHashMap<ModelType, TranslationStrategy>()
    private val _strategiesFlow = MutableStateFlow<List<TranslationStrategy>>(emptyList())
    
    override val strategiesFlow: StateFlow<List<TranslationStrategy>> = 
        _strategiesFlow.asStateFlow()
    
    override fun registerStrategy(strategy: TranslationStrategy) {
        strategies[strategy.modelType] = strategy
        updateStrategiesFlow()
    }
    
    override fun unregisterStrategy(modelType: ModelType) {
        strategies.remove(modelType)
        updateStrategiesFlow()
    }
    
    override fun getAllStrategies(): List<TranslationStrategy> {
        return strategies.values.toList()
    }
    
    override fun getStrategy(modelType: ModelType): TranslationStrategy? {
        return strategies[modelType]
    }
    
    override suspend fun getCompatibleStrategies(request: TranslationRequest): List<TranslationStrategy> {
        return strategies.values.filter { strategy ->
            try {
                strategy.canHandle(request) && strategy.isAvailable()
            } catch (e: Exception) {
                // Log error and exclude strategy
                false
            }
        }.sortedBy { it.priority }
    }
    
    override fun getStrategiesByPriority(): List<TranslationStrategy> {
        return strategies.values.sortedBy { it.priority }
    }
    
    override fun clear() {
        strategies.clear()
        updateStrategiesFlow()
    }
    
    private fun updateStrategiesFlow() {
        _strategiesFlow.value = strategies.values.toList()
    }
}

/**
 * Builder for creating and configuring model registry
 */
class ModelRegistryBuilder {
    private val strategies = mutableListOf<TranslationStrategy>()
    
    /**
     * Add a strategy to the registry
     */
    fun addStrategy(strategy: TranslationStrategy): ModelRegistryBuilder {
        strategies.add(strategy)
        return this
    }
    
    /**
     * Add multiple strategies
     */
    fun addStrategies(vararg strategies: TranslationStrategy): ModelRegistryBuilder {
        this.strategies.addAll(strategies)
        return this
    }
    
    /**
     * Build the configured registry
     */
    fun build(): ModelRegistry {
        val registry = DefaultModelRegistry()
        strategies.forEach { registry.registerStrategy(it) }
        return registry
    }
}

/**
 * Registry configuration for different environments
 */
data class RegistryConfig(
    val enabledModelTypes: Set<ModelType>,
    val defaultPriorities: Map<ModelType, Int>,
    val maxStrategiesPerType: Int = 1
)

/**
 * Extension functions for easier registry usage
 */
fun ModelRegistry.hasStrategy(modelType: ModelType): Boolean {
    return getStrategy(modelType) != null
}

fun ModelRegistry.getEnabledModelTypes(): Set<ModelType> {
    return getAllStrategies().map { it.modelType }.toSet()
}

suspend fun ModelRegistry.getBestStrategy(request: TranslationRequest): TranslationStrategy? {
    return getCompatibleStrategies(request).firstOrNull()
}