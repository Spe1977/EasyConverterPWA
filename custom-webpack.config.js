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
  devServer: {
    headers: {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    },
  },
};
