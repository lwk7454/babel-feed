#!/bin/bash
# Local Appium Test Runner Script
# Provides headed mode and verbose logging for local development

echo "🧪 Starting Babel Feed Appium Tests (Local Mode)"
echo "================================================="

# Set environment variables for local development
export HEADLESS=false
export VERBOSE=true
export CI=false

# Check if emulator is running
echo "📱 Checking if Android emulator is running..."
if ! adb devices | grep -q "device"; then
    echo "❌ No Android devices found. Please start an emulator first:"
    echo "   emulator -list-avds                   # List available AVDs"
    echo "   emulator -avd Pixel_6a_API_33 &        # Start emulator"
    exit 1
fi

echo "✅ Android device found"

# Check if backend API is running
echo "🌐 Checking if backend API is running..."
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "⚠️ Backend API not accessible. Starting it now..."
    echo "   Run: bun run dev:api"
    echo "   Or the tests will run without backend verification"
fi

# Run the tests
echo "🚀 Starting tests in headed mode..."
echo "   - Screenshots: Only on failure"
echo "   - Logging: Verbose"
echo "   - Emulator: Will not auto-start"
echo ""

bun run test

echo ""
echo "📊 Test completed. Check reports/ directory for detailed results."