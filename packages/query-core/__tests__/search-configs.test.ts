import { describe, it, expect } from 'vitest';
import { SEARCH_CONFIGS } from '../src/search/search-configs';

describe('SEARCH_CONFIGS', () => {
  it('is an object', () => {
    expect(typeof SEARCH_CONFIGS).toBe('object');
    expect(SEARCH_CONFIGS).not.toBeNull();
  });

  it('has Q_USER, TTT_USER, and TTT_PROJECT keys', () => {
    expect(SEARCH_CONFIGS).toHaveProperty('Q_USER');
    expect(SEARCH_CONFIGS).toHaveProperty('TTT_USER');
    expect(SEARCH_CONFIGS).toHaveProperty('TTT_PROJECT');
  });

  describe('Q_USER config', () => {
    it('has required fields', () => {
      expect(SEARCH_CONFIGS.Q_USER.collectionPath).toBeDefined();
      expect(SEARCH_CONFIGS.Q_USER.searchField).toBeDefined();
      expect(SEARCH_CONFIGS.Q_USER.limit).toBeDefined();
    });

    it('uses users collection', () => {
      expect(SEARCH_CONFIGS.Q_USER.collectionPath).toBe('users');
    });

    it('searches by displayName_lowercase', () => {
      expect(SEARCH_CONFIGS.Q_USER.searchField).toBe('displayName_lowercase');
    });

    it('has limit of 5', () => {
      expect(SEARCH_CONFIGS.Q_USER.limit).toBe(5);
    });
  });

  describe('TTT_USER config', () => {
    it('has required fields', () => {
      expect(SEARCH_CONFIGS.TTT_USER.collectionPath).toBeDefined();
      expect(SEARCH_CONFIGS.TTT_USER.searchField).toBeDefined();
      expect(SEARCH_CONFIGS.TTT_USER.limit).toBeDefined();
    });

    it('uses userProfiles collection', () => {
      expect(SEARCH_CONFIGS.TTT_USER.collectionPath).toBe('userProfiles');
    });

    it('searches by username', () => {
      expect(SEARCH_CONFIGS.TTT_USER.searchField).toBe('username');
    });

    it('has limit of 6', () => {
      expect(SEARCH_CONFIGS.TTT_USER.limit).toBe(6);
    });
  });

  describe('TTT_PROJECT config', () => {
    it('has required fields', () => {
      expect(SEARCH_CONFIGS.TTT_PROJECT.collectionPath).toBeDefined();
      expect(SEARCH_CONFIGS.TTT_PROJECT.searchField).toBeDefined();
      expect(SEARCH_CONFIGS.TTT_PROJECT.limit).toBeDefined();
    });

    it('uses allProjects collection', () => {
      expect(SEARCH_CONFIGS.TTT_PROJECT.collectionPath).toBe('allProjects');
    });

    it('searches by workingTitle', () => {
      expect(SEARCH_CONFIGS.TTT_PROJECT.searchField).toBe('workingTitle');
    });

    it('has limit of 6', () => {
      expect(SEARCH_CONFIGS.TTT_PROJECT.limit).toBe(6);
    });
  });

  it('all configs have positive limit values', () => {
    for (const config of Object.values(SEARCH_CONFIGS)) {
      expect(config.limit).toBeGreaterThan(0);
    }
  });

  it('all configs have non-empty collectionPath', () => {
    for (const config of Object.values(SEARCH_CONFIGS)) {
      expect(config.collectionPath.length).toBeGreaterThan(0);
    }
  });

  it('all configs have non-empty searchField', () => {
    for (const config of Object.values(SEARCH_CONFIGS)) {
      expect(config.searchField.length).toBeGreaterThan(0);
    }
  });
});
