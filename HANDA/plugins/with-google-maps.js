const { withAppDelegate, withPodfile } = require('@expo/config-plugins');

module.exports = function withGoogleMapsIOS(config) {
  config = withPodfile(config, (podfileConfig) => {
    const podfile = podfileConfig.modResults.contents;
    const googleMapsPod = "  pod 'react-native-maps/Google', :path => '../node_modules/react-native-maps'\n";
    if (!podfile.includes("pod 'react-native-maps/Google'")) {
      const insertionPoint = podfile.indexOf('use_native_modules!');
      if (insertionPoint === -1) {
        throw new Error('Could not configure Google Maps: use_native_modules! was not found in the iOS Podfile.');
      }
      podfileConfig.modResults.contents = `${podfile.slice(0, insertionPoint)}${googleMapsPod}${podfile.slice(insertionPoint)}`;
    }
    return podfileConfig;
  });

  return withAppDelegate(config, (delegateConfig) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY;
    if (!apiKey) return delegateConfig;

    let source = delegateConfig.modResults.contents;
    if (delegateConfig.modResults.language === 'swift') {
      if (!source.includes('import GoogleMaps')) source = source.replace(/^import Expo$/m, 'import Expo\nimport GoogleMaps');
      if (!source.includes('GMSServices.provideAPIKey')) {
        source = source.replace(
          /(func application\([\s\S]*?\) -> Bool \{\s*)/,
          `$1    GMSServices.provideAPIKey(${JSON.stringify(apiKey)})\n`,
        );
      }
    } else {
      if (!source.includes('#import <GoogleMaps/GoogleMaps.h>')) {
        source = source.replace(/(#import ["<].*AppDelegate.*[">]\s*)/, '$1\n#import <GoogleMaps/GoogleMaps.h>\n');
      }
      if (!source.includes('provideAPIKey')) {
        source = source.replace(
          /(didFinishLaunchingWithOptions:[\s\S]*?\{\s*)/,
          `$1  [GMSServices provideAPIKey:${JSON.stringify(apiKey)}];\n`,
        );
      }
    }
    delegateConfig.modResults.contents = source;
    return delegateConfig;
  });
};
