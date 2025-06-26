#!/bin/bash

# Local Test Runner Script
# Runs tests in local development environment

set -e

echo "🧪 Running Appium tests in local environment..."

# Check if Android emulator is running
if ! adb devices | grep -q "emulator"; then
    echo "❌ No Android emulator detected. Please start an emulator first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    bun install
fi

# Run all tests
echo "🚀 Starting test suite..."
bun test

echo "✅ Local test run completed!"