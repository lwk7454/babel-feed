package com.babelfeed.app.translation.core

import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.junit.Assert.*
import org.junit.Before

/**
 * Unit tests for ChannelSelector implementations
 */
class ChannelSelectorTest {

    private lateinit var channelSelector: DefaultChannelSelector
    private lateinit var enhancedChannelSelector: EnhancedChannelSelectorImpl

    @Before
    fun setup() {
        channelSelector = DefaultChannelSelector()
        enhancedChannelSelector = EnhancedChannelSelectorImpl()
    }

    @Test
    fun selectChannel_urgentPriority_prefersLocal() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.selectChannel(
            priority = TranslationPriority.URGENT,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertEquals(TranslationChannel.LOCAL, result)
    }

    @Test
    fun selectChannel_highPriority_prefersLocal() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.selectChannel(
            priority = TranslationPriority.HIGH,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertEquals(TranslationChannel.LOCAL, result)
    }

    @Test
    fun selectChannel_normalPriority_prefersAssisted() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.selectChannel(
            priority = TranslationPriority.NORMAL,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertEquals(TranslationChannel.ASSISTED, result)
    }

    @Test
    fun selectChannel_lowPriority_prefersAssisted() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.selectChannel(
            priority = TranslationPriority.LOW,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertEquals(TranslationChannel.ASSISTED, result)
    }

    @Test
    fun selectChannel_backgroundPriority_prefersAssisted() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.selectChannel(
            priority = TranslationPriority.BACKGROUND,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertEquals(TranslationChannel.ASSISTED, result)
    }

