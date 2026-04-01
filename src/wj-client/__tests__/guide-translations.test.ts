/**
 * Tests for guide translation files.
 *
 * Verifies:
 * - Both vi and en guide.json files exist and are valid JSON
 * - Both files have the same set of top-level keys
 * - Required sections exist: title, subtitle, toc, homepage, investment, community
 */

import viGuideFile from '../messages/vi/guide.json';
import enGuideFile from '../messages/en/guide.json';

// Files are wrapped under the "guide" namespace key for next-intl support
const viGuide = (viGuideFile as any).guide as Record<string, unknown>;
const enGuide = (enGuideFile as any).guide as Record<string, unknown>;

describe('guide translation files', () => {
  describe('file existence and validity', () => {
    it('vi/guide.json is a non-null object', () => {
      expect(viGuideFile).toBeDefined();
      expect(typeof viGuideFile).toBe('object');
      expect(viGuideFile).not.toBeNull();
    });

    it('en/guide.json is a non-null object', () => {
      expect(enGuideFile).toBeDefined();
      expect(typeof enGuideFile).toBe('object');
      expect(enGuideFile).not.toBeNull();
    });
  });

  describe('required top-level keys', () => {
    const requiredKeys = ['title', 'subtitle', 'toc', 'homepage', 'investment', 'community'];

    requiredKeys.forEach((key) => {
      it(`vi/guide.json has top-level key: "${key}"`, () => {
        expect(viGuide).toHaveProperty(key);
      });

      it(`en/guide.json has top-level key: "${key}"`, () => {
        expect(enGuide).toHaveProperty(key);
      });
    });
  });

  describe('key parity between vi and en', () => {
    it('both files have the same top-level keys', () => {
      const viKeys = Object.keys(viGuide).sort();
      const enKeys = Object.keys(enGuide).sort();
      expect(viKeys).toEqual(enKeys);
    });

    it('toc section has the same keys in both locales', () => {
      const viTocKeys = Object.keys(viGuide.toc as Record<string, unknown>).sort();
      const enTocKeys = Object.keys(enGuide.toc as Record<string, unknown>).sort();
      expect(viTocKeys).toEqual(enTocKeys);
    });

    it('homepage section has the same keys in both locales', () => {
      const viKeys = Object.keys(viGuide.homepage as Record<string, unknown>).sort();
      const enKeys = Object.keys(enGuide.homepage as Record<string, unknown>).sort();
      expect(viKeys).toEqual(enKeys);
    });

    it('investment section has the same keys in both locales', () => {
      const viKeys = Object.keys(viGuide.investment as Record<string, unknown>).sort();
      const enKeys = Object.keys(enGuide.investment as Record<string, unknown>).sort();
      expect(viKeys).toEqual(enKeys);
    });

    it('community section has the same keys in both locales', () => {
      const viKeys = Object.keys(viGuide.community as Record<string, unknown>).sort();
      const enKeys = Object.keys(enGuide.community as Record<string, unknown>).sort();
      expect(viKeys).toEqual(enKeys);
    });
  });

  describe('toc sub-sections', () => {
    const expectedTocKeys = [
      'homepage',
      'netWorth',
      'wallets',
      'priceTables',
      'pnlTracking',
      'investment',
      'addingInvestments',
      'transactionTypes',
      'fifoAccounting',
      'goldSilver',
      'priceAlerts',
      'community',
      'creatingPosts',
      'interactions',
      'sentimentVoting',
    ];

    expectedTocKeys.forEach((key) => {
      it(`toc has key "${key}" in vi`, () => {
        expect(viGuide.toc).toHaveProperty(key);
      });

      it(`toc has key "${key}" in en`, () => {
        expect(enGuide.toc).toHaveProperty(key);
      });
    });
  });

  describe('homepage section sub-keys', () => {
    const expectedKeys = ['title', 'description', 'netWorth', 'wallets', 'priceTables', 'pnlTracking'];

    expectedKeys.forEach((key) => {
      it(`homepage has sub-key "${key}" in vi`, () => {
        expect(viGuide.homepage).toHaveProperty(key);
      });

      it(`homepage has sub-key "${key}" in en`, () => {
        expect(enGuide.homepage).toHaveProperty(key);
      });
    });
  });

  describe('investment section sub-keys', () => {
    const expectedKeys = [
      'title',
      'description',
      'addingInvestments',
      'transactionTypes',
      'fifoAccounting',
      'goldSilver',
      'priceAlerts',
    ];

    expectedKeys.forEach((key) => {
      it(`investment has sub-key "${key}" in vi`, () => {
        expect(viGuide.investment).toHaveProperty(key);
      });

      it(`investment has sub-key "${key}" in en`, () => {
        expect(enGuide.investment).toHaveProperty(key);
      });
    });
  });

  describe('community section sub-keys', () => {
    const expectedKeys = [
      'title',
      'description',
      'creatingPosts',
      'interactions',
      'sentimentVoting',
    ];

    expectedKeys.forEach((key) => {
      it(`community has sub-key "${key}" in vi`, () => {
        expect(viGuide.community).toHaveProperty(key);
      });

      it(`community has sub-key "${key}" in en`, () => {
        expect(enGuide.community).toHaveProperty(key);
      });
    });
  });

  describe('string values are non-empty', () => {
    it('vi title is a non-empty string', () => {
      expect(typeof viGuide.title).toBe('string');
      expect((viGuide.title as string).length).toBeGreaterThan(0);
    });

    it('en title is a non-empty string', () => {
      expect(typeof enGuide.title).toBe('string');
      expect((enGuide.title as string).length).toBeGreaterThan(0);
    });

    it('vi and en titles are different (localised)', () => {
      expect(viGuide.title).not.toEqual(enGuide.title);
    });
  });
});
