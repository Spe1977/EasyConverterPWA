export const environment = {
  production: true,
  version: '1.0.0',
  appName: 'EasyConverter',
  // Configurazioni OCR
  ocr: {
    defaultLanguage: 'ita',
    supportedLanguages: ['ita', 'eng', 'fra', 'deu', 'spa'],
    workerPath: '/assets/workers/tesseract-worker.js',
  },
  // Configurazioni conversione
  conversion: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    defaultQuality: 85,
    defaultDPI: 150,
  },
  // Configurazioni scanner
  scanner: {
    defaultQuality: 100, // Qualità massima per scansioni
    workerTimeout: 30000, // 30 secondi timeout per worker initialization
    maxImageSize: 50 * 1024 * 1024, // 50MB max image size
    workerRetry: {
      maxAttempts: 3, // Max number of retry attempts
      initialDelay: 1000, // Initial delay in ms before first retry
      maxDelay: 10000, // Max delay in ms between retries
      backoffMultiplier: 2, // Exponential backoff multiplier
    },
  },
};
