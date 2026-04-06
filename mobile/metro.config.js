const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable experimental package exports resolution — React Native's package.json
// has "exports" entries pointing to non-existent files. This silences the warnings.
config.resolver.unstable_enablePackageExports = false;

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native/Libraries/Utilities/HMRClient') {
    return {
      filePath: path.resolve(__dirname, 'shims/HMRClient.js'),
      type: 'sourceFile',
    };
  }

  if (typeof originalResolveRequest === 'function') {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
