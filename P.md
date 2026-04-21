# EasyConverter - Stato Consolidato e Direzione Operativa

Riferimento unico per stato reale, architettura, capacità di conversione, verifiche e priorità di sviluppo.

## Identità Prodotto

- Versione: `2.0.0`
- PWA mobile-first, conversione documenti totalmente client-side e offline-first
- Scanner e OCR fuori scope

## Formati Supportati

- Testo: `TXT`, `MD`, `HTML`, `RTF`
- Dati: `CSV`, `JSON`, `XLSX`, `ODS`, `YAML`, `XML`, `BASE64`
- Documenti: `PDF`, `EPUB`
- Immagini: `PNG`, `JPEG`, `WEBP`

Obiettivo: 15+ formati, 120+ combinazioni realistiche, pipeline multi-step affidabili.

## Architettura e Stack

Angular 21 (NgModule) · Ionic 8 · Capacitor 8 · TypeScript 5.9 · Angular Service Worker · `@ngx-translate/core`

Path aliases: `@app/*`, `@core/*`, `@shared/*`, `@env/*`

Regola: librerie pesanti via `dynamic import` con cache applicativa.

### Servizi Core

| Servizio                       | Ruolo                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `converter.service`            | Orchestrazione conversioni e lazy loading                                                              |
| `file-system.service`          | Save/share multipiattaforma                                                                            |
| `pdf.service`                  | Creazione PDF ed estrazione testo                                                                      |
| `image.service`                | Conversioni immagine ed EXIF                                                                           |
| `csv.service`                  | Parsing CSV avanzato                                                                                   |
| `html.service`                 | Sanitize, inline CSS, estrazione testo                                                                 |
| `rtf.service`                  | RTF con tokenizer strutturato (bold, italic, underline, strikethrough, super/sub, Unicode, hex escape) |
| `epub.service`                 | Parsing EPUB (container.xml, spine order, CSS, metadata), generazione EPUB                             |
| `xml.service` / `yaml.service` | XML/YAML ↔ JSON                                                                                        |
| `base64.service`               | Encode/decode browser-native                                                                           |
| `spreadsheet-worker.service`   | Bridge tipizzato per worker XLSX con fallback main thread                                              |
| `error.service`                | `ConversionTimeoutError`, `ConversionCancelledError`                                                   |
| `language.service`             | Switch runtime en/it                                                                                   |
| `pwa-update.service`           | Aggiornamenti PWA                                                                                      |

### Librerie Chiave

`xlsx` · `papaparse` · `marked` · `turndown` · `pdfjs-dist` · `pdf-lib` · `jszip` · `yaml` · `fast-xml-parser` · `dompurify` · `juice` · `piexifjs`

## Stato Verificato

Verifica: `2026-03-30` (post P5.6.1 completamento)

- `lint`: ok
- `test`: `193/193` success
- `build production`: ok, zero warning
- `npm audit`: **0 vulnerabilities**
- `E2E real-conversions`: `12/12` pass su Chromium, Firefox, WebKit (36 totali)
- `E2E offline-conversions`: `10/10` pass su Chromium, Firefox; WebKit skip (SW limitation)

### Sicurezza

- **0 vulnerabilità** — xlsx aggiornato a 0.20.3 (da CDN SheetJS, fix Prototype Pollution + ReDoS)
- DOMPurify su tutti i flussi HTML, formula injection mitigata in CSV/XLSX
- CSP e security headers via Cloudflare Pages `_headers`

## Comportamento Fissato dai Test

### HTML → CSV/XLSX

- Celle unite `rowspan/colspan`: warning preflight, ricostruzione a griglia
- Senza `<th>`: fallback `column_1`, `column_2`, ...
- Più tabelle: usa la prima `table` utile
- Tabelle annidate: solo righe esterne, testo diretto, warning `HTML_TABLE_NESTED`
- `<thead>` trattato come header anche con `<td>`; `<tfoot>` escluso dall'export
- `<thead>` multi-riga: prima riga = header, successive = dati
- `<thead>` + `<tbody>` vuoto: blocco `HTML_TABLE_REQUIRED`
- HTML vuoto senza tabella: blocco preflight e fallimento conversione
- Escaping CSV: virgole, virgolette, newline normalizzati a spazi

### JSON → CSV/XLSX/HTML

- Array di primitivi: blocco `JSON_ARRAY_OF_OBJECTS_REQUIRED`
- Array annidati di oggetti: blocco `STRUCTURED_TABULAR_DATA_REQUIRED`
- Oggetti flattenabili: warning `STRUCTURED_DATA_NORMALIZED`, chiavi come `profile.firstName`
- Singolo oggetto flattenabile: warning, non blocco, export una riga
- Ordine colonne: depth-first dal primo record
- `null` → cella vuota, booleani/numeri preservati, array primitivi joinati con quoting CSV
- JSON vuoto/whitespace: blocco `INVALID_JSON`
- `[]`: warning `REQUIRES_UNIFORM_DATA`, CSV produce output vuoto

### XML → CSV/XLSX/HTML

- XML malformato: blocco `INVALID_XML`
- Strutture flattenabili: header flattenati con prefissi nodo root
- Naming `snake_case`: include prefissi `xml_version`, `root_items_item_*`
- Singolo record: warning `STRUCTURED_DATA_NORMALIZED`, una riga
- XML vuoto: blocco `INVALID_XML`, errore parsing
- Tag vuoti → stringa vuota, include prefisso `?xml.@_version`

### RTF

- `RTF → TXT`: estrazione diretta via tokenizer (no HTML intermedio)
- `RTF → HTML`: preserva bold, italic, underline, strikethrough (`<s>`), superscript (`<sup>`), subscript (`<sub>`), font size, paragrafi, line break
- `RTF → MD`: formattazione reale (`**bold**`, `_italic_`) via HTML intermedio
- Escape hex (`\'e8` → è) e Unicode (`\uN` con skip ANSI fallback via `\uc`)
- Valori Unicode negativi (`\u-4` → codepoint unsigned)
- `\plain` resetta tutta la formattazione
- Gruppi destinazione (`fonttbl`, `colortbl`, `stylesheet`, `info`, `pict`) saltati

### EPUB

- Estrazione via `container.xml` → rootfile path, fallback su `OEBPS/`, `OPS/`, root
- Ordine capitoli dallo `<spine>`, non dal manifest
- Nav documents esclusi, CSS inline preservato, `<style>` rimosso da testo
- EPUB vuoto o senza content.opf: errore esplicito
- Href percent-encoded decodificati; spine items mancanti saltati silenziosamente
- `extractMetadataFromEpub`: titolo, autore, lingua, editore dal content.opf

### TXT → CSV

- Delimiter detection automatica (virgola, punto e virgola, tab, pipe) via PapaParse
- Testo con meno di 2 righe: blocco `TXT_NO_TABULAR_STRUCTURE`
- Nessun delimiter coerente: warning `TXT_DELIMITER_UNCERTAIN`, conversione best-effort
- Testo ben delimitato: conversione diretta, output normalizzato a virgola con quoting CSV
- Valori con virgole nel testo sorgente: quotati nell'output CSV
- Testo vuoto: errore di conversione

### CSV/XLSX → MD

- Genera tabella Markdown con header, separatore `---`, e righe dati
- Pipe `|` nelle celle: escape `\|`; newline nelle celle: normalizzati a spazio
- Valori null/undefined: cella vuota
- CSV/XLSX vuoti (solo header): output valido con sola intestazione

### CSV/XLSX → PDF

- Pipeline: dati → HTML table → PDF via `PdfService.createPdfFromHtml`
- Preflight: warning `MULTI_STEP_REVIEW` (pipeline fragile multi-step)

### Timeout e Cancellazione

- Timeout per-categoria: PDF 180s, immagini/spreadsheet 120s, documenti/dati 60s, encoding 30s, ebook 120s
- Timeout → `ConversionTimeoutError`; cancellazione utente → `ConversionCancelledError`
- Signal già abortito → cancellazione immediata
- Worker: XLSX parsing/serializzazione off-main-thread, fallback sincrono senza Worker

## Prestazioni e Vincoli

Bundle iniziale: ~716 KB raw, ~185 KB transfer. Lazy chunks: `xlsx` ~423 KB, `pdfjs-dist` ~400 KB, `yaml` ~104 KB, `marked` ~40 KB, `fast-xml-parser` ~30 KB, `turndown` ~11 KB.

Vincoli: output su `www/`, Service Worker solo in production, `manifest.webmanifest` e `ngsw-config.json` come fonti di verità PWA.

### Limiti Upload

| Categoria                  | Limite |
| -------------------------- | ------ |
| PDF                        | 25 MB  |
| Immagini                   | 15 MB  |
| Spreadsheet (CSV/XLSX/ODS) | 15 MB  |
| Testo e dati strutturati   | 20 MB  |
| EPUB                       | 20 MB  |
| BASE64                     | 10 MB  |
| Fallback                   | 25 MB  |

Razionale: in una PWA client-side il collo di bottiglia è il picco di memoria, non la dimensione file.

## Matrice Conversioni

### Alto Valore

`TXT ↔ MD ↔ HTML` · `TXT/MD/HTML → PDF` · `CSV ↔ JSON ↔ XLSX` · `XML ↔ JSON ↔ YAML` · `RTF → HTML → MD/TXT` · `EPUB → TXT/HTML/MD` · `PNG/JPEG/WEBP → PDF` · `BASE64 ↔ TXT/HTML/JSON/XML/YAML`

Pipeline: `XML → JSON → YAML` · `XML → JSON → CSV` · `YAML → JSON → XML` · `RTF → HTML → PDF` · `EPUB → HTML → PDF` · `MD → HTML → PDF` · `MD → HTML → RTF`

### Medio Valore

`HTML → CSV/XLSX` (solo tabelle vere) · `JSON → CSV/XLSX` (flattening controllato) · `XLSX → MD/HTML/PDF` ✅ · `CSV → MD/PDF` ✅ · `PDF → TXT/MD/HTML` (text-only) · `EPUB → PDF` (resa testuale) · `TXT → CSV` (delimiter detection) ✅ · `ODS` in lettura · `MD → RTF` ✅ · `YAML → XML/TXT` ✅ · `XML → TXT` ✅

### Da Evitare

`PDF → CSV/XLSX/JSON` generico · `PDF → HTML/MD` fedele al layout · `HTML → CSV/XLSX` su pagine non tabellari · `JSON/XML/YAML → CSV/XLSX` senza normalizzazione · scrittura `ODS` completa · "qualsiasi → immagine" · ricostruzione layout avanzata · OCR/scanner

## Linee Guida

Classificazione conversioni: `lossless` · `structured` · `text-only` · `best-effort` · `table-only` · `requires-uniform-data`

Direzione: affidabilità prima del numero di combinazioni · pipeline componibili · fallback chiari · validazione contenuto reale, non solo estensione.

## Priorità di Sviluppo

### P1 — Completato

Pipeline interna a step riusabili, classificazione affidabilità in dominio e UI, rilevamento contenuto reale del file, validazioni preventive per conversioni lossy, normalizzazione tabellare `JSON/XML/HTML`, opzioni flattening utente, ricostruzione griglia `rowspan/colspan`, Web Worker XLSX, timeout per-categoria, cancellazione utente, CSP, aggiornamento Capacitor 7.6.1, conversioni `EPUB → PDF/RTF`, tokenizer RTF strutturato con formattazione completa, estrazione EPUB con container.xml/spine/CSS/nav filtering, robustezza Unicode RTF e percent-encoding EPUB, metadata extraction EPUB.

159 test automatici coprono tutti i comportamenti sopra.

### P2 — Completato

- ~~Migliorare `EPUB` e `RTF`~~ completato (Unicode, `\plain`, strikethrough, super/sub, percent-encoded hrefs, metadata extraction, graceful missing spine)
- ~~Migliorare `HTML table`~~ completato (tabelle annidate, `<thead>/<tbody>/<tfoot>`, testo diretto, `HTML_TABLE_NESTED`, header-only blocking, multi-row `<thead>`)

### P3 — Completato

- ~~Ridurre warning CommonJS e warning di build~~ già pulita: zero warning, tutti i `allowedCommonJsDependencies` (boolbase, pako, papaparse, jszip, juice, piexifjs) verificati necessari
- ~~Rifinire budget SCSS e pulizia file inutilizzati~~ budget SCSS nei limiti (6KB warning / 8KB error), nessun file inutilizzato in `src/`, ESLint 9 migration pulita
- ~~Analizzare ottimizzazioni bundle e chunking~~ fix script `analyze` (path corretto `www/stats.json`), bundle iniziale 185KB transfer ottimale, lazy loading corretto per librerie pesanti
- Fix 10 errori Prettier in `converter.service.ts` e `.spec.ts`

### P4 — Completato

- **Angular 20 → 21.2.6**: migrazioni automatiche applicate (block control flow, bootstrap options, tsconfig lib/moduleResolution), NgModules confermati supportati
- **Capacitor 7 → 8.3.0**: impatto nullo per PWA web-only, tutti i plugin aggiornati
- **TypeScript 5.8 → 5.9.3**: richiesto da Angular 21
- **xlsx 0.18.5 → 0.20.3**: installato da CDN SheetJS (`cdn.sheetjs.com`), fix Prototype Pollution (CVE-2023-30533) e ReDoS (CVE-2024-22363), API identica, zero code changes
- **angular-eslint 20 → 21.3.1**, **@angular-builders/custom-webpack 20 → 21.0.3**
- Dipendenze minor/patch aggiornate: juice, turndown, rxjs, tslib, karma, toolkit, types, eslint plugins
- `npm audit`: **0 vulnerabilities**
- Valutazione alternative xlsx: ExcelJS (no ODS), @e965/xlsx (possibile futuro), read-excel-file (read-only) — nessuna alternativa completa; SheetJS da CDN è la soluzione raccomandata

### P5 — Espansione Funzionale

5.1 ~~Nuove conversioni medio valore: `TXT → CSV` (delimiter detection), `XLSX → MD/PDF`, `CSV → MD/PDF`~~ COMPLETATO — 5 nuove conversioni, delimiter detection con preflight (blocking su testo non tabellare, warning su delimiter incerto), Markdown table generator con escape pipe/newline, pipeline HTML→PDF per CSV/XLSX, 17 nuovi test (176 totali)
5.2 ~~Usare metadata EPUB estratti per titoli output migliori~~ COMPLETATO — filename output da titolo+autore EPUB (sanitizzato per filesystem), `<title>` HTML dall'EPUB, metadata EPUB in `ConversionResult`, fallback graceful se estrazione metadata fallisce, 9 nuovi test (185 totali)
5.3 Estendere copertura E2E Playwright (offline, cross-browser, conversioni reali)
5.3.1 ~~Conversioni reali E2E (Chromium)~~ COMPLETATO — 11 test E2E in `playwright/real-conversions.spec.ts`: TXT→MD, TXT→HTML, MD→TXT, MD→HTML, HTML→TXT, HTML→Markdown, CSV→JSON, RTF→HTML, RTF→TXT, EPUB→TXT, EPUB→HTML. Helper robusto con workaround per modal Ionic (JS click) e reactivity gap format-selector (selezione manuale source per formati async-detected). EPUB generato in-test via JSZip.
5.3.2 ~~Verifica contenuto output~~ COMPLETATO — `convertFile` helper intercetta download via `page.waitForEvent('download')`, legge il contenuto del file scaricato e lo ritorna come stringa. Tutti gli 11 test verificano il contenuto effettivo dell'output: testo preservato (TXT/MD/HTML), tag HTML corretti (`<strong>`, `<em>`, `<h1>`), Markdown formattato (`**bold**`, setext headers), JSON parsabile con struttura e valori attesi (CSV→JSON), formattazione RTF→HTML preservata, contenuto EPUB estratto correttamente.
5.3.3 ~~Test offline reali~~ COMPLETATO — 10 test E2E in `playwright/offline-conversions.spec.ts`: app shell offline, TXT→MD, TXT→HTML, MD→TXT, MD→HTML, HTML→TXT, HTML→Markdown, CSV→JSON, RTF→TXT, RTF→HTML. Ogni test attiva il Service Worker online, poi `context.setOffline(true)` + reload, ed esegue conversione completa con verifica contenuto output scaricato. Copertura: testo semplice, Markdown (lazy-load `marked`), HTML→MD (lazy-load `turndown`), CSV parsing (`papaparse`), RTF tokenizer.
5.3.4 ~~Cross-browser Firefox + WebKit~~ COMPLETATO — `playwright/real-conversions.spec.ts`: `12/12` pass su Chromium, Firefox e WebKit (zero skip). `playwright/offline-conversions.spec.ts`: `10/10` pass su Chromium e Firefox, WebKit escluso per limitazione nota del Service Worker in Playwright. Fix applicati: (1) `FormatSelectorComponent` reso reattivo con `effect()` per sincronizzare input→selectedSource/Target, risolvendo il race condition tra creazione componente e format detection asincrona; (2) upload file via DataTransfer API per compatibilità cross-browser affidabile; (3) `isInspectableTextFormat` ora rispetta estensioni non ambigue (MD, RTF, YAML) senza sovrascriverne il formato tramite content detection; (4) esecuzione seriale per evitare instabilità del web server con worker paralleli.

### Matrice Rischi Reali Safari / WebKit

Valutazione: `2026-03-30` — aggiornata post completamento E2E cross-browser.

| Area                                            | Stato Safari / WebKit   | Severità   | Nota operativa                                                                                                                                                               |
| ----------------------------------------------- | ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selezione file upload                           | Verificato              | Bassa      | DataTransfer API funziona su WebKit Playwright; input file standard confermato compatibile                                                                                   |
| Auto-detect formato sorgente                    | Verificato              | Bassa      | FormatSelectorComponent reattivo con effect; format detection confermata cross-browser per tutti i formati testati                                                           |
| Selezione manuale formato sorgente/destinazione | Verificato              | Bassa      | Modal Ionic funzionano su WebKit con click JS; nessun skip necessario                                                                                                        |
| Conversioni testuali/dati in memoria            | Verificato              | Bassa      | TXT/MD/HTML/CSV/JSON/RTF/EPUB: 12/12 E2E pass su WebKit                                                                                                                      |
| Conversioni spreadsheet pesanti (`XLSX`)        | Degrado possibile       | Media      | Se il module worker avesse problemi su WebKit, esiste fallback sul main thread: rischio principale = UI lenta/bloccata, non failure sistematica                              |
| Download file convertito                        | Fragile                 | Alta       | Salvataggio web via `Blob URL` + `<a download>` + `revokeObjectURL` immediata: Safari/iOS può aprire preview, ignorare filename o non avviare il download in modo affidabile |
| Converti e condividi                            | Fragile                 | Alta       | Uso di `navigator.share({ files })` senza verifica `navigator.canShare({ files })`; su Safari il supporto file-share può essere parziale o incoerente                        |
| Offline / PWA installata                        | Da validare manualmente | Media-Alta | Copertura E2E offline solo Chromium/Firefox; Safari storicamente meno prevedibile su Service Worker, cache e lazy assets offline                                             |
| Aggiornamento PWA                               | Da monitorare           | Media      | Flusso Angular SW standard, ma il comportamento update/reload in Safari va verificato manualmente su device/browser reale                                                    |

Conclusione operativa: le conversioni e l'interazione UI sono ora verificate E2E su tutti e tre i browser. Il rischio residuo su Safari/WebKit riguarda esclusivamente il post-conversione (`download`, `share`) e l'affidabilità `offline/PWA`, non la conversione in sé.
5.4 ~~Valutare preview file pre-conversione e feedback qualità conversione~~ COMPLETATO — introdotta preview pre-conversione locale in `HomePage` per formati testuali e immagini (con fallback esplicito per formati non previewabili), scheda “qualità attesa” basata su affidabilità + preflight, e riepilogo post-conversione con output size/durata per aiutare la verifica manuale. Scope volutamente leggero: nessuna preview binaria avanzata per `PDF/XLSX/EPUB`, nessuna analisi semantica del file convertito, ma UX sufficiente per ridurre errori evidenti prima e subito dopo il salvataggio/condivisione.
5.5 ~~Hardening bugfix e sicurezza post-review~~ COMPLETATO — sanitizzazione HTML resa effettiva e di default nei flussi che producono HTML riusabile da input non fidato (`HTML -> EPUB/PDF/RTF/MD`, `EPUB -> HTML/MD/PDF/RTF`, wrapper `processHtmlOptions` con preservazione del documento completo), formula injection mitigata in export `CSV/XLSX` neutralizzando celle stringa che iniziano con `=`, `+`, `-`, `@`, integrazione `DOMPurify` corretta in `html.service` con `ALLOWED_ATTR` conforme e supporto robusto per documenti HTML completi, reset del file picker corretto azzerando anche il valore reale dell'`<input type="file">`. Regressioni coperte con test unitari mirati (`HtmlService`, `ConverterService`, `FilePickerComponent`) ed E2E Playwright su `HTML -> CSV`.
5.6 Completamento i18n
5.6.1 ~~Completare traduzioni EN/IT~~ COMPLETATO — eliminate tutte le stringhe hardcoded residue dall'intera app e coperte con chiavi `@ngx-translate` nei file JSON `src/assets/i18n/en.json` e `src/assets/i18n/it.json`. Stringhe migrate: alert successo conversione (header, messaggio con durata, bottone OK), messaggi errore conversione/condivisione con interpolazione, hint format detection, messaggio "Converting file...", selezione multipla file picker, gestione tradotta di timeout e cancellazione conversione. Componente `UpdateNotificationComponent` migrato da stringhe italiane hardcoded a pipe `translate` usando le chiavi `PWA_UPDATE.*` già esistenti più nuove chiavi per dettaglio e errore. Rimosso uso di `$localize` a favore di `TranslateService.instant()` uniforme. 193/193 test, lint ok, build production ok.
5.6.2 ~~Deploy Cloudflare Pages~~ IN CORSO — codice pushato su `origin/master` (commit `a3d53e5`), file di configurazione `_headers` e `_redirects` inclusi nel build output `www/`. Deploy manuale da eseguire su Cloudflare Pages dashboard con: repository `Spe1977/EasyConverterPWA`, branch `master`, build command `npm run build`, output directory `www/`, Node.js 20+. Post-deploy: validare HTTPS, caching, Service Worker e header di sicurezza in produzione.
5.8 ~~Hardening post-review e ampliamento matrice conversioni~~ COMPLETATO — (1) Sicurezza: escape XML dei metadati EPUB generati (`language`, `isbn`, `pubdate`) che chiude un vettore di XML injection tramite campi metadata controllati dall'utente; estrazione testo EPUB/HTML riscritta con `DOMParser` in documento isolato al posto di `innerHTML` su live DOM, così payload tipo `<img src=x onerror=...>` non possono più innescare fetch o handler durante la conversione; validazione MIME del data URI in `Base64Service` allineata a RFC 6838 (rifiuto di `data:javascript:...`); filtro `__proto__`/`constructor`/`prototype` e copia iterativa in `flattenTabularRecord` per chiudere prototype pollution via JSON/XML crafted. (2) Bug: strip del BOM UTF-8 in `readFileAsText` (contaminava la prima cella CSV / prima riga MD); `extractNamespaces` ora supporta sia apici doppi che singoli come da spec XML. (3) Nuove conversioni: `MD → RTF` (via HTML intermedio, best-effort), `YAML → XML` (via JSON intermedio, structured), `YAML → TXT` e `XML → TXT` (text-only human-readable). `npm run lint`, `npm run format:check` e `tsc --noEmit` puliti.
5.7 Validazione Safari/iOS (post-deploy)
5.7.1 Smoke-test Safari/iOS — test manuale su Safari desktop e iOS reale (o BrowserStack) delle aree a rischio: download file (`<a download>` + Blob URL), share (`navigator.share({ files })`), installazione PWA, funzionamento offline con Service Worker, aggiornamento PWA. Documentare eventuali bug e workaround necessari.
5.7.2 Fix download/share Safari — applicare i fix emersi dallo smoke-test 5.7.1: gestione fallback download per Safari/iOS (es. `window.open` se `<a download>` non funziona), verifica `navigator.canShare({ files })` prima di invocare `navigator.share`, `revokeObjectURL` differita per compatibilità Safari.

## Backlog Sicurezza

- `xlsx`: aggiornato a 0.20.3 da CDN SheetJS — 0 vulnerabilità residue
- Nota: `xlsx` non è più pubblicato su npm registry; gli aggiornamenti futuri richiedono installazione da `cdn.sheetjs.com`
- Monitorare warning CommonJS (P3)
