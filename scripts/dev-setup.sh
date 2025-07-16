#!/bin/bash

set -euo pipefail

# Babel Feed Development Environment Setup Script for Ubuntu 24 in OpenAI Codex Agent.
# It runs in a headless environment for code agent initialization. 
# Script must not use admin privileges. 

# Create local directories
mkdir -p $HOME/.local/bin
mkdir -p $HOME/.local/lib
mkdir -p $HOME/.local/share

# Add local bin to PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

# Java, Node.js, and Bun are already provided by the system. Skipping their installation.

# Install Android SDK
# cd $HOME
# mkdir -p android-sdk
# cd android-sdk

# ANDROID_SDK_TOOLS_VERSION="11076708"
# wget https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_SDK_TOOLS_VERSION}_latest.zip > /dev/null 2>&1
# unzip commandlinetools-linux-${ANDROID_SDK_TOOLS_VERSION}_latest.zip > /dev/null 2>&1
# rm commandlinetools-linux-${ANDROID_SDK_TOOLS_VERSION}_latest.zip

# ANDROID_SDK_ROOT="$HOME/android-sdk"
# echo "export ANDROID_SDK_ROOT=\"$HOME/android-sdk\"" >> ~/.bashrc
# echo "export ANDROID_HOME=\"$HOME/android-sdk\"" >> ~/.bashrc

# mkdir -p cmdline-tools/latest
# mv cmdline-tools/bin cmdline-tools/latest/
# mv cmdline-tools/lib cmdline-tools/latest/
# mv cmdline-tools/NOTICE.txt cmdline-tools/latest/
# mv cmdline-tools/source.properties cmdline-tools/latest/
# chmod +x "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager"  # Ensure sdkmanager is executable
# echo "export PATH=\"$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH\"" >> ~/.bashrc
# echo "export PATH=\"$ANDROID_SDK_ROOT/platform-tools:$PATH\"" >> ~/.bashrc

# # Check Java availability
# if ! command -v java >/dev/null 2>&1; then
#   echo "Java is not available in PATH"
#   exit 1
# fi
# java -version

# # Accept Android SDK licenses more robustly
# mkdir -p "$ANDROID_SDK_ROOT/licenses"
# echo "8933bad161af4178b1185d1a37fbf41ea5269c55" > "$ANDROID_SDK_ROOT/licenses/android-sdk-license"
# echo "d56f5187479451eabf01fb78af6dfcb131a6481e" >> "$ANDROID_SDK_ROOT/licenses/android-sdk-license"
# echo "24333f8a63b6825ea9c5514f83c2829b004d1fee" >> "$ANDROID_SDK_ROOT/licenses/android-sdk-license"

# # Install Android SDK packages (show output for debugging, use --no_https to work around SSL issues)
# "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --no_https --sdk_root="$ANDROID_SDK_ROOT" "platform-tools"
# "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --no_https --sdk_root="$ANDROID_SDK_ROOT" "platforms;android-33"
# "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --no_https --sdk_root="$ANDROID_SDK_ROOT" "build-tools;33.0.0"

# # Install Gradle (user-level)
# cd $HOME
# mkdir -p dev-tools
# cd dev-tools
# GRADLE_VERSION="8.4"
# wget https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip > /dev/null 2>&1
# unzip gradle-${GRADLE_VERSION}-bin.zip > /dev/null 2>&1
# mv gradle-${GRADLE_VERSION} $HOME/.local/gradle
# ln -sf $HOME/.local/gradle/bin/gradle $HOME/.local/bin/gradle
# rm gradle-${GRADLE_VERSION}-bin.zip

# Setup project if in correct directory
cd /workspace/babel-feed
if [[ -f "package.json" && -f "README.md" ]]; then
    bun install > /dev/null 2>&1
    
    # cd apps/babel-android
    # ./gradlew build --no-daemon > /dev/null 2>&1
    # cd ../..

    cd packages/pgdb
    touch .env
    
    if [[ ! -f ".env" ]]; then
        cat > .env << EOF
NODE_ENV=development
JWT_SECRET=development_secret_key_for_local_testing_only
PORT=3000
HOST=0.0.0.0
RATE_LIMIT_ENABLED=false
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=86400000
ENABLE_CACHING=true
ENABLE_STREAMING=true
ENABLE_QUALITY_ASSESSMENT=true
MAILGUN_API_KEY=test-key-for-development
MAILGUN_DOMAIN=test.mailgun.org
EOF
    fi
fi

# Clean up temporary files
rm -rf $HOME/dev-tools

