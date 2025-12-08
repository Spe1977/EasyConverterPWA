// ESLint 9 Flat Config with backward compatibility for .eslintrc.json
// This allows gradual migration from ESLint 8 to ESLint 9

import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Use the existing .eslintrc.json configuration
export default [
  ...compat.extends('./.eslintrc.json'),
  {
    ignores: [
      'projects/**/*',
      'playwright/**/*',
      'playwright.config.ts',
      'test-results/**/*',
      'playwright-report/**/*',
      'cypress/**/*',
      'www/**/*',
      'node_modules/**/*',
    ],
  },
];
