const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withStripeFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const root = config.modRequest.projectRoot;
      const headerPath = path.join(
        root,
        'node_modules',
        '@stripe',
        'stripe-react-native',
        'ios',
        'StripeSwiftInterop.h'
      );

      if (!fs.existsSync(headerPath)) {
        console.warn('⚠️  StripeSwiftInterop.h not found at', headerPath);
        return config;
      }

      const text = fs.readFileSync(headerPath, 'utf8');
      const patched = text.replace(
        'typedef NS_ENUM(NSUInteger, STPPaymentStatus);',
        'typedef NS_ENUM(NSInteger, STPPaymentStatus);'
      );

      if (patched !== text) {
        fs.writeFileSync(headerPath, patched);
        console.log('✅ Patched StripeSwiftInterop.h for Xcode 26');
      } else {
        console.log('ℹ️  StripeSwiftInterop.h already patched');
      }

      return config;
    },
  ]);
};