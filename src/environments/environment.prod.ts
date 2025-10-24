export const environment = {
  production: true,
  version: '1.0.0',
  appName: 'EasyConverter',
  // Configurazioni OCR
  ocr: {
    defaultLanguage: 'ita',
    supportedLanguages: ['ita', 'eng', 'fra', 'deu', 'spa'],
    workerPath: '/assets/workers/tesseract-worker.js'
  },
  // Configurazioni conversione
  conversion: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    defaultQuality: 85,
    defaultDPI: 150
  }
};
