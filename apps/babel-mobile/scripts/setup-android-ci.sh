#!/bin/bash
set -e

echo "🤖 Setting up Android CI environment..."

# Detect runner architecture
if [[ $(uname -m) == "aarch64" || $(uname -m) == "arm64" ]]; then
    echo "🔧 Detected ARM64 runner"
    RUNNER_ARCH="arm64"
    DEFAULT_ANDROID_ARCH="arm64-v8a"
else
    echo "🔧 Detected x86_64 runner"
    RUNNER_ARCH="x86_64"
    DEFAULT_ANDROID_ARCH="x86_64"
fi

# Configuration - ARM64 optimized
AVD_NAME=${AVD_NAME:-"CI_Android_ARM64"}
API_LEVEL=${API_LEVEL:-"30"}  # ARM64 images work well with API 30+
ARCH=${ARCH:-"$DEFAULT_ANDROID_ARCH"}
DEVICE_TYPE=${DEVICE_TYPE:-"pixel_4"}
TARGET=${TARGET:-"google_apis"}  # ARM64 works better with google_apis

echo "📱 Configuration:"
echo "  Runner Architecture: $RUNNER_ARCH"
echo "  AVD Name: $AVD_NAME"
echo "  API Level: $API_LEVEL"
echo "  Android Architecture: $ARCH"
echo "  Device Type: $DEVICE_TYPE"
echo "  Target: $TARGET"

# Accept Android SDK licenses
echo "📋 Accepting Android SDK licenses..."
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses || true

# Install required SDK components
echo "📦 Installing Android SDK components..."
SYSTEM_IMAGE="system-images;android-${API_LEVEL};${TARGET};${ARCH}"
echo "Installing system image: $SYSTEM_IMAGE"

$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \
  "$SYSTEM_IMAGE" \
  "platforms;android-${API_LEVEL}" \
  "build-tools;33.0.0" \
  "emulator" \
  "platform-tools"

# Verify system image is available
if ! $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --list | grep -q "$SYSTEM_IMAGE"; then
  echo "❌ System image $SYSTEM_IMAGE not available"
  echo "📋 Available ARM64 system images:"
  $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --list | grep "system-images" | grep "arm64-v8a" || echo "No ARM64 images found"
  
  if [[ "$ARCH" == "arm64-v8a" ]]; then
    echo "🔄 Falling back to x86_64 for compatibility..."
    ARCH="x86_64"
    SYSTEM_IMAGE="system-images;android-${API_LEVEL};${TARGET};${ARCH}"
    echo "Installing fallback system image: $SYSTEM_IMAGE"
    $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "$SYSTEM_IMAGE"
  else
    exit 1
  fi
fi

# Create AVD if it doesn't exist
if ! $ANDROID_HOME/emulator/emulator -list-avds | grep -q "$AVD_NAME"; then
  echo "🏗️  Creating AVD: $AVD_NAME"
  echo "no" | $ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
    --force \
    --name "$AVD_NAME" \
    --package "$SYSTEM_IMAGE" \
    --device "$DEVICE_TYPE"
  
  # Configure AVD for optimal performance
  AVD_CONFIG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"
  if [ -f "$AVD_CONFIG" ]; then
    echo "⚙️  Configuring AVD for optimal performance..."
    
    # ARM64 specific optimizations
    if [[ "$ARCH" == "arm64-v8a" ]]; then
      echo "hw.gpu.enabled=yes" >> "$AVD_CONFIG"
      echo "hw.gpu.mode=swiftshader_indirect" >> "$AVD_CONFIG"
      echo "hw.ramSize=3072" >> "$AVD_CONFIG"  # More RAM for ARM64
      echo "vm.heapSize=512" >> "$AVD_CONFIG"  # Larger heap for ARM64
      echo "hw.keyboard=yes" >> "$AVD_CONFIG"
      echo "hw.cpu.ncore=2" >> "$AVD_CONFIG"
      echo "hw.cpu.arch=arm64" >> "$AVD_CONFIG"
    else
      # x86_64 optimizations
      echo "hw.gpu.enabled=yes" >> "$AVD_CONFIG"
      echo "hw.gpu.mode=swiftshader_indirect" >> "$AVD_CONFIG"
      echo "hw.ramSize=2048" >> "$AVD_CONFIG"
      echo "vm.heapSize=256" >> "$AVD_CONFIG"
      echo "hw.keyboard=yes" >> "$AVD_CONFIG"
    fi
  fi
else
  echo "✅ AVD '$AVD_NAME' already exists"
fi

echo "🚀 Starting emulator in headless mode..."

# ARM64 specific emulator options
if [[ "$ARCH" == "arm64-v8a" ]]; then
  EMULATOR_OPTIONS="-no-window -no-audio -no-snapshot -camera-back none -camera-front none -gpu swiftshader_indirect -memory 3072 -partition-size 4096 -no-boot-anim"
else
  EMULATOR_OPTIONS="-no-window -no-audio -no-snapshot -camera-back none -camera-front none -gpu swiftshader_indirect -memory 2048 -partition-size 4096"
fi

nohup $ANDROID_HOME/emulator/emulator \
  -avd "$AVD_NAME" \
  $EMULATOR_OPTIONS \
  > emulator.log 2>&1 &

echo "⏳ Waiting for emulator to boot..."
timeout=600  # ARM64 might need more time to boot
counter=0
while [ $counter -lt $timeout ]; do
  if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
    echo "✅ Emulator is ready!"
    break
  fi
  echo "  Waiting... ($counter/$timeout seconds)"
  sleep 10  # Longer intervals for ARM64
  counter=$((counter + 10))
done

if [ $counter -eq $timeout ]; then
  echo "❌ Emulator failed to start within $timeout seconds"
  echo "📋 Emulator log:"
  tail -50 emulator.log
  exit 1
fi

# Wait for system to stabilize
echo "🔄 Waiting for system to stabilize..."
sleep 15  # Longer stabilization time for ARM64

# Verify emulator is accessible
echo "🔍 Verifying emulator status..."
adb devices -l
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.cpu.abi

echo "✅ Android CI environment is ready!"
echo "   AVD: $AVD_NAME"
echo "   Device: $(adb devices | grep emulator | cut -f1)"
echo "   API Level: $(adb shell getprop ro.build.version.sdk)"
echo "   CPU Architecture: $(adb shell getprop ro.product.cpu.abi)"
echo "   Runner Architecture: $RUNNER_ARCH"

# Export configuration for test scripts
echo "export AVD_NAME=$AVD_NAME" > .env.ci
echo "export ANDROID_ARCH=$ARCH" >> .env.ci
echo "export RUNNER_ARCH=$RUNNER_ARCH" >> .env.ci 