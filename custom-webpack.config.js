/**
 * Custom Webpack Configuration
 * Adds polyfill fallbacks for Node.js modules that opencv.js tries to use but aren't available in the browser
 */
module.exports = {
  resolve: {
    fallback: {
      fs: false,
      path: false,
      crypto: false,
    },
  },
};
