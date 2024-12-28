// File: src/utils/debug.ts
import debug from 'debug';

// Core namespaces
export const debugCore = debug('echo:core');      // Core application events
export const debugCmd = debug('echo:cmd');        // Command processing
export const debugVoice = debug('echo:voice');    // Voice connection events
export const debugPlayer = debug('echo:player');  // Audio player events

// Service namespaces
export const debugSpotify = debug('echo:spotify'); // Spotify integration
export const debugYoutube = debug('echo:youtube'); // YouTube integration
export const debugCache = debug('echo:cache');     // Caching operations
export const debugDB = debug('echo:db');          // Database operations

// Helper to enable all debug namespaces
export const enableAllDebug = () => debug.enable('echo:*');

// Helper to disable all debug namespaces
export const disableAllDebug = () => debug.disable();

// Export default namespace for backward compatibility
export default debugCore;