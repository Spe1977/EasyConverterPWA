export const environment = {
  production: true,
  version: '1.0.0',
  appName: 'EasyConverter',
  // Configurazioni conversione
  conversion: {
    maxFileSize: 25 * 1024 * 1024, // Fallback globale: 25MB
    maxFileSizes: {
      document: 20 * 1024 * 1024,
      spreadsheet: 15 * 1024 * 1024,
      data: 20 * 1024 * 1024,
      encoding: 10 * 1024 * 1024,
      pdf: 25 * 1024 * 1024,
      image: 15 * 1024 * 1024,
      ebook: 20 * 1024 * 1024,
    },
    defaultQuality: 85,
    defaultDPI: 150,
    timeoutMs: 120_000,
    timeoutMsByCategory: {
      pdf: 180_000,
      image: 120_000,
      spreadsheet: 120_000,
      document: 60_000,
      data: 60_000,
      encoding: 30_000,
      ebook: 120_000,
    },
  },
};
