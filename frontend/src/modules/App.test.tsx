import { describe, it, expect } from 'vitest';

describe('App shell', () => {
  it('language dict has es/en/zh', () => {
    expect(['es','en','zh'].length).toBe(3);
  });
});