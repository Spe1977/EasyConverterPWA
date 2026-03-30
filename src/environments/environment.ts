// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

type FormatCategory = 'document' | 'spreadsheet' | 'data' | 'encoding' | 'pdf' | 'image' | 'ebook';

export interface Environment {
  production: boolean;
  version: string;
  appName: string;
  conversion: {
    maxFileSize: number;
    maxFileSizes: { [K in FormatCategory]: number };
    defaultQuality: number;
    defaultDPI: number;
    timeoutMs: number;
    timeoutMsByCategory: { [K in FormatCategory]: number };
  };
}

export const environment: Environment = {
  production: false,
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
    timeoutMs: 120_000, // Fallback globale: 2 minuti
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

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
