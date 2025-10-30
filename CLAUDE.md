# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyConverter is a mobile-first Progressive Web App built with Angular 20, Ionic 8, and Capacitor 7 for offline document conversion. All conversions run 100% client-side in the browser using TypeScript libraries.

**Core functionality**: Convert between 10+ formats (TXT, MD, HTML, CSV, JSON, XLSX, ODS, PDF, PNG/JPEG/WEBP, EPUB).

## Development Commands

### Essential Commands
- `npm start` - Start dev server (default port via Ionic)
- `npm run build` - Production build (outputs to `www/`)
- `npm run build -- --configuration production` - Production build with optimizations
- `npm run watch` - Build in watch mode for development
- `npm test` - Run unit tests with Karma
- `npm test -- --no-watch --browsers=ChromeHeadless` - Run tests once (CI mode)
- `npm run lint` - Lint TypeScript and HTML files with ESLint

### Code Quality
- `npm run format` - Format all source files with Prettier
- `npm run format:check` - Check formatting without modifying files
- `npm run analyze` - Analyze bundle size with webpack-bundle-analyzer

### E2E Testing
- `npm run e2e` - Open Cypress UI for interactive testing
- `npm run e2e:ci` - Run Cypress tests in headless mode (CI)

### Capacitor (Native Mobile)
- `npx cap sync` - Sync web assets to native projects
- `npx cap open ios` - Open iOS project in Xcode
- `npx cap open android` - Open Android project in Android Studio
- `npx cap run android` - Build and run on Android device/emulator
- `npx cap run ios` - Build and run on iOS device/simulator

## Architecture

### Module Structure
This is an **NgModule-based** Angular app (not standalone). The app uses:
- Traditional `@NgModule` declarations with `BrowserModule`, `IonicModule.forRoot()`
- Feature modules with routing (e.g., home module)
- Lazy-loaded routes via `AppRoutingModule`

### Path Aliases
The project uses TypeScript path aliases configured in `tsconfig.json`:
```typescript
@app/*       → src/app/*
@core/*      → src/app/core/*
@shared/*    → src/app/shared/*
@features/*  → src/app/features/*
@env/*       → src/environments/*
```

Always use these aliases for imports instead of relative paths.

### Directory Structure
```
src/app/
├── core/
│   ├── models/          # TypeScript interfaces and enums
│   │   ├── conversion-format.ts    # ConversionFormat enum + FormatInfo
│   │   └── conversion-result.ts    # Conversion result interfaces
│   └── services/        # Core Angular services
│       ├── converter.service.ts    # Main conversion orchestrator
│       ├── file-system.service.ts  # File I/O multiplatform
│       ├── image.service.ts        # Image processing and conversion
│       ├── pdf.service.ts          # PDF creation and extraction
│       └── pwa-update.service.ts   # PWA update notifications
├── features/
│   └── converter/       # Document conversion feature (home page)
└── shared/
    └── components/      # Reusable UI components
        ├── file-picker/         # Drag & drop file picker
        ├── format-selector/     # Format selection modal
        ├── progress-indicator/  # Conversion progress overlay
        └── update-notification/ # PWA update banner
```

## Key Libraries and Usage

### Document Conversion
- **xlsx** (0.18.5) - Excel/CSV/ODS read/write
- **papaparse** (5.5.3) - Advanced CSV parsing
- **marked** (16.4.1) - Markdown → HTML
- **turndown** (7.2.1) - HTML → Markdown
- **jszip** (3.10.1) - ZIP handling for EPUB

### PDF Processing
- **pdfjs-dist** (5.4.296) - PDF reading, rendering, text extraction (Mozilla)
- **pdf-lib** (1.17.1) - PDF creation/modification
- **jspdf** (3.0.3) - Alternative PDF generation

### Capacitor Plugins
- **@capacitor/filesystem** (7.1.4) - File system operations
- **@capacitor/share** (7.0.2) - Native share dialog
- **@capacitor/network** (7.0.2) - Network status detection

## Performance Considerations

### Bundle Size Strategy
- Core bundle: ~600KB (always loaded)
- PDF libraries: ~2MB (lazy loaded on demand)

**Always use dynamic imports for heavy libraries**:
```typescript
// Good - lazy load heavy PDF libraries
const pdfjs = await import('pdfjs-dist');

// Bad - loads in main bundle
import * as pdfjs from 'pdfjs-dist';
```

### Memory Management
- Large images should be resized before processing
- PDF multi-page rendering is memory intensive - process page by page
- Clear canvas contexts after use to free memory

## Configuration Files

### angular.json
- Output directory: `www/` (required by Capacitor)
- Bundle budgets: Initial 5MB max, component styles 4KB max
- Environment file replacement configured for production

### capacitor.config.ts
- `appId`: `io.ionic.starter` (should be changed for production)
- `webDir`: `www` (matches Angular build output)

### tsconfig.json
- Target: ES2022 with DOM libs
- `moduleResolution: "bundler"` (Angular 20 default)
- Strict mode enabled
- Path aliases configured
- `skipLibCheck: true` - Required for pdfjs-dist type compatibility
- Separate configs: `tsconfig.app.json`, `tsconfig.spec.json`, `cypress/tsconfig.json`

## Environment Configuration

Configuration lives in `src/environments/`:
- `environment.ts` - Development config
- `environment.prod.ts` - Production config (file replacement in angular.json)

