# EasyConverter

Client-side file conversion PWA. All conversions run entirely in the browser — no server, no uploads, fully offline-capable.

## Features

- **16 formats** supported: TXT, MD, HTML, RTF, CSV, JSON, XLSX, ODS, YAML, XML, Base64, PDF, PNG, JPEG, WEBP, EPUB
- **89+ conversion combinations** with reliability classification and preflight warnings
- **100% client-side** — your files never leave the browser
- **Offline-first** — installable PWA with Service Worker caching
- **Bilingual** — English and Italian with runtime language switching
- **Mobile-first** responsive design with Ionic components
- **Pre-conversion preview** for text and image files
- **Quality feedback** — reliability indicators and post-conversion summary

## Supported Conversions

| Source | Targets                                          |
| ------ | ------------------------------------------------ |
| TXT    | MD, HTML, PDF, CSV, Base64                       |
| MD     | TXT, HTML, RTF, PDF, EPUB, Base64                |
| HTML   | TXT, MD, PDF, CSV, XLSX, RTF, Base64, EPUB       |
| RTF    | TXT, HTML, MD, PDF, Base64                       |
| CSV    | JSON, XLSX, TXT, MD, HTML, PDF, Base64, ODS, XML |
| JSON   | CSV, XLSX, HTML, TXT, YAML, XML, Base64          |
| XLSX   | CSV, JSON, TXT, MD, HTML, PDF, Base64, ODS, XML  |
| YAML   | JSON, XML, TXT, Base64                           |
| XML    | JSON, YAML, TXT, CSV, XLSX, HTML, Base64         |
| Base64 | TXT                                              |
| PDF    | TXT, MD, HTML, PNG, JPEG, WEBP                   |
| PNG    | JPEG, WEBP, PDF, Base64                          |
| JPEG   | PNG, WEBP, PDF, Base64                           |
| WEBP   | PNG, JPEG, PDF, Base64                           |
| EPUB   | TXT, HTML, MD, PDF, RTF, Base64                  |

Conversions are classified by reliability: `lossless`, `structured`, `text-only`, `best-effort`, `table-only`, `requires-uniform-data`. Preflight checks warn users about potential data loss before converting.

## Tech Stack

| Layer         | Technology                               |
| ------------- | ---------------------------------------- |
| Framework     | Angular 21 (NgModule)                    |
| UI            | Ionic 8                                  |
| Native bridge | Capacitor 8                              |
| Language      | TypeScript 5.9 (strict)                  |
| PWA           | Angular Service Worker                   |
| i18n          | @ngx-translate/core                      |
| Testing       | Karma + Jasmine (unit), Playwright (E2E) |
| Linting       | ESLint 9 + Prettier                      |
| Deployment    | Cloudflare Pages                         |

### Key Libraries

| Library         | Purpose                              |
| --------------- | ------------------------------------ |
| xlsx (SheetJS)  | XLSX/ODS read/write via Web Worker   |
| papaparse       | CSV parsing with delimiter detection |
| marked          | Markdown to HTML                     |
| turndown        | HTML to Markdown                     |
| pdfjs-dist      | PDF text extraction                  |
| pdf-lib         | PDF creation                         |
| jszip           | EPUB/ZIP handling                    |
| yaml            | YAML parsing/serialization           |
| fast-xml-parser | XML parsing/serialization            |
| dompurify       | HTML sanitization (XSS prevention)   |
| juice           | CSS inlining for HTML export         |
| piexifjs        | EXIF metadata handling               |

All heavy libraries are lazy-loaded on first use to keep the initial bundle small (~185 KB transfer).

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Install

```bash
git clone https://github.com/Spe1977/EasyConverterPWA.git
cd EasyConverterPWA
npm install
```

### Development

```bash
npm start          # Dev server on http://localhost:4200
```

### Build

```bash
npm run build      # Production build → www/
```

### Test

```bash
npm test           # Unit tests (193 specs, Karma + Jasmine)
npm run lint       # ESLint
npm run format:check  # Prettier check
```

### E2E Tests

```bash
npm run build                # Build first
npm run e2e:offline          # Playwright tests (Chromium, Firefox, WebKit)
npm run e2e:offline:ui       # Playwright with UI
```

E2E suite: 12 real conversion tests + 10 offline conversion tests across Chromium, Firefox, and WebKit.

## Project Structure

```
src/
  app/
    core/
      models/           # ConversionFormat, ConversionResult
      services/         # ConverterService (orchestrator), format-specific services
    shared/
      components/       # FilePicker, FormatSelector, ProgressIndicator,
                        # LanguageSwitcher, UpdateNotification
    home/               # HomePage (main UI, lazy-loaded)
    app.module.ts       # Root module with i18n and SW config
  assets/
    i18n/               # en.json, it.json translation files
    _headers            # Cloudflare Pages security headers
    _redirects          # SPA routing for Cloudflare Pages
  environments/         # Dev/prod config with file size limits and timeouts
  theme/                # Ionic theme variables
playwright/             # E2E test specs
```

## Architecture

- **Single-page app** with one lazy-loaded feature module (`HomePage`)
- **Shared components** are standalone, imported directly into the feature module
- **State management** via Angular signals (`signal()`) — no external state library
- **Conversion pipeline** — `ConverterService` orchestrates all conversions, delegating to format-specific services. Multi-step pipelines (e.g. RTF -> HTML -> PDF) are composed internally
- **Web Worker** for XLSX processing (off main thread) with synchronous fallback
- **Preflight validation** checks file content, warns about lossy conversions, blocks impossible ones
- **Security** — DOMPurify sanitization on HTML flows, formula injection mitigation in CSV/XLSX exports, CSP headers, 0 npm audit vulnerabilities

## File Size Limits

| Category               | Limit |
| ---------------------- | ----- |
| PDF                    | 25 MB |
| Images                 | 15 MB |
| Spreadsheets           | 15 MB |
| Text & structured data | 20 MB |
| EPUB                   | 20 MB |
| Base64                 | 10 MB |

## Deployment

Configured for **Cloudflare Pages** with:

- Build command: `npm run build`
- Output directory: `www`
- Security headers (CSP, X-Frame-Options, HSTS-ready) via `_headers`
- SPA routing via `_redirects`
- Immutable caching for hashed assets, no-cache for Service Worker and index.html

## License

MIT
