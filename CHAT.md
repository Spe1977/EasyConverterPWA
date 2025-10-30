> Cosa manca nei test Cypress? 

● Analizzo lo stato dei test Cypress per identificare i test mancanti:

● Read(CHAT.md)
  ⎿  Read 149 lines

● Search(pattern: "cypress/e2e/**/*.cy.ts")
  ⎿  Found 4 files (ctrl+o to expand)

● Search(pattern: "**/E2E-TEST.md")
  ⎿  Found 1 file (ctrl+o to expand)

● Read(E2E-TEST.md)
  ⎿  Read 942 lines

● 📊 Stato Test Cypress - 7 Test Mancanti

  Basandomi sull'analisi del file E2E-TEST.md, ecco cosa manca nei test
  Cypress:

  ---
  Test Cypress: 54/61 (88.5%)

  🔴 7 Test Falliti - Tutti in scanner.cy.ts

  Categoria A: OCR Language Selection (5 test)

  Problema: I test cercano ion-select per la selezione della lingua OCR, ma
  questo elemento esiste SOLO dopo aver scansionato un'immagine.

  Struttura HTML Scanner:
  @if (!scannedImage()) {
    <!-- Hero section, pulsanti camera -->
  } @else {
    <!-- Preview con ion-select per lingua OCR -->
  }

  Test falliti:
  1. Should have language selector for OCR
  2. Should default to Italian language
  3. Should allow changing OCR language
  4. Should persist language selection
  5. Should show language options

  ---
  Categoria B: Workflow Progress (1 test)

  Problema: Cerca .progress-steps che appare solo nella sezione preview dopo
   lo scan.

  Test fallito:
  6. Should show workflow progress steps

  ---
  Categoria C: UI Interaction (1 test)

  Problema: Elemento coperto dalla toolbar Ionic durante il test.

  Test fallito:
  7. Should handle rapid button clicks

  ---
  🔧 Soluzione Richiesta

  Per fixare questi 7 test servirebbero:

  1. Mock Capacitor Camera API
  cy.window().then((win) => {
    cy.stub(win.Capacitor, 'isNativePlatform').returns(false);
    // Mock camera methods
  });
  2. Simulare Workflow Scansione
    - Trigger camera capture
    - Mock image processing worker
    - Mock OCR worker
    - Attendere che scannedImage() signal si popoli
  3. Stub Web Workers
    - ocr.worker.ts - Simulare risposta OCR
    - image-processing.worker.ts - Simulare edge detection

  Codice esempio necessario:
  it('should have language selector for OCR', () => {
    // 1. Mock camera
    cy.window().then((win) => {
      // Mock getUserMedia
    });

    // 2. Trigger scan
    cy.contains('Take Photo').click();

    // 3. Wait for processing
    cy.wait(2000);

    // 4. NOW ion-select exists
    cy.get('ion-select').should('exist');
  });

  ---
  ⏱️ Effort Stimato

  - Tempo: 4-6 ore
  - Complessità: Alta (mock complessi, conoscenza Capacitor)
  - Beneficio: +7 test (da 88.5% a 100%)

  ---
  🎯 Raccomandazione

  Priorità: BASSA ❗

  Motivi:
  - ✅ Copertura già eccellente al 92% (80/87 totali)
  - ✅ Scanner già testato al 79% (26/33)
  - ✅ Funzionalità verificata manualmente
  - ✅ Test unitari coprono la logica core
  - ⚠️ Mock troppo complessi = difficili da mantenere

  Il progetto è in ottimo stato:
  - Cypress: 54/61 (88.5%) ✅
  - Playwright: 26/26 (100%) ✅✅
  - Unit Tests: 101/101 (100%) ✅✅

  ---
  💡 Vuoi che proceda a fixare questi 7 test?

  Posso implementare il fix completo, ma considera:
  - Pro: Copertura 100% Cypress
  - Contro: 4-6 ore di lavoro, codice mock complesso

  Preferisci che:
  1. ✅ Lasciamo così (92% è ottimo)
  2. 🔧 Fisso i 7 test (verso 100%)
  3. 📝 Altro (dimmi tu!)

> Ok. Adesso dimmi se il file SCANFIXES.md è ancora attuale o è superato 
dalle modifiche e migliorie del codice realizzate.

● Analizzo il file SCANFIXES.md per verificare se è ancora attuale:

● Search(pattern: "**/SCANFIXES.md")
  ⎿  Found 1 file (ctrl+o to expand)
  ⎿  Session limit reached ∙ resets 11pm
     /upgrade to increase your usage limit.
