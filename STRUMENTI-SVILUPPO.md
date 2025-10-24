# EasyConverter - Strumenti di Sviluppo

**Data Setup**: 24 Ottobre 2025

Questo documento descrive tutti gli strumenti di sviluppo configurati per garantire qualità del codice, stabilità, sicurezza e testing completo del progetto EasyConverter.

---

## 📦 Strumenti Installati

### 1. **Prettier** - Code Formatter
**Versione**: 3.6.2

**Descrizione**: Formattazione automatica del codice per consistenza stilistica.

**Configurazione**:
- `.prettierrc.json` - Regole di formattazione
- `.prettierignore` - File esclusi dalla formattazione

**Script NPM**:
```bash
# Formatta tutti i file sorgente
npm run format

# Controlla formattazione senza modificare
npm run format:check
```

**Regole Principali**:
- Single quotes per stringhe
- Semicolons obbligatori
- Print width: 100 caratteri (120 per HTML)
- Tab width: 2 spazi
- Trailing commas: ES5

---

### 2. **ESLint** - Code Linter
**Versione**: 9.16.0 (con Angular ESLint 20.0.0)

**Descrizione**: Analisi statica del codice per identificare problemi e anti-pattern.

**Configurazione**:
- `.eslintrc.json` - Regole ESLint + integrazione Prettier
- Plugin Angular ESLint per regole specifiche Angular
- `eslint-plugin-prettier` per integrare Prettier con ESLint

**Script NPM**:
```bash
# Esegui linting su tutto il progetto
npm run lint
```

**Regole Custom**:
- Component suffix: `Page` o `Component` permessi (Ionic convention)
- Prefix componenti: `app-`
- Standalone components: opzionale (warning disabilitato)
- Integrazione Prettier: `plugin:prettier/recommended`

---

### 3. **Husky** - Git Hooks Manager
**Versione**: 9.1.7

**Descrizione**: Automazione pre-commit/pre-push checks per qualità codice.

**Configurazione**:
- `.husky/pre-commit` - Hook che esegue lint-staged prima di ogni commit

**Come Funziona**:
- **Pre-commit**: Esegue automaticamente `lint-staged` su file staged
- Blocca il commit se ci sono errori ESLint o formattazione
- Formatta automaticamente file con Prettier

**Disabilitare Hooks (se necessario)**:
```bash
# Salta pre-commit hook (uso solo per emergenze)
git commit --no-verify -m "message"
```

---

### 4. **lint-staged** - Staged Files Linter
**Versione**: 16.2.6

**Descrizione**: Esegue linting e formattazione solo sui file git staged.

**Configurazione** (in `package.json`):
```json
"lint-staged": {
  "*.{ts,html}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{scss,css,json,md}": [
    "prettier --write"
  ]
}
```

**Workflow**:
1. Fai modifiche ai file
2. `git add .`
3. `git commit -m "message"`
4. → lint-staged esegue automaticamente:
   - ESLint fix su file TypeScript/HTML
   - Prettier format su tutti i file staged
5. Se tutto ok → commit creato ✅
6. Se errori → commit bloccato ❌ (correggi errori e riprova)

---

### 5. **Cypress** - E2E Testing
**Versione**: 15.5.0

**Descrizione**: Framework per test end-to-end interfaccia utente.

**Configurazione**:
- `cypress.config.ts` - Configurazione Cypress
- `cypress/e2e/` - Test E2E
- `cypress/support/` - Helper e comandi custom
- Viewport mobile-first: 375x667 (iPhone SE)

**Script NPM**:
```bash
# Apri Cypress UI per sviluppo
npm run e2e

# Esegui test in modalità headless (CI)
npm run e2e:ci
```

**Test Disponibili**:
- `cypress/e2e/home.cy.ts` - Test pagina home

**Esempio Test**:
```typescript
describe('EasyConverter Home', () => {
  it('should display app title', () => {
    cy.visit('/');
    cy.contains('EasyConverter').should('be.visible');
  });
});
```

**Workflow Test**:
1. Avvia dev server: `npm start` (in terminale separato)
2. Esegui test: `npm run e2e`
3. Scrivi nuovi test in `cypress/e2e/`

---

### 6. **webpack-bundle-analyzer** - Bundle Size Analysis
**Versione**: 4.10.2

**Descrizione**: Visualizzazione interattiva dimensioni bundle per ottimizzazione.

**Script NPM**:
```bash
# Genera report bundle size
npm run analyze
```

**Output**:
- Build production con `--stats-json`
- Report interattivo HTML su `http://127.0.0.1:8888`

**Come Leggere**:
- 🟥 Rosso = Bundle grandi (opencv.js, pdfjs-dist)
- 🟨 Giallo = Bundle medi
- 🟩 Verde = Bundle piccoli
- Hover su rettangoli per vedere dimensioni dettagliate

**Quando Usare**:
- Dopo aggiunta nuove librerie
- Per identificare dipendenze duplicate
- Prima di release per verificare budget

---

### 7. **@angular/pwa** - Service Worker
**Versione**: 20.0.0

**Descrizione**: Service Worker Angular per funzionalità PWA offline.

**Configurazione**:
- `ngsw-config.json` - Strategia caching
- `public/manifest.webmanifest` - PWA manifest
- Service Worker attivo solo in build production

**Features**:
- ✅ Installabile come app nativa
- ✅ Caching automatico asset app
- ✅ Funzionalità offline
- ✅ Update automatici nuove versioni

**Test PWA**:
```bash
# Build production
npm run build

# Serve con http-server (installa se necessario)
npx http-server www -p 8080

# Apri http://localhost:8080 e testa offline
```

---

## 🎯 Workflow Sviluppo Raccomandato