Available settings:
- `conversion.maxFileSize` - Max file size (50MB)
- `conversion.defaultQuality` - Image quality (85)
- `conversion.defaultDPI` - PDF rendering DPI (150)

## Format Support Matrix

Conversion capabilities are defined in `src/app/core/models/conversion-format.ts`. Key points:

- **Full support**: TXT, MD, HTML, CSV, JSON, XLSX, PDF, PNG/JPEG/WEBP conversions
- **Limited support**: ODS (read works, write requires SheetJS Pro)
- **PDF to text**: Extraction only, no formatting preservation
- **No support**: DOCX, DOC, ODT, RTF (require backend or commercial libraries)

## Progressive Web App Strategy

### Offline-First Design
All conversions run client-side with no backend required. Service Worker caches:
1. Core app shell and assets (indefinite cache)
2. PDF libraries: pdfjs-dist (~2MB, 14 days cache)

Configuration: `ngsw-config.json`

### PWA Features
- **PwaUpdateService** (`src/app/core/services/pwa-update.service.ts`) - Automatic update checks every 6 hours
- **UpdateNotificationComponent** - User notification for new app versions
- **Service Worker** - Only active in production builds (`registerWhenStable:30000`)
- **Manifest** - `public/manifest.webmanifest` for installability

### Testing PWA Locally
```bash
npm run build -- --configuration production
npx http-server www -p 8080
# Open http://localhost:8080 and test offline mode
```

### Capacitor Platform Detection
```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Native mobile - use Capacitor plugins
} else {
  // Web - use browser APIs as fallback
}
```

## Code Style Notes

- Use Angular 20 features: signals, inject(), standalone components where applicable (though current codebase is NgModule-based)
- Ionic components for UI consistency
- TypeScript strict mode is enabled - all code must be type-safe
- Use path aliases (`@core/*`, `@shared/*`) consistently

### Memory Leak Prevention (Critical)
**Always implement proper cleanup to prevent memory leaks:**

1. **Observable Subscriptions** - Must be unsubscribed in `ngOnDestroy`:
```typescript
export class MyComponent implements OnDestroy {
  private subscriptions = new Subscription();

  ngOnInit() {
    const sub = this.service.data$.subscribe(...);
    this.subscriptions.add(sub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
```

2. **Timers (setTimeout/setInterval)** - Must be cleared:
```typescript
export class MyComponent implements OnDestroy {
  private timeoutId?: number;

  doSomething() {
    this.timeoutId = window.setTimeout(() => {...}, 3000);
  }

  ngOnDestroy() {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
  }
}
```

3. **Nested Subscriptions** - Parent subscription must track children:
```typescript
this.parentSub = observable1$.subscribe(() => {
  const childSub = observable2$.subscribe(...);
  this.parentSub.add(childSub); // Track nested subscription
});
```

4. **Services with Subscriptions** - Services must implement `OnDestroy` if they create subscriptions or timers that need cleanup

## Testing

### Unit Tests (Jasmine + Karma)
- Test files: `*.spec.ts` alongside source files
- Run all tests: `npm test`
- Run in CI mode: `npm test -- --no-watch --browsers=ChromeHeadless`
- Run specific test: `ng test --include='**/conversion-format.spec.ts'`
- Coverage report: `npm test -- --no-watch --code-coverage`

### E2E Tests (Cypress)
- Test files: `cypress/e2e/*.cy.ts`
- Interactive mode: `npm run e2e` (requires dev server running)
- Headless mode: `npm run e2e:ci`
- Viewport: 375x667 (iPhone SE, mobile-first)
- Configuration: `cypress.config.ts`, `cypress/tsconfig.json`

### Test Coverage
Current test suite includes:
- Service test files with unit tests
- E2E test files for conversion scenarios
- Coverage areas: file conversion, PDF, images, file system

## Development Tools

### Git Hooks (Husky)
Pre-commit hooks are configured to run automatically:
- `lint-staged` runs ESLint + Prettier on staged files
- Commits are blocked if linting fails
- Skip hooks only in emergencies: `git commit --no-verify`

### Code Formatting
- Prettier enforces consistent code style
- Single quotes, semicolons, 100 char line width
- Auto-format on commit via lint-staged
- Manual format: `npm run format`

### Bundle Analysis
- Use `npm run analyze` to visualize bundle composition
- Identify large dependencies and optimization opportunities
- Monitor lazy-loaded chunks vs main bundle

## Common Issues and Workarounds

### TypeScript Compilation
If you encounter TypeScript errors with third-party libraries:
1. Check if `skipLibCheck: true` is set in `tsconfig.json`
2. For Cypress, ensure `cypress/tsconfig.json` extends the base config

### Build Warnings
Expected warnings (non-blocking):
- CommonJS dependency warnings for `pdf-lib` (unavoidable, library not ESM)
- SCSS budget warnings for large component styles (monitor but acceptable)
- Bundle size warnings if under 5MB initial (configured in `angular.json`)

### Service Worker Issues
If Service Worker isn't working:
- Service Worker only works in production builds
- Use `npm run build -- --configuration production`
- Serve from `www/` directory, not dev server
- Check browser DevTools > Application > Service Workers

### Git Pre-commit Hooks Slow
If pre-commit hooks are too slow:
- `lint-staged` only processes staged files (already optimized)
- Temporary bypass: `git commit --no-verify` (use sparingly)
- Consider increasing Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`
