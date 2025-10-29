/// <reference types="cypress" />

describe('EasyConverter Home Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should display the app title', () => {
    cy.contains('EasyConverter').should('be.visible');
  });

  it('should have file picker component', () => {
    cy.get('app-file-picker').should('exist');
  });

  it('should show hero section with benefits', () => {
    cy.contains('Fast').should('exist');
    cy.contains('Secure').should('exist');
    cy.contains('Offline').should('exist');
  });

  it('should handle file selection workflow', () => {
    // This is a basic structure - actual file upload testing requires fixtures
    cy.get('app-file-picker').should('be.visible');
  });
});