### 1. **Prima di Iniziare a Codare**
```bash
# Aggiorna dipendenze (se necessario)
npm install

# Verifica che tutto funzioni
npm run lint
npm run build
```

### 2. **Durante lo Sviluppo**
```bash
# Avvia dev server con hot reload
npm start

# In terminale separato: formatta codice mentre scrivi
npm run format:check

# Esegui test E2E (opzionale)
npm run e2e
```

### 3. **Prima di Commit**
```bash
# Formatta tutti i file
npm run format

# Verifica lint
npm run lint

# Aggiungi file
git add .

# Commit (pre-commit hook esegue automaticamente lint-staged)
git commit -m "feat: add new feature"

# Se hook blocca commit → correggi errori e riprova
```

### 4. **Prima di Release**
```bash
# Test build production
npm run build

# Analizza bundle size
npm run analyze

# Esegui test E2E in CI mode
npm run e2e:ci

# Verifica PWA
# (vedi sezione Test PWA sopra)
```

---

## 📊 Quality Gates Configurate

### Pre-Commit Hooks (Husky + lint-staged)
- ✅ ESLint fix automatico su file .ts e .html
- ✅ Prettier format automatico su tutti i file
- ❌ Blocco commit se errori ESLint non risolvibili automaticamente

### Build Production
- ⚠️ Warning se bundle > budget configurati (angular.json)
- ⚠️ Warning per dipendenze CommonJS (es. pdf-lib)

### Lint Checks
- ❌ Errori per violazioni regole Angular ESLint
- ❌ Errori per problemi formattazione Prettier

---

## 🔧 Configurazioni Avanzate

### Modificare Regole Prettier
Edita `.prettierrc.json`:
```json
{
  "printWidth": 120,  // Aumenta larghezza linea
  "singleQuote": false  // Usa double quotes
}
```

### Aggiungere Regole ESLint
Edita `.eslintrc.json`:
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",  // Blocca 'any' type
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

### Escludere File da Lint-Staged
Edita `package.json` → `lint-staged`:
```json
{
  "*.{ts,html}": [
    "eslint --fix --ignore-pattern '**/*.spec.ts'",  // Ignora test files
    "prettier --write"
  ]
}
```

### Configurare Cypress per Mobile Testing
Edita `cypress.config.ts`:
```typescript
{
  viewportWidth: 414,   // iPhone 11 Pro
  viewportHeight: 896
}
```

---

## 🐛 Troubleshooting

### Prettier vs ESLint Conflicts
**Problema**: ESLint e Prettier danno suggerimenti contrastanti.

**Soluzione**: Abbiamo già configurato `eslint-config-prettier` che disabilita regole ESLint che confliggono con Prettier.

Se problema persiste:
```bash
npm run format  # Formatta prima con Prettier
npm run lint    # Poi verifica ESLint
```

---

### Pre-commit Hook Troppo Lento
**Problema**: Hook impiega troppo tempo su progetti grandi.

**Soluzione 1**: lint-staged esegue solo su file staged (già configurato).

**Soluzione 2**: Disabilita temporaneamente:
```bash
git commit --no-verify -m "message"
```

---

### Cypress Tests Failing
**Problema**: Test Cypress falliscono con timeout.

**Soluzione**:
```bash
# 1. Verifica dev server sia avviato
npm start

# 2. Aumenta timeout in cypress.config.ts
{
  defaultCommandTimeout: 10000  // 10 secondi invece di 4
}

# 3. Usa cy.wait() nei test
cy.wait(1000);  // Aspetta 1 secondo
```

---

### Bundle Size Warnings
**Problema**: Build production supera budget bundle size.

**Soluzione**:
```bash
# 1. Analizza bundle
npm run analyze

# 2. Identifica librerie pesanti

# 3. Lazy load librerie pesanti:
// Before (carica sempre)
import * as cv from 'opencv.js';

// After (carica on-demand)
const cv = await import('opencv.js');
```

---

## 📚 Risorse e Documentazione

### Prettier
- Docs: https://prettier.io/docs/en/
- Playground: https://prettier.io/playground/

### ESLint
- Angular ESLint: https://github.com/angular-eslint/angular-eslint
- Regole: https://eslint.org/docs/latest/rules/

### Husky
- Docs: https://typicode.github.io/husky/
- Guide: https://typicode.github.io/husky/get-started.html

### Cypress
- Docs: https://docs.cypress.io/
- Best Practices: https://docs.cypress.io/guides/references/best-practices

### Webpack Bundle Analyzer
- GitHub: https://github.com/webpack-contrib/webpack-bundle-analyzer

### Angular PWA
- Docs: https://angular.dev/ecosystem/service-workers
- Config: https://angular.dev/ecosystem/service-workers/config

---

## ✅ Checklist Setup Completato

- [x] Prettier installato e configurato
- [x] ESLint integrato con Prettier
- [x] Husky pre-commit hooks attivi
- [x] lint-staged configurato
- [x] Cypress E2E testing setup
- [x] webpack-bundle-analyzer disponibile
- [x] @angular/pwa Service Worker configurato
- [x] Script NPM aggiunti a package.json
- [x] Git repository inizializzato
- [x] Initial commit creato
- [x] Tutti i lint checks passano ✅
- [x] Build production funzionante ✅

---

## 🚀 Prossimi Passi

Con gli strumenti di sviluppo configurati, puoi procedere con:

1. **Fase 5**: PWA Configuration (Service Worker già pronto)
2. **Fase 6**: Servizi Avanzati (Scanner, OCR)
3. **Fase 7**: UI Components Avanzati
4. **Fase 8**: Feature Scanner
5. **Fase 9**: Testing & Optimization (con Cypress E2E)

---

**Versione**: 1.0
**Data**: 24 Ottobre 2025
**Maintainer**: EasyConverter Dev Team
