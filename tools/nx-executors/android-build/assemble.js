const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

module.exports = async function androidAssembleExecutor(options, context) {
  // Use hardcoded project root for now since workspace context isn't loading properly
  const projectRoot = 'apps/babel-android';
  console.log(`Assembling Android app from ${projectRoot}...`);

  const gradlePath = path.join(context.root, projectRoot, 'gradlew');
  const assembleTask = options.buildType === 'release' ? 'assembleRelease' : 'assembleDebug';
  
  const gradleCommand = [
    `"${gradlePath}"`,
    assembleTask,
    ...options.gradleOptions
  ].join(' ');

  try {
    console.log(`Assembling Android APK (${options.buildType})...`);
    console.log(`Executing: ${gradleCommand}`);
    
    const { stdout, stderr } = await execAsync(gradleCommand, {
      cwd: path.join(context.root, projectRoot),
      env: {
        ...process.env,
        ANDROID_HOME: process.env.ANDROID_HOME || '/Users/pooh/Library/Android/sdk'
      }
    });

    if (stdout) console.log(stdout);
    if (stderr) console.warn(stderr);

    console.log('Android APK assembly completed successfully');
    return { success: true };
  } catch (error) {
    console.error(`Android APK assembly failed: ${error}`);
    return { success: false };
  }
}