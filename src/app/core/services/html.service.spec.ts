import { TestBed } from '@angular/core/testing';

import { HtmlService } from './html.service';

describe('HtmlService', () => {
  let service: HtmlService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HtmlService],
    });

    service = TestBed.inject(HtmlService);
  });

  it('should sanitize dangerous attributes and javascript URLs while preserving safe attributes', () => {
    const sanitized = service.sanitize(
      `<div class="card">
        <a href="https://example.com" title="Link" target="_blank" onclick="evil()">Open</a>
        <img src="cover.png" alt="Cover" onerror="evil()" />
      </div>`
    );

    expect(sanitized).toContain('class="card"');
    expect(sanitized).toContain('href="https://example.com"');
    expect(sanitized).toContain('title="Link"');
    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain('src="cover.png"');
    expect(sanitized).toContain('alt="Cover"');
    expect(sanitized).not.toContain('onclick=');
    expect(sanitized).not.toContain('onerror=');
  });

  it('should support attribute maps without relying on invalid DOMPurify ALLOWED_ATTR usage', () => {
    const sanitized = service.sanitize(
      `<a href="javascript:alert('xss')" rel="nofollow">Link</a>`,
      {
        allowedTags: ['a'],
        allowedAttributes: {
          a: ['href', 'rel'],
        },
      }
    );

    expect(sanitized).toContain('rel="nofollow"');
    expect(sanitized).not.toContain('javascript:alert');
  });
});
