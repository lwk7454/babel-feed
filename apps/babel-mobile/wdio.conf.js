import path from 'path';
import os from 'os';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// keep track of the `tauri-driver` child process
let tauriDriver;

const capabilities = [{
    maxInstances: 1,
    'tauri:options': {
        application: path.resolve(__dirname, './src-tauri/target/release/babel-mobile')
    }
}];

if (process.env.CI) {
    capabilities[0].args = ['--headless', '--disable-gpu'];
}

export const config = {
    runner: 'local',
    specs: [
        './e2e/specs/**/*.spec.js'
    ],
    exclude: [
        './e2e/specs/mobile/**/*.spec.js'
    ],
    maxInstances: 1,
    capabilities: capabilities,
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },

    // ensure the rust project is built since we expect this binary to exist for the webdriver sessions
    onPrepare: () => {
        console.log('Building Tauri application...');
        spawnSync('tauri', ['build'], { 
            cwd: path.resolve(__dirname), 
            stdio: 'inherit' 
        });
    },

    // ensure we are running `tauri-driver` before the session starts so that we can proxy the webdriver requests
    beforeSession: () => {
        console.log('Starting tauri-driver...');
        tauriDriver = spawn(
            path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
            [],
            { stdio: [null, process.stdout, process.stderr] }
        );
    },

    // clean up the `tauri-driver` process we spawned at the start of the session
    afterSession: () => {
        if (tauriDriver) {
            console.log('Stopping tauri-driver...');
            tauriDriver.kill();
        }
    }
};
