package com.babelfeed.app

import androidx.activity.ComponentActivity
import dagger.hilt.android.AndroidEntryPoint

/**
 * Test-only activity for Hilt instrumented tests.
 * 
 * This follows Android/Hilt industry best practices:
 * 1. Lives in src/debug/ so it's only available in debug builds
 * 2. Annotated with @AndroidEntryPoint to enable Hilt injection
 * 3. Extends ComponentActivity for Compose testing compatibility
 * 4. Minimal implementation - no UI setup, just Hilt support
 */
@AndroidEntryPoint
class TestActivity : ComponentActivity()