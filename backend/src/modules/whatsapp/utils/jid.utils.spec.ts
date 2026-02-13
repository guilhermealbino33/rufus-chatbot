import {
  normalizeJid,
  extractPhoneFromJid,
  isLidJid,
  extractPhoneFromFormattedName,
  resolveJid,
} from './jid.utils';

describe('JID Utils', () => {
  describe('normalizeJid', () => {
    it('should preserve @lid format', () => {
      expect(normalizeJid('257431800180973@lid')).toBe('257431800180973@lid');
    });

    it('should preserve @c.us format', () => {
      expect(normalizeJid('5548991426316@c.us')).toBe('5548991426316@c.us');
    });

    it('should convert pure number to @c.us', () => {
      expect(normalizeJid('5548991426316')).toBe('5548991426316@c.us');
    });

    it('should handle number with spaces and dashes', () => {
      expect(normalizeJid('+55 48 9914-26316')).toBe('5548991426316@c.us');
    });

    it('should preserve @g.us format (groups)', () => {
      expect(normalizeJid('123456789@g.us')).toBe('123456789@g.us');
    });

    it('should throw error for empty input', () => {
      expect(() => normalizeJid('')).toThrow('JID input cannot be empty');
    });

    it('should throw error for invalid short number', () => {
      expect(() => normalizeJid('123')).toThrow('Invalid JID format');
    });
  });

  describe('extractPhoneFromJid', () => {
    it('should extract phone from @c.us JID', () => {
      expect(extractPhoneFromJid('5548991426316@c.us')).toBe('5548991426316');
    });

    it('should extract phone from @lid JID', () => {
      expect(extractPhoneFromJid('257431800180973@lid')).toBe('257431800180973');
    });

    it('should extract phone from @g.us JID', () => {
      expect(extractPhoneFromJid('123456789012@g.us')).toBe('123456789012');
    });

    it('should return null for empty input', () => {
      expect(extractPhoneFromJid('')).toBeNull();
    });

    it('should return null for short number', () => {
      expect(extractPhoneFromJid('123@c.us')).toBeNull();
    });
  });

  describe('isLidJid', () => {
    it('should return true for @lid JID', () => {
      expect(isLidJid('257431800180973@lid')).toBe(true);
    });

    it('should return false for @c.us JID', () => {
      expect(isLidJid('5548991426316@c.us')).toBe(false);
    });

    it('should return false for pure number', () => {
      expect(isLidJid('5548991426316')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isLidJid(null as any)).toBe(false);
      expect(isLidJid(undefined as any)).toBe(false);
    });
  });

  describe('extractPhoneFromFormattedName', () => {
    it('should extract from Brazilian format with spaces and dash', () => {
      expect(extractPhoneFromFormattedName('+55 48 9142-6316')).toBe('554891426316');
    });

    it('should extract from format with parentheses', () => {
      expect(extractPhoneFromFormattedName('+55 (48) 99142-6316')).toBe('5548991426316');
    });

    it('should extract from format without special chars', () => {
      expect(extractPhoneFromFormattedName('5548991426316')).toBe('5548991426316');
    });

    it('should return null for non-phone text', () => {
      expect(extractPhoneFromFormattedName('John Doe')).toBeNull();
    });

    it('should return null for empty input', () => {
      expect(extractPhoneFromFormattedName('')).toBeNull();
    });

    it('should return null for short number', () => {
      expect(extractPhoneFromFormattedName('123')).toBeNull();
    });
  });

  describe('resolveJid', () => {
    it('should use primary JID when available', () => {
      expect(resolveJid('257431800180973@lid')).toBe('257431800180973@lid');
    });

    it('should fall back to phone number', () => {
      expect(resolveJid(undefined, '5548991426316')).toBe('5548991426316@c.us');
    });

    it('should fall back to formatted name', () => {
      expect(resolveJid(undefined, undefined, '+55 48 9142-6316')).toBe('554891426316@c.us');
    });

    it('should prefer primary JID over fallbacks', () => {
      expect(resolveJid('257431800180973@lid', '5548991426316', '+55 48 9142-6316')).toBe(
        '257431800180973@lid',
      );
    });

    it('should throw error when all inputs are invalid', () => {
      expect(() => resolveJid()).toThrow('Unable to resolve JID from provided inputs');
    });

    it('should throw error when all inputs are empty', () => {
      expect(() => resolveJid('', '', '')).toThrow('Unable to resolve JID from provided inputs');
    });
  });
});
