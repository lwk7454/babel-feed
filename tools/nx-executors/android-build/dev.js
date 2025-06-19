const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

module.exports = async function androidDevExecutor(options, context) {
  const projectRoot = 'apps/babel-android';
  console.log(`🚀 Starting Android development mode with hot reload...`);

  const gradlePath = path.join(context.root, projectRoot, 'gradlew');
  const projectPath = path.join(context.root, projectRoot);

  try {
    // Step 1: Check if device/emulator is connected
    console.log('📱 Checking for connected devices...');
    const { stdout: devices } = await execAsync('adb devices');
    
    if (!devices.includes('device') && !devices.includes('emulator')) {
      console.log('⚠️  No devices found. Please start an emulator or connect a device.');
      console.log('💡 To start an emulator: emulator -list-avds && emulator -avd <AVD_NAME>');
      return { success: false };
    }
    console.log('✅ Device/emulator detected');

    // Step 2: Initial build and install
    console.log('🔨 Building and installing debug APK...');
    await execAsync(`"${gradlePath}" installDebug`, {
      cwd: projectPath,
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || '/Users/pooh/Library/Android/sdk'
      }
    });
    console.log('✅ APK installed successfully');

    // Step 3: Launch the app
    console.log('🚀 Launching app...');
    await execAsync('adb shell am start -n com.babelfeed.app/.MainActivity');
    console.log('✅ App launched');

    // Step 4: Start continuous build for hot reload
    console.log('🔥 Starting hot reload mode (Gradle continuous build)...');
    console.log('👀 Watching for file changes... Press Ctrl+C to stop');
    console.log('💡 Edit Kotlin files and see changes automatically rebuild and install!');
    
    const continuousBuild = spawn(gradlePath, ['installDebug', '--continuous'], {
      cwd: projectPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || '/Users/pooh/Library/Android/sdk'
      }
    });

    // Handle graceful shutdown
    const cleanup = () => {
      console.log('\n🛑 Stopping development mode...');
      continuousBuild.kill('SIGTERM');
      setTimeout(() => {
        continuousBuild.kill('SIGKILL');
      }, 5000);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Return promise that resolves when continuous build stops
    return new Promise((resolve) => {
      continuousBuild.on('close', (code) => {
        console.log(`\n✅ Development mode stopped (exit code: ${code})`);
        resolve({ success: true });
      });

      continuousBuild.on('error', (error) => {
        console.error(`❌ Hot reload failed: ${error.message}`);
        resolve({ success: false });
      });
    });

  } catch (error) {
    console.error(`❌ Android development mode failed: ${error.message}`);
    
    if (error.message.includes('adb')) {
      console.log('💡 Make sure ADB is in your PATH and a device/emulator is connected');
    }
    
    return { success: false };
  }
}