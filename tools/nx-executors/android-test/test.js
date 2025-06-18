const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

module.exports = async function androidTestExecutor(options, context) {
  // Use hardcoded project root for now since workspace context isn't loading properly
  const projectRoot = 'apps/babel-android';
  console.log(`Running Android tests in ${projectRoot}...`);

  const gradlePath = path.join(context.root, projectRoot, 'gradlew');
  
  let testTasks = [];
  switch (options.testType) {
    case 'unit':
      testTasks = ['testDebugUnitTest'];
      break;
    case 'instrumented':
      testTasks = ['connectedDebugAndroidTest'];
      break;
    case 'all':
      testTasks = ['testDebugUnitTest', 'connectedDebugAndroidTest'];
      break;
  }
  
  const gradleCommand = [
    `"${gradlePath}"`,
    ...testTasks,
    ...options.gradleOptions
  ].join(' ');

  try {
    console.log(`Running Android ${options.testType} tests...`);
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

    console.log('Android tests completed successfully');
    return { success: true };
  } catch (error) {
    console.error(`Android tests failed: ${error}`);
    return { success: false };
  }
}