    @Test
    fun isLocalTranslationViable_optimalConditions_returnsTrue() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertTrue(result)
    }

    @Test
    fun isLocalTranslationViable_thermalThrottling_returnsFalse() = runTest {
        val deviceCapability = createOptimalDeviceCapability().copy(
            thermalState = ThermalState.THROTTLED
        )
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertFalse(result)
    }

    @Test
    fun isLocalTranslationViable_lowBatteryNotCharging_returnsFalse() = runTest {
        val deviceCapability = createOptimalDeviceCapability().copy(
            batteryLevel = 0.15f,
            isCharging = false
        )
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertFalse(result)
    }

    @Test
    fun isLocalTranslationViable_lowBatteryButCharging_returnsTrue() = runTest {
        val deviceCapability = createOptimalDeviceCapability().copy(
            batteryLevel = 0.15f,
            isCharging = true
        )
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertTrue(result)
    }

    @Test
    fun isLocalTranslationViable_highCpuUsage_returnsFalse() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad().copy(
            cpuUsage = 0.9f
        )

        val result = channelSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertFalse(result)
    }

    @Test
    fun isLocalTranslationViable_highMemoryUsage_returnsFalse() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad().copy(
            memoryUsage = 0.85f
        )

        val result = channelSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertFalse(result)
    }

    @Test
    fun isLocalTranslationViable_tooManyActiveTranslations_returnsFalse() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad().copy(
            activeTranslations = 5
        )

        val result = channelSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertFalse(result)
    }

    @Test
    fun isLocalTranslationViable_noLocalCapabilities_returnsFalse() = runTest {
        val deviceCapability = createOptimalDeviceCapability().copy(
            mlKitSupported = false,
            geminiNanoSupported = false
        )
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertFalse(result)
    }

    @Test
    fun selectChannel_highPriorityButLocalNotViable_fallsBackToAssisted() = runTest {
        val deviceCapability = createOptimalDeviceCapability().copy(
            thermalState = ThermalState.SEVERE
        )
        val systemLoad = createLowSystemLoad()

        val result = channelSelector.selectChannel(
            priority = TranslationPriority.HIGH,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertEquals(TranslationChannel.ASSISTED, result)
    }

    @Test
    fun enhancedChannelSelector_selectChannelWithReasoning_providesDetailedInfo() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad()

        val result = enhancedChannelSelector.selectChannelWithReasoning(
            priority = TranslationPriority.URGENT,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertEquals(TranslationChannel.LOCAL, result.selectedChannel)
        assertTrue(result.confidence > 0.8f)
        assertTrue(result.reasoning.contains("URGENT"))
        assertEquals(TranslationChannel.ASSISTED, result.fallbackChannel)
    }

    @Test
    fun enhancedChannelSelector_lowPriorityWithReasoning_prefersAssisted() = runTest {
        val deviceCapability = createOptimalDeviceCapability()
        val systemLoad = createLowSystemLoad()

        val result = enhancedChannelSelector.selectChannelWithReasoning(
            priority = TranslationPriority.LOW,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertEquals(TranslationChannel.ASSISTED, result.selectedChannel)
        assertTrue(result.confidence > 0.8f)
        assertTrue(result.reasoning.contains("LOW"))
        assertEquals(TranslationChannel.LOCAL, result.fallbackChannel)
    }

    @Test
    fun enhancedChannelSelector_degradedConditions_providesLowConfidence() = runTest {
        val deviceCapability = createOptimalDeviceCapability().copy(
            thermalState = ThermalState.MODERATE,
            batteryLevel = 0.3f
        )
        val systemLoad = createLowSystemLoad().copy(
            cpuUsage = 0.7f
        )

        val result = enhancedChannelSelector.selectChannelWithReasoning(
            priority = TranslationPriority.HIGH,
            deviceCapability = deviceCapability,
            systemLoad = systemLoad
        )

        assertTrue(result.confidence < 0.8f)
        assertTrue(result.reasoning.contains("thermal") || result.reasoning.contains("battery") || result.reasoning.contains("load"))
    }

    @Test
    fun channelSelectionCriteria_customConfiguration_affectsDecisions() = runTest {
        val strictCriteria = ChannelSelectionCriteria(
            maxLocalLoad = 0.5f,
            minBatteryForLocal = 0.8f,
            thermalThrottleThreshold = ThermalState.OPTIMAL
        )
        val strictSelector = DefaultChannelSelector(strictCriteria)

        val deviceCapability = createOptimalDeviceCapability().copy(
            batteryLevel = 0.6f,
            thermalState = ThermalState.MODERATE
        )
        val systemLoad = createLowSystemLoad().copy(
            cpuUsage = 0.6f
        )

        val result = strictSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertFalse(result) // Should fail strict criteria
    }

    @Test
    fun channelSelectionCriteria_relaxedConfiguration_allowsMoreLocal() = runTest {
        val relaxedCriteria = ChannelSelectionCriteria(
            maxLocalLoad = 0.9f,
            minBatteryForLocal = 0.1f,
            thermalThrottleThreshold = ThermalState.SEVERE
        )
        val relaxedSelector = DefaultChannelSelector(relaxedCriteria)

        val deviceCapability = createOptimalDeviceCapability().copy(
            batteryLevel = 0.15f,
            thermalState = ThermalState.MODERATE
        )
        val systemLoad = createLowSystemLoad().copy(
            cpuUsage = 0.85f
        )

        val result = relaxedSelector.isLocalTranslationViable(deviceCapability, systemLoad)

        assertTrue(result) // Should pass relaxed criteria
    }

    @Test
    fun translationChannel_enumValues_allExist() {
        val channels = TranslationChannel.values()
        assertEquals(2, channels.size)
        assertTrue(channels.contains(TranslationChannel.LOCAL))
        assertTrue(channels.contains(TranslationChannel.ASSISTED))
    }

    // Helper methods to create test data
    private fun createOptimalDeviceCapability(): DeviceCapability {
        return DeviceCapability(
            availableMemoryMB = 8192,
            cpuCores = 8,
            hasNPU = true,
            thermalState = ThermalState.OPTIMAL,
            batteryLevel = 0.8f,
            isCharging = false,
            networkQuality = NetworkQuality.EXCELLENT,
            mlKitSupported = true,
            geminiNanoSupported = true,
            deviceScore = 0.9f
        )
    }

    private fun createLowSystemLoad(): SystemLoad {
        return SystemLoad(
            activeTranslations = 1,
            pendingRequests = 0,
            cpuUsage = 0.3f,
            memoryUsage = 0.4f,
            thermalPressure = 0.2f
        )
    }

    private fun createHighSystemLoad(): SystemLoad {
        return SystemLoad(
            activeTranslations = 4,
            pendingRequests = 2,
            cpuUsage = 0.8f,
            memoryUsage = 0.9f,
            thermalPressure = 0.7f
        )
    }
}