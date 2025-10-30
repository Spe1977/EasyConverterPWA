# Piano di Modifica - EasyConverter

> **NOTA**: FASE 1 (Rimozioni Scanner/OCR) completata il 2025-10-30
> - ✅ Rimosse dipendenze: opencv.js, tesseract.js, @capacitor/camera
> - ✅ Eliminato modulo scanner completo
> - ✅ Bundle size ridotto di ~16MB (-73%)

---

## 1. MIGLIORAMENTI CONVERSIONI ESISTENTI

### 1.1 PDF (pdf.service.ts)

#### Estrazione Testo Migliorata
- **Attuale**: estrazione base senza formatting
- **Miglioramento**: preservare paragrafi, indentazione, liste
- **Implementazione**: analizzare coordinate testo da pdfjs-dist

#### Split e Merge PDF
- **Libreria**: `pdf-merger-js` (dipende solo da pdf-lib già presente)
- **Funzioni**:
  - Merge multipli PDF
  - Split PDF per pagine
  - Estrai range pagine specifiche
- **Bundle**: +20KB circa

#### Ottimizzazione Rendering
- **Attuale**: DPI fisso 150
- **Miglioramento**: DPI adattivo basato su dimensione output
- **Beneficio**: miglior qualità per conversioni PDF → immagine

### 1.2 EPUB (attualmente limitato)

#### Supporto EPUB3 Completo
- **Libreria**: `jEpub` (~30KB)
- **Attuale**: generazione base da HTML
- **Miglioramenti**:
  - Metadati completi (autore, editore, ISBN, lingua, date)
  - Table of Contents (TOC) navigabile
  - Cover image embedding
  - Multipli capitoli/sezioni
  - CSS custom per styling
  - Media queries per responsive
- **Formati supportati**: EPUB → HTML/TXT (parsing), HTML/MD → EPUB3 (generazione)

### 1.3 CSV (papaparse)

#### Encoding Detection
- **Attuale**: UTF-8 di default
- **Miglioramento**: auto-detect UTF-8, ISO-8859-1, Windows-1252
- **Libreria**: già in papaparse con `encoding: "auto"`

#### Delimiter Auto-Detection
- **Attuale**: virgola di default
- **Miglioramento**: rilevamento automatico (`,` `;` `\t` `|`)
- **Beneficio**: gestione CSV europei (punto e virgola)

#### Quote Handling Avanzato
- Gestione quote annidate
- Escape di caratteri speciali
- Newline in campi quoted

### 1.4 HTML (marked + turndown)

#### Sanitization
- Rimozione script/iframe pericolosi
- Whitelist tag HTML sicuri
- Protezione XSS in conversioni

#### CSS Inline per Email
- Convertire CSS esterni in inline styles
- Utile per email HTML compatibili

#### Minification opzionale
- Ridurre dimensione output HTML
- Rimuovere whitespace/commenti

### 1.5 Immagini (image.service.ts)

#### WebP Support
- **Attuale**: PNG, JPEG
- **Aggiunta**: WebP (formato moderno, -30% dimensione)
- **Browser support**: 97%+ (nativo in Canvas API)

#### Qualità Adattiva
- **Attuale**: qualità fissa 85%
- **Miglioramento**: basata su dimensione target
  - > 2MB originale → 70%
  - 500KB-2MB → 85%
  - < 500KB → 95%

#### EXIF Preservation
- Mantenere metadati EXIF in conversioni immagine
- Rimuovere opzionale per privacy

### 1.6 JSON/Excel (xlsx)

#### Validation JSON Schema
- Validare struttura JSON prima conversione
- Error reporting dettagliato

#### Formule Excel Preservate
- **Attuale**: solo valori
- **Miglioramento**: mantenere formule in export XLSX

#### Named Ranges Support
- Supporto range nominati Excel

---

## 2. NUOVI FORMATI E CONVERSIONI

### 2.1 RTF (Rich Text Format)

#### Libreria: `html-to-rtf` (~20KB)
- **Conversioni**: HTML ↔ RTF
- **Use case**: compatibilità Word, WordPad, LibreOffice
- **Formato**: ancora molto usato in ambito legale/aziendale

