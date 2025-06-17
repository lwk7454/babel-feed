#!/bin/bash
set -e

# 📱 Simple Tauri Android Build Script
# ===================================
# Supports only the required build modes for this project

BUILD_TYPE="debug"
CLEAN_BUILD=false

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}🔧 $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

show_help() {
    cat << EOF
📱 Simple Tauri Android Build

USAGE:
    ./scripts/build.sh [OPTIONS]

OPTIONS:
    --debug, -d         Debug build (default)
    --release, -r       Release build for production
    --clean, -c         Clean build (removes previous build artifacts)
    --help, -h          Show this help

EXAMPLES:
    ./scripts/build.sh              # Debug build
    ./scripts/build.sh --release    # Release build
    ./scripts/build.sh --clean -d   # Clean debug build

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--debug)
            BUILD_TYPE="debug"
            shift
            ;;
        -r|--release)
            BUILD_TYPE="release"
            shift
            ;;
        -c|--clean)
            CLEAN_BUILD=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if we're in the right directory
if [ ! -f "src-tauri/Cargo.toml" ]; then
    log_error "Must be run from apps/babel-mobile directory"
    exit 1
fi

log_info "Building Tauri Android app ($BUILD_TYPE mode)"

# Clean build if requested
if [ "$CLEAN_BUILD" = "true" ]; then
    log_info "Cleaning previous build artifacts..."
    rm -rf dist/babel-mobile-ng
    rm -rf src-tauri/target
    rm -rf src-tauri/gen
fi

# Build Angular frontend
log_info "Building Angular frontend..."
if [ "$BUILD_TYPE" = "release" ]; then
    nx build babel-mobile --configuration=production
else
    nx build babel-mobile --configuration=development
fi

# Build Tauri Android app
log_info "Building Tauri Android app..."
cd src-tauri

if [ "$BUILD_TYPE" = "release" ]; then
    tauri android build --target aarch64
else
    tauri android build --debug --target aarch64
fi

cd ..

# Show result
if [ "$BUILD_TYPE" = "release" ]; then
    # Check both possible release APK locations
    APK_PATH="src-tauri/gen/android/app/build/outputs/apk/aarch64/release/app-aarch64-release-unsigned.apk"
    if [ ! -f "$APK_PATH" ]; then
        APK_PATH="src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk"
    fi
else
    # Check both possible debug APK locations
    APK_PATH="src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk"
    if [ ! -f "$APK_PATH" ]; then
        APK_PATH="src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"
    fi
fi

if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    log_success "Build completed successfully!"
    log_info "APK: $APK_PATH ($APK_SIZE)"
else
    log_error "Build failed - APK not found"
    log_info "Checked locations:"
    if [ "$BUILD_TYPE" = "release" ]; then
        log_info "  - src-tauri/gen/android/app/build/outputs/apk/aarch64/release/app-aarch64-release-unsigned.apk"
        log_info "  - src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk"
    else
        log_info "  - src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk"
        log_info "  - src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"
    fi
    exit 1
fi 