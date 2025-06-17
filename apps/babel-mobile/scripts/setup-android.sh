#!/bin/bash
set -e

# 🤖 Simple Android Emulator Setup for M4 Mac
# ============================================
# Sets up ARM64 Android emulator for local development

HEADED_MODE=${HEADED_MODE:-false}
AVD_NAME="BabelFeed_ARM64"
API_LEVEL="33"
ARCH="arm64-v8a"
DEVICE_TYPE="28"  # Custom device will be created
TARGET="default"  # Android Open Source

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}🔧 $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

if [ "$HEADED_MODE" = "true" ]; then
    log_info "Setting up Android emulator (headed mode for E2E tests)"
else
    log_info "Setting up Android emulator (headless mode for CI)"
fi

log_info "Configuration: API $API_LEVEL, $ARCH, $DEVICE_TYPE"

# Check if ANDROID_HOME is set
if [ -z "$ANDROID_HOME" ]; then
    log_error "ANDROID_HOME is not set. Please install Android SDK first."
    exit 1
fi

# Accept licenses
log_info "Accepting Android SDK licenses..."
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses 2>/dev/null || true

# Install required components
log_info "Installing required Android SDK components..."
SYSTEM_IMAGE="system-images;android-${API_LEVEL};${TARGET};${ARCH}"

$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \
  "$SYSTEM_IMAGE" \
  "platforms;android-${API_LEVEL}" \
  "build-tools;33.0.0" \
  "emulator" \
  "platform-tools" \
  > /dev/null 2>&1

# Check if emulator is already running with correct mode
if pgrep -f "emulator.*$AVD_NAME" > /dev/null; then
    if [ "$HEADED_MODE" = "true" ] && pgrep -f "emulator.*$AVD_NAME.*-no-window" > /dev/null; then
        log_info "Stopping headless emulator (need headed mode)..."
        adb emu kill
        sleep 3
    elif [ "$HEADED_MODE" = "false" ] && ! pgrep -f "emulator.*$AVD_NAME.*-no-window" > /dev/null; then
        log_info "Stopping headed emulator (need headless mode)..."
        adb emu kill
        sleep 3
    else
        log_success "Emulator already running in correct mode"
        
        # Wait for emulator to be ready
        log_info "Waiting for emulator to be ready..."
        timeout=60
        counter=0
        while [ $counter -lt $timeout ]; do
          if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
            log_success "Emulator is ready!"
            break
          fi
          sleep 5
          counter=$((counter + 5))
        done
        
        log_info "Device: $(adb devices | grep emulator | cut -f1)"
        log_info "API Level: $(adb shell getprop ro.build.version.sdk)"
        log_success "Android emulator setup complete!"
        exit 0
    fi
fi

# Create custom device profile
log_info "Creating custom device profile for OEM 6.4\" device..."
DEVICE_PROFILE="$HOME/.android/devices.xml"
mkdir -p "$(dirname "$DEVICE_PROFILE")"

cat > "$DEVICE_PROFILE" << 'EOF'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<d:devices xmlns:d="http://schemas.android.com/sdk/devices/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <d:device>
    <d:name>OEM 6.4 Custom</d:name>
    <d:id>28</d:id>  
    <d:manufacturer>OEM</d:manufacturer>
    <d:meta/>
    <d:hardware>
      <d:screen>
        <d:screen-size>normal</d:screen-size>
        <d:diagonal-length>6.4</d:diagonal-length>
        <d:pixel-density>xxhdpi</d:pixel-density>
        <d:screen-ratio>long</d:screen-ratio>
        <d:dimensions>
          <d:x-dimension>1080</d:x-dimension>
          <d:y-dimension>2400</d:y-dimension>
        </d:dimensions>
        <d:xdpi>420</d:xdpi>
        <d:ydpi>420</d:ydpi>
        <d:touch>
          <d:multitouch>jazz-hands</d:multitouch>
          <d:mechanism>finger</d:mechanism>
          <d:screen-type>capacitive</d:screen-type>
        </d:touch>
      </d:screen>
      <d:networking>Bluetooth
Wifi</d:networking>
      <d:sensors>Accelerometer
Barometer
Compass
GPS
Gyroscope
LightSensor
ProximitySensor</d:sensors>
      <d:mic>true</d:mic>
      <d:camera>
        <d:location>back</d:location>
        <d:autofocus>true</d:autofocus>
        <d:flash>true</d:flash>
      </d:camera>
      <d:camera>
        <d:location>front</d:location>
        <d:autofocus>true</d:autofocus>
        <d:flash>false</d:flash>
      </d:camera>
      <d:keyboard>nokeys</d:keyboard>
      <d:nav>nonav</d:nav>
      <d:ram unit="GiB">6</d:ram>
      <d:buttons>soft</d:buttons>
      <d:internal-storage unit="GiB">6</d:internal-storage>
      <d:removable-storage unit="GiB">1</d:removable-storage>
      <d:cpu>Generic CPU</d:cpu>
      <d:gpu>Generic GPU</d:gpu>
      <d:abi>armeabi-v7a</d:abi>
      <d:dock/>
      <d:power-type>battery</d:power-type>
    </d:hardware>
    <d:software>
      <d:api-level>33</d:api-level>
      <d:live-wallpaper-support>true</d:live-wallpaper-support>
      <d:bluetooth-profiles/>
      <d:gl-version>3.0</d:gl-version>
      <d:gl-extensions/>
      <d:status-bar>true</d:status-bar>
    </d:software>
    <d:state default="true" name="Portrait">
      <d:description>The device in portrait orientation</d:description>
      <d:screen-orientation>port</d:screen-orientation>
      <d:keyboard-state>keyssoft</d:keyboard-state>
      <d:nav-state>navhidden</d:nav-state>
    </d:state>
  </d:device>
