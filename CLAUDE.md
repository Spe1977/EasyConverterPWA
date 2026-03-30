# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyConverter is a client-side file conversion PWA built with Angular 21, Ionic 8, and Capacitor 8. All conversions run in the browser (no server). Supports documents, spreadsheets, structured data, images, PDFs, and e-books across ~20 formats (TXT, MD, HTML, RTF, CSV, JSON, XLSX, ODS, YAML, XML, Base64, PDF, PNG, JPEG, WEBP, EPUB).

## Commands

- **Dev server:** `npm start` (port 4200)
- **Build:** `npm run build` (output: `www/`)
- **Unit tests:** `npm test` (Karma + Jasmine, Chrome)
- **Single test file:** `npx ng test --include='**/converter.service.spec.ts'`
- **Lint:** `npm run lint` (ESLint 9 flat config via `eslint.config.mjs`)
- **Format:** `npm run format` (Prettier)
- **Format check:** `npm run format:check`
- **E2E (Playwright):** `npm run e2e:offline` (requires built app in `www/`, serves on port 8080)
- **E2E with UI:** `npm run e2e:offline:ui`
- **Bundle analysis:** `npm run analyze`

## Architecture

### Module Structure (NgModule-based, not fully standalone)

- `AppModule` — root module, bootstraps `AppComponent`, configures i18n (ngx-translate), service worker, PWA update checking via `APP_INITIALIZER`
- `HomePageModule` — lazy-loaded via routing, the single feature module containing the main conversion UI (`HomePage`)
- Shared components are **standalone** and imported directly into `HomePageModule`

### Path Aliases (tsconfig.json)

- `@app/*` → `src/app/*`
- `@core/*` → `src/app/core/*`
- `@shared/*` → `src/app/shared/*`
- `@env/*` → `src/environments/*`

### Core Services (`src/app/core/services/`)

`ConverterService` is the central orchestrator. It delegates to format-specific services:

- `PdfService`, `ImageService`, `EpubService`, `CsvService`, `HtmlService`, `RtfService`, `YamlService`, `XmlService`, `Base64Service`
- `SpreadsheetWorkerService` — runs XLSX/ODS processing in a Web Worker (`spreadsheet.worker.ts`)
- `FileSystemService` — handles file download/save (Capacitor Filesystem on native, browser download on web)
- `LanguageService` — runtime i18n language switching
- `PwaUpdateService` — service worker update detection and prompting

Heavy libraries (XLSX, marked, turndown) are lazy-loaded in `ConverterService` to reduce initial bundle size.

### Conversion Model

- `ConversionFormat` enum and `SUPPORTED_FORMATS` metadata array define all formats (`src/app/core/models/conversion-format.ts`)
- `ConverterService.supportedConversions` maps source→target with reliability levels (`lossless`, `structured`, `text-only`, `best-effort`, `table-only`, `requires-uniform-data`)
- Preflight checks warn users about lossy conversions before starting

### Shared Components (all standalone)

- `FilePickerComponent` — drag-and-drop file selection with format detection
- `FormatSelectorComponent` — target format picker filtered by source format
- `ProgressIndicatorComponent` — conversion progress display
- `LanguageSwitcherComponent` — EN/IT language toggle
- `UpdateNotificationComponent` — PWA update prompt

### State Management

Uses Angular signals (`signal()`) in `HomePage` for all UI state — no NgRx or external state library.

### i18n

Uses `@ngx-translate/core` with JSON translation files in `src/assets/i18n/` (EN/IT). All strings use `TranslateService.instant()` or the `translate` pipe — no `$localize`.

### Build Configuration

- Uses `@angular-builders/custom-webpack` with `custom-webpack.config.js`
- Web Worker TypeScript config: `tsconfig.worker.json`
- Service worker: `ngsw-config.json`
- Output directory: `www/` (not the default `dist/`)
- PDF.js worker is copied to `assets/` as a build asset
- Cloudflare Pages deployment files: `_headers`, `_redirects` in `src/assets/`

### Testing

- **Unit tests:** Karma + Jasmine. Spec files co-located with source (`*.spec.ts`)
- **E2E tests:** Playwright in `playwright/` directory. Tests run against a production build served by `npx serve -s www -l 8080`
- Pre-commit hooks via Husky + lint-staged (runs ESLint fix + Prettier on staged files)

### TypeScript

Strict mode enabled with `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noFallthroughCasesInSwitch`. Target: ES2022, module resolution: bundler.

### File Size Limits

Per-category max file sizes configured in `src/environments/environment.ts` (document: 20MB, spreadsheet: 15MB, image: 15MB, PDF: 25MB, etc.).
