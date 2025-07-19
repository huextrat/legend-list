// Global test setup for Legend List tests

// Define React Native globals that the source code expects
global.__DEV__ = false;
global.nativeFabricUIManager = {}; // Set to non-null for IsNewArchitecture = true

// Mock React Native constants if needed
if (typeof global.window === 'undefined') {
    global.window = {} as any;
}

// Export empty to make this a module
export {};