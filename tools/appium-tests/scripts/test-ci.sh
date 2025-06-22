#!/bin/bash
# CI Appium Test Runner Script
# Optimized for continuous integration environments

echo "🧪 Starting Babel Feed Appium Tests (CI Mode)"
echo "=============================================="

# Set environment variables for CI
export HEADLESS=true
export VERBOSE=false
export CI=true

# Verify environment
echo "🔍 Verifying CI environment..."

# Check Java
if ! java -version &> /dev/null; then
    echo "❌ Java not found"
    exit 1
fi

# Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo "❌ ANDROID_HOME not set"
    exit 1
fi

# Check ADB
if ! command -v adb &> /dev/null; then
    echo "❌ ADB not found"
    exit 1
fi

# Check if Appium is installed
if ! command -v appium &> /dev/null; then
    echo "📦 Installing Appium..."
    npm install -g appium
    appium driver install uiautomator2
fi

# Check if emulator is running (should be started by CI setup)
echo "📱 Checking Android emulator..."
if ! adb devices | grep -q "device"; then
    echo "❌ No Android devices found in CI environment"
    exit 1
fi

echo "✅ CI environment verified"

# Start Appium server in background
echo "🚀 Starting Appium server..."
appium --port 4723 &
APPIUM_PID=$!

# Wait for Appium to start
sleep 10

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up..."
    if [ ! -z "$APPIUM_PID" ]; then
        kill $APPIUM_PID 2>/dev/null
    fi
}
trap cleanup EXIT

# Run the tests
echo "🧪 Running tests in CI mode..."
echo "   - Screenshots: On failure"
echo "   - Logging: Minimal"
echo "   - Timeout: Reduced for CI"
echo ""

bun run test

# Capture exit code
TEST_EXIT_CODE=$?

# Generate CI-friendly output
echo ""
echo "📊 Test Results:"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed"
else
    echo "❌ Some tests failed (exit code: $TEST_EXIT_CODE)"
fi

# Upload artifacts if available
if [ -d "reports" ]; then
    echo "📁 Test reports generated in reports/ directory"
    # In real CI, you might upload these as artifacts
fi

exit $TEST_EXIT_CODE