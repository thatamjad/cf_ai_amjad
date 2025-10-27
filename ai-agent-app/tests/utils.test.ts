import { describe, it, expect } from 'vitest';
import { generateId, truncate, estimateTokenCount, sanitizeInput } from '../src/utils/helpers';

describe('Utility Functions', () => {
  describe('generateId', () => {
    it('should generate a unique ID', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      const text = 'This is a very long text that needs to be truncated';
      const result = truncate(text, 20);

      expect(result).toBe('This is a very lo...');
      expect(result.length).toBe(20);
    });

    it('should not truncate short text', () => {
      const text = 'Short text';
      const result = truncate(text, 20);

      expect(result).toBe(text);
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count', () => {
      const text = 'Hello, world!';
      const tokens = estimateTokenCount(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeInput(input);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeInput(input);

      expect(result).toBe('Hello World');
    });
  });
});
