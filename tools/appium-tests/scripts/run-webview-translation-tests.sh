#!/bin/bash

# WebView Translation Test Runner
# Comprehensive script to run webview translation tests with proper setup and cleanup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORTS_DIR="$PROJECT_ROOT/reports"
BACKEND_LOG="$REPORTS_DIR/backend.log"
APPIUM_LOG="$REPORTS_DIR/appium.log"
TEST_LOG="$REPORTS_DIR/test.log"

# Test configuration
TEST_TIMEOUT=${TEST_TIMEOUT:-600} # 10 minutes default
EMULATOR_NAME=${EMULATOR_NAME:-Pixel_6a_API_33}
HEADLESS=${HEADLESS:-true}
VERBOSE=${VERBOSE:-false}

# PIDs for cleanup
BACKEND_PID=""
APPIUM_PID=""
EMULATOR_PID=""

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$TEST_LOG"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$TEST_LOG"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1" | tee -a "$TEST_LOG"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$TEST_LOG"
}

# Cleanup function
cleanup() {
    log "🧹 Starting cleanup..."
    
    # Stop test processes
    if [ ! -z "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        log "Stopping backend service (PID: $BACKEND_PID)..."
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
        sleep 3
        kill -KILL "$BACKEND_PID" 2>/dev/null || true
    fi
    
    if [ ! -z "$APPIUM_PID" ] && kill -0 "$APPIUM_PID" 2>/dev/null; then
        log "Stopping Appium server (PID: $APPIUM_PID)..."
        kill -TERM "$APPIUM_PID" 2>/dev/null || true
        sleep 3
        kill -KILL "$APPIUM_PID" 2>/dev/null || true
    fi
    
    # Clean up any remaining Appium processes
    pkill -f "appium" 2>/dev/null || true
    
    # Stop emulator if we started it
    if [ "$EMULATOR_STARTED_BY_SCRIPT" = "true" ] && [ ! -z "$EMULATOR_PID" ]; then
        log "Stopping emulator..."
        adb -s emulator-5554 emu kill 2>/dev/null || true
        kill -TERM "$EMULATOR_PID" 2>/dev/null || true
    fi
    
    log "✅ Cleanup completed"
}

# Set up cleanup trap
trap cleanup EXIT INT TERM

# Create reports directory
mkdir -p "$REPORTS_DIR"
mkdir -p "$REPORTS_DIR/screenshots"

# Clear previous logs
> "$TEST_LOG"
> "$BACKEND_LOG"
> "$APPIUM_LOG"

log "🚀 Starting WebView Translation Test Suite"
log "Project Root: $PROJECT_ROOT"
log "Reports Directory: $REPORTS_DIR"
log "Test Timeout: ${TEST_TIMEOUT}s"
log "Emulator: $EMULATOR_NAME"
log "Headless Mode: $HEADLESS"

# Step 1: Check prerequisites
log "🔍 Checking prerequisites..."

# Check if required tools are installed
for tool in adb emulator appium bun; do
    if ! command -v "$tool" &> /dev/null; then
        log_error "$tool is not installed or not in PATH"
        exit 1
    fi
done

log_success "All required tools are available"

# Step 2: Check emulator status
log "📱 Checking emulator status..."

EMULATOR_RUNNING=false
EMULATOR_STARTED_BY_SCRIPT=false

if adb devices | grep -q "emulator-5554.*device"; then
    log_success "Emulator is already running"
    EMULATOR_RUNNING=true
else
    log "Emulator not running, attempting to start..."
    
    # Check if AVD exists
    if ! emulator -list-avds | grep -q "$EMULATOR_NAME"; then
        log_error "Android Virtual Device '$EMULATOR_NAME' not found"
        log "Available AVDs:"
        emulator -list-avds
        exit 1
    fi
    
    # Start emulator
    log "Starting emulator $EMULATOR_NAME..."
    if [ "$HEADLESS" = "true" ]; then
        emulator -avd "$EMULATOR_NAME" -no-window -no-audio -gpu swiftshader_indirect > "$REPORTS_DIR/emulator.log" 2>&1 &
    else
        emulator -avd "$EMULATOR_NAME" > "$REPORTS_DIR/emulator.log" 2>&1 &
    fi
    
    EMULATOR_PID=$!
    EMULATOR_STARTED_BY_SCRIPT=true
    
    # Wait for emulator to be ready
    log "Waiting for emulator to boot..."
    timeout 120 bash -c '
        while ! adb devices | grep -q "emulator-5554.*device"; do
            sleep 5
        done
        while [ "$(adb shell getprop sys.boot_completed 2>/dev/null)" != "1" ]; do
            sleep 5
        done
    '
    
    if [ $? -eq 0 ]; then
        log_success "Emulator started and ready"
        EMULATOR_RUNNING=true
    else
        log_error "Emulator failed to start within timeout"
        exit 1
    fi
fi

# Step 3: Start backend API service
log "🦊 Starting backend API service..."

cd "$PROJECT_ROOT/../.." # Go to project root

# Check if backend is already running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    log_success "Backend API is already running"
else
    log "Starting backend API service..."
    
    # Start backend service
    if command -v bun &> /dev/null; then
        bun run dev:api > "$BACKEND_LOG" 2>&1 &
    else
        npm run dev:api > "$BACKEND_LOG" 2>&1 &
    fi
    
    BACKEND_PID=$!
    
    # Wait for backend to be ready
    log "Waiting for backend API to be ready..."
    timeout 60 bash -c '
        while ! curl -s http://localhost:3000/health > /dev/null 2>&1; do
            sleep 2
        done
    '
    
    if [ $? -eq 0 ]; then
        log_success "Backend API is ready"
    else
        log_error "Backend API failed to start within timeout"
        log "Backend log:"
        tail -20 "$BACKEND_LOG"
        exit 1
    fi
fi

# Step 4: Start Appium server
log "🤖 Starting Appium server..."

cd "$PROJECT_ROOT"

# Check if Appium is already running
if curl -s http://localhost:4723/status > /dev/null 2>&1; then
    log_success "Appium server is already running"
else
    log "Starting Appium server..."
    
    appium --port 4723 --log-level warn > "$APPIUM_LOG" 2>&1 &
    APPIUM_PID=$!
    
    # Wait for Appium to be ready
    log "Waiting for Appium server to be ready..."
    timeout 30 bash -c '
        while ! curl -s http://localhost:4723/status > /dev/null 2>&1; do
            sleep 2
        done
    '
    
    if [ $? -eq 0 ]; then
        log_success "Appium server is ready"
    else
        log_error "Appium server failed to start within timeout"
        log "Appium log:"
        tail -20 "$APPIUM_LOG"
        exit 1
    fi
fi

# Step 5: Install/Update app if needed
log "📦 Checking app installation..."

APP_PACKAGE="com.babelfeed.app.debug"
APK_PATH="../../apps/babel-android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    log "Installing/updating app from $APK_PATH..."
    adb install -r "$APK_PATH"
    if [ $? -eq 0 ]; then
        log_success "App installed successfully"
    else
        log_warning "App installation failed, continuing with existing installation"
    fi
else
    log_warning "APK not found at $APK_PATH, using existing installation"
fi

# Check if app is installed
if adb shell pm list packages | grep -q "$APP_PACKAGE"; then
    log_success "App is installed"
else
    log_error "App is not installed and APK not found"
    exit 1
fi

# Step 6: Run the tests
log "🧪 Running WebView Translation Tests..."

# Set environment variables for the test
export HEADLESS="$HEADLESS"
export VERBOSE="$VERBOSE"
export CI=false

# Run the specific webview translation test
log "Starting webview translation test suite..."

if [ "$VERBOSE" = "true" ]; then
    timeout "$TEST_TIMEOUT" bun run test:webview-translation 2>&1 | tee -a "$TEST_LOG"
else
    timeout "$TEST_TIMEOUT" bun run test:webview-translation >> "$TEST_LOG" 2>&1
fi

TEST_EXIT_CODE=$?

# Step 7: Analyze results
log "📊 Analyzing test results..."

if [ $TEST_EXIT_CODE -eq 0 ]; then
    log_success "All tests passed!"
    
    # Extract test summary from logs
    if grep -q "Test Suite Summary" "$TEST_LOG"; then
        log "Test Summary:"
        grep -A 10 "Test Suite Summary" "$TEST_LOG" | tail -10
    fi
    
    # Check for generated reports
    if ls "$REPORTS_DIR"/*.json >/dev/null 2>&1; then
        log "Generated reports:"
        ls -la "$REPORTS_DIR"/*.json
    fi
    
elif [ $TEST_EXIT_CODE -eq 124 ]; then
    log_error "Tests timed out after ${TEST_TIMEOUT} seconds"
    exit 1
else
    log_error "Tests failed with exit code: $TEST_EXIT_CODE"
    
    # Show recent log entries
    log "Recent test output:"
    tail -50 "$TEST_LOG"
    
    # Check for screenshots
    if ls "$REPORTS_DIR/screenshots"/*.png >/dev/null 2>&1; then
        log "Screenshots captured:"
        ls -la "$REPORTS_DIR/screenshots"/*.png
    fi
    
    exit 1
fi

# Step 8: Generate summary report
log "📄 Generating summary report..."

SUMMARY_REPORT="$REPORTS_DIR/test-summary-$(date +%Y%m%d-%H%M%S).md"

cat > "$SUMMARY_REPORT" << EOF
# WebView Translation Test Summary

**Date:** $(date)  
**Duration:** Test completed successfully  
**Environment:** Android Emulator ($EMULATOR_NAME)  
**Headless Mode:** $HEADLESS  

## Test Configuration
- Test Timeout: ${TEST_TIMEOUT}s
- Emulator: $EMULATOR_NAME
- App Package: $APP_PACKAGE
- Backend API: http://localhost:3000
- Appium Server: http://localhost:4723

## Test Results
$(if [ $TEST_EXIT_CODE -eq 0 ]; then echo "✅ **All tests passed**"; else echo "❌ **Tests failed**"; fi)

## Generated Artifacts
- Test Log: \`$TEST_LOG\`
- Backend Log: \`$BACKEND_LOG\`
- Appium Log: \`$APPIUM_LOG\`
$(if ls "$REPORTS_DIR"/*.json >/dev/null 2>&1; then echo "- Test Reports: \`$(ls "$REPORTS_DIR"/*.json | tr '\n' ' ')\`"; fi)
$(if ls "$REPORTS_DIR/screenshots"/*.png >/dev/null 2>&1; then echo "- Screenshots: \`$(ls "$REPORTS_DIR/screenshots"/*.png | wc -l) files\`"; fi)

## Logs
### Test Output (last 100 lines)
\`\`\`
$(tail -100 "$TEST_LOG")
\`\`\`

EOF

log_success "Summary report generated: $SUMMARY_REPORT"

# Final cleanup will be handled by the trap
log_success "WebView Translation Test Suite completed successfully!"

exit $TEST_EXIT_CODE