</d:devices>
EOF

# Create AVD if it doesn't exist
if ! $ANDROID_HOME/emulator/emulator -list-avds | grep -q "$AVD_NAME"; then
    log_info "Creating AVD: $AVD_NAME"
    echo "no" | $ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd \
        --force \
        --name "$AVD_NAME" \
        --package "$SYSTEM_IMAGE" \
        --device "$DEVICE_TYPE"
    
    # Configure AVD with specified performance settings
    AVD_CONFIG="$HOME/.android/avd/${AVD_NAME}.avd/config.ini"
    if [ -f "$AVD_CONFIG" ]; then
        log_info "Configuring AVD with custom performance settings..."
        
        # Graphics and GPU
        echo "hw.gpu.enabled=yes" >> "$AVD_CONFIG"
        echo "hw.gpu.mode=host" >> "$AVD_CONFIG"  # Hardware acceleration
        
        # Memory settings (6GB RAM, 1GB VM Heap)
        echo "hw.ramSize=6144" >> "$AVD_CONFIG"  # 6GB RAM
        echo "vm.heapSize=1024" >> "$AVD_CONFIG"  # 1GB VM Heap
        
        # CPU settings (4 cores)
        echo "hw.cpu.ncore=4" >> "$AVD_CONFIG"
        echo "hw.cpu.arch=arm64" >> "$AVD_CONFIG"
        
        # Storage settings
        echo "disk.dataPartition.size=6GB" >> "$AVD_CONFIG"  # Internal storage
        echo "hw.sdCard=yes" >> "$AVD_CONFIG"
        echo "sdcard.size=1GB" >> "$AVD_CONFIG"  # Expanded storage
        
        # Network settings
        echo "hw.network=yes" >> "$AVD_CONFIG"
        echo "hw.wifi=yes" >> "$AVD_CONFIG"
        
        # Display and input
        echo "hw.keyboard=yes" >> "$AVD_CONFIG"
        echo "hw.dPad=no" >> "$AVD_CONFIG"
        echo "hw.trackBall=no" >> "$AVD_CONFIG"
        
        # Boot settings
        echo "fastboot.chosenSnapshotFile=" >> "$AVD_CONFIG"
        echo "fastboot.forceChosenSnapshotBoot=no" >> "$AVD_CONFIG"
        echo "fastboot.forceColdBoot=no" >> "$AVD_CONFIG"  # Enable quick boot
        
        # Orientation
        echo "hw.initialOrientation=Portrait" >> "$AVD_CONFIG"
        
        # Performance optimizations
        echo "hw.arc=false" >> "$AVD_CONFIG"
        echo "hw.device.manufacturer=OEM" >> "$AVD_CONFIG"
        echo "hw.device.name=OEM 6.4 Custom" >> "$AVD_CONFIG"
    fi
else
    log_success "AVD '$AVD_NAME' already exists"
fi

# Start emulator
log_info "Starting emulator..."

if [ "$HEADED_MODE" = "true" ]; then
    EMULATOR_OPTIONS="-gpu host -memory 6144 -cores 4 -partition-size 6144 -netspeed full -netdelay none"
else
    EMULATOR_OPTIONS="-no-window -no-audio -no-snapshot -camera-back none -camera-front none -gpu host -memory 6144 -cores 4 -partition-size 6144 -netspeed full -netdelay none -no-boot-anim"
fi

nohup $ANDROID_HOME/emulator/emulator \
    -avd "$AVD_NAME" \
    $EMULATOR_OPTIONS \
    > emulator.log 2>&1 &

# Wait for emulator to boot
log_info "Waiting for emulator to boot..."
timeout=300
counter=0
while [ $counter -lt $timeout ]; do
    if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
        log_success "Emulator is ready!"
        break
    fi
    sleep 10
    counter=$((counter + 10))
done

if [ $counter -eq $timeout ]; then
    log_error "Emulator failed to start within $timeout seconds"
    echo "📋 Emulator log:"
    tail -20 emulator.log
    exit 1
fi

# Wait for system to stabilize
log_info "Waiting for system to stabilize..."
sleep 10

# Verify emulator
log_info "Device: $(adb devices | grep emulator | cut -f1)"
log_info "API Level: $(adb shell getprop ro.build.version.sdk)"
log_info "CPU Architecture: $(adb shell getprop ro.product.cpu.abi)"

log_success "Android emulator setup complete!" 