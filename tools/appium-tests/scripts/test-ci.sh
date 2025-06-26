#!/bin/bash

# CI Test Runner Script
# Runs tests in CI environment with proper setup

set -e

echo "🏗️ Running Appium tests in CI environment..."

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Start Android emulator (CI specific)
if [ "$CI" = "true" ]; then
    echo "🤖 Starting Android emulator for CI..."
    # CI-specific emulator setup would go here
    # echo "no" | avdmanager create avd -n test -k "system-images;android-30;google_apis;x86_64"
    # emulator -avd test -no-snapshot -no-window -no-boot-anim -camera-back none -camera-front none &
    # adb wait-for-device
fi

# Run tests with CI-friendly output
echo "🚀 Starting CI test suite..."
bun test --reporter=verbose

echo "✅ CI test run completed!"