#### Catene conversioni possibili
- MD → HTML → RTF
- TXT → HTML → RTF
- DOCX alternativa (ma senza backend)

### 2.2 YAML

#### Libreria: `js-yaml` (~50KB) o `yaml` by eemeli (~40KB)
- **Conversioni**: YAML ↔ JSON ↔ CSV
- **Use case**: configurazioni, DevOps, CI/CD
- **Parsing**: YAML 1.2 completo
- **Dumping**: opzioni formatting (indent, flow/block style)

#### Catene conversioni possibili
- JSON → YAML
- YAML → JSON → CSV/XLSX
- YAML → JSON → HTML (tabelle)

### 2.3 XML

#### Libreria: `fast-xml-parser` (~10KB gzipped)
- **Conversioni**: XML ↔ JSON ↔ altri formati
- **Caratteristiche**:
  - Validazione XML
  - Attributi preservati
  - CDATA support
  - Namespace handling
- **Performance**: più veloce di DOMParser nativo

#### Catene conversioni possibili
- XML → JSON → CSV/XLSX
- JSON → XML
- XML → HTML

### 2.4 Base64 Encode/Decode

#### Nativo JavaScript (0KB bundle!)
- **Conversioni**: File ↔ Base64 string
- **Use case**: embedding immagini, API data transfer
- **Formati**: qualsiasi → Base64, Base64 → riconoscimento mime

### 2.5 Compression (ZIP)

#### Libreria: `jszip` (già presente!)
- **Miglioramento**: batch conversions export
- **Funzione**:
  - Convertire multipli file contemporaneamente
  - Export come ZIP unico
  - Preservare struttura cartelle
- **Esempio**: 10 MD → 10 HTML → archive.zip

---

## 3. MATRICE CONVERSIONI AMPLIATA

### 3.1 Formati Supportati (da 10 a 15+)

**Esistenti** (10):
- TXT, MD, HTML, CSV, JSON, XLSX, ODS, PDF, PNG/JPEG, EPUB

**Nuovi** (5+):
- RTF, YAML, XML, Base64, WEBP, ZIP (batch)

### 3.2 Combinazioni Conversioni

#### Da Testo
- TXT → MD, HTML, PDF, RTF, Base64
- MD → HTML, PDF, TXT, RTF, EPUB
- HTML → MD, TXT, PDF, RTF, EPUB, PNG/JPEG/WEBP
- RTF → HTML → altri formati

#### Da Dati Strutturati
- JSON → CSV, XLSX, YAML, XML, HTML, TXT
- CSV → JSON, XLSX, YAML, XML, HTML
- XLSX → CSV, JSON, YAML, XML, HTML, PDF
- YAML → JSON → tutti i formati JSON
- XML → JSON → tutti i formati JSON

#### Da Documenti
- PDF → TXT, MD, HTML, PNG/JPEG/WEBP (per pagina)
- EPUB → HTML, TXT, MD

#### Da Immagini
- PNG/JPEG/WEBP ↔ tra loro
- Immagini → PDF, Base64

#### Operazioni Speciali
- Multipli PDF → merge → PDF unico
- PDF → split → PDF multipli per pagina
- Multipli file → conversione batch → ZIP
- File → Base64 (embedding)

### 3.3 Stima Combinazioni Totali
- **Prima**: ~45 combinazioni
- **Dopo**: ~120+ combinazioni

---

## 4. IMPATTO BUNDLE SIZE

### Situazione Attuale (dopo FASE 1)
```
Bundle attuale:  ~6 MB (scanner/OCR già rimossi)
Risparmio già ottenuto: -16 MB (-73%)
```

### Nuove Librerie da Aggiungere
```
html-to-rtf:        +0.02 MB
yaml (eemeli):      +0.04 MB
fast-xml-parser:    +0.01 MB
pdf-merger-js:      +0.02 MB
jEpub:              +0.03 MB
---------------------------------
TOTALE AGGIUNTO:    +0.12 MB
```

### Bundle Finale Previsto
```
Attuale:   ~6 MB
Aggiunte:  +0.12 MB
---------------------------------
FINALE:    ~6.12 MB (tutte librerie conversione caricate)
```

---

## 5. QUALITÀ E AFFIDABILITÀ

### 5.1 Testing
- **Aggiungere**: 40+ test nuove conversioni
- **Mantenere**: 100% coverage servizi conversione
- **Update**: Test esistenti per nuove features

### 5.2 Error Handling
- Validazione input per ogni formato
- Fallback graceful su errori
- Progress reporting per operazioni batch
- Memory management per file grandi

### 5.3 Performance
- Lazy loading librerie pesanti (PDF già fatto)
- Web Workers per conversioni lunghe (opzionale)
- Stream processing per file > 10MB
- Caching risultati conversioni

### 5.4 Browser Compatibility
- Tutte librerie proposte: ES6+, modern browsers
- Nessuna dipendenza nativa/WASM
- Polyfill dove necessario
- Fallback per feature non supportate

---

## 6. PRIORITÀ IMPLEMENTAZIONE

> **NOTA**: FASE 1 (Rimozioni) completata ✅

### FASE 2 - Miglioramenti Esistenti (4-5 ore)
1. PDF: split/merge con pdf-merger-js
2. PDF: estrazione testo formattato
3. EPUB: metadati e TOC con jEpub
4. CSV: encoding e delimiter auto-detection
5. HTML: sanitization
6. Immagini: supporto WebP

### FASE 3 - Nuovi Formati (5-6 ore)
1. RTF: conversioni HTML ↔ RTF
2. YAML: conversioni JSON ↔ YAML
3. XML: conversioni XML ↔ JSON
4. Base64: encode/decode qualsiasi file
5. ZIP: batch conversions export

### FASE 4 - Testing e Ottimizzazione (3-4 ore)
1. Unit test nuove conversioni
2. E2E test flussi principali
3. Bundle analysis e ottimizzazione
4. Performance testing file grandi
5. Cross-browser testing

### FASE 5 - Documentazione (1-2 ore)
1. Aggiornare README.md
2. Aggiornare CLAUDE.md (già parzialmente fatto)
3. Matrice conversioni supportate
4. Esempi uso nuove funzionalità
5. Migration guide (se necessario)

**TOTALE STIMATO**: 13-17 ore (FASE 1 già completata)

---

## 7. BENEFICI FINALI

### Tecnici
- Bundle 73% più leggero
- 120+ combinazioni conversioni (da 45)
- 5 nuovi formati supportati
- Miglior qualità conversioni esistenti
- Codice più manutenibile (-30% LOC)

### User Experience
- Caricamento più veloce
- Meno memoria usata
- Più formati supportati
- Conversioni più accurate
- Batch operations

### Business
- Focus su valore differenziante
- Meno competizione diretta (scanner apps)
- Target più ampio (developer, data analyst, content creator)
- Miglior retention (più use case)

---

## 8. RISCHI E MITIGAZIONI

### Rischio: Breaking changes
**Mitigazione**: Major version bump, migration guide, deprecation notice

### Rischio: Nuove librerie instabili
**Mitigazione**: Solo librerie mature (>1M downloads/week), fallback su errori

### Rischio: Bundle size unexpectedly alto
**Mitigazione**: Tree shaking, dynamic imports, bundle analysis continuo

---

## 9. DECISIONI PRESE E STATO

### ✅ Decisioni Completate (FASE 1)
- [x] Rimozione completa scanner confermata
- [x] Libreria YAML: `yaml` by eemeli (più moderna, migliore TS support)
- [x] @capacitor/camera rimosso (usato solo per scanner)
- [x] Batch conversions: implementare in FASE 3
- [x] Priorità nuovi formati: RTF → XML → YAML
- [x] UI: unico workflow conversione (no tab scanner)
- [x] Versioning: 2.0.0 per breaking change

### 🔄 Decisioni da Prendere (FASE 2+)
- [ ] Libreria EPUB: confermare `jEpub` o alternative
- [ ] Libreria RTF: confermare `html-to-rtf` o alternative
- [ ] Implementare CSS inline per HTML (email-ready)?
- [ ] EXIF preservation: default on o off?
- [ ] WebP: formato di default per conversioni immagine?

---

**Documento creato**: 2025-10-30
**Ultimo aggiornamento**: 2025-10-30
**Autore**: Claude Code
**Stato**: FASE 1 completata ✅ - Pronto per FASE 2
