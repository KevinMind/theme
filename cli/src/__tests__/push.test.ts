import { describe, expect, test } from 'bun:test';
import {
  findPlaceholders,
  getAtPath,
  setAtPath,
  sanitizeWithTemplate,
} from '../core/push';

describe('findPlaceholders', () => {
  test('finds placeholders in simple object', () => {
    const obj = {
      token: '${MY_TOKEN}',
      name: 'test',
    };

    const result = findPlaceholders(obj);

    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(['token']);
    expect(result[0].placeholder).toBe('${MY_TOKEN}');
  });

  test('finds placeholders in nested object', () => {
    const obj = {
      config: {
        auth: {
          token: '${AUTH_TOKEN}',
        },
      },
    };

    const result = findPlaceholders(obj);

    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(['config', 'auth', 'token']);
  });

  test('finds multiple placeholders', () => {
    const obj = {
      token1: '${TOKEN_A}',
      nested: {
        token2: '${TOKEN_B}',
      },
    };

    const result = findPlaceholders(obj);

    expect(result).toHaveLength(2);
  });

  test('finds placeholders with prefix text', () => {
    const obj = {
      auth: 'Bearer ${MY_TOKEN}',
    };

    const result = findPlaceholders(obj);

    expect(result).toHaveLength(1);
    expect(result[0].placeholder).toBe('Bearer ${MY_TOKEN}');
  });

  test('ignores non-placeholder strings', () => {
    const obj = {
      name: 'regular string',
      count: 42,
      enabled: true,
    };

    const result = findPlaceholders(obj);

    expect(result).toHaveLength(0);
  });

  test('finds placeholders in arrays', () => {
    const obj = {
      items: ['${ITEM_1}', 'regular', '${ITEM_2}'],
    };

    const result = findPlaceholders(obj);

    expect(result).toHaveLength(2);
    expect(result[0].path).toEqual(['items', '0']);
    expect(result[1].path).toEqual(['items', '2']);
  });
});

describe('getAtPath', () => {
  test('gets value at simple path', () => {
    const obj = { a: 'value' };
    expect(getAtPath(obj, ['a'])).toBe('value');
  });

  test('gets value at nested path', () => {
    const obj = { a: { b: { c: 'deep' } } };
    expect(getAtPath(obj, ['a', 'b', 'c'])).toBe('deep');
  });

  test('returns undefined for missing path', () => {
    const obj = { a: 'value' };
    expect(getAtPath(obj, ['b'])).toBeUndefined();
  });

  test('gets value from array', () => {
    const obj = { items: ['a', 'b', 'c'] };
    expect(getAtPath(obj, ['items', '1'])).toBe('b');
  });
});

describe('setAtPath', () => {
  test('sets value at simple path', () => {
    const obj = { a: 'old' };
    setAtPath(obj, ['a'], 'new');
    expect(obj.a).toBe('new');
  });

  test('sets value at nested path', () => {
    const obj = { a: { b: { c: 'old' } } };
    setAtPath(obj, ['a', 'b', 'c'], 'new');
    expect((obj.a.b as any).c).toBe('new');
  });

  test('sets value in array', () => {
    const obj = { items: ['a', 'b', 'c'] };
    setAtPath(obj, ['items', '1'], 'new');
    expect(obj.items[1]).toBe('new');
  });
});

describe('sanitizeWithTemplate', () => {
  test('replaces token with placeholder', () => {
    const template = JSON.stringify({
      auth: { token: '${MY_TOKEN}' },
    });
    const local = JSON.stringify({
      auth: { token: 'actual-secret-token-12345' },
    });

    const { sanitized, replacements } = sanitizeWithTemplate(local, template);
    const result = JSON.parse(sanitized);

    expect(result.auth.token).toBe('${MY_TOKEN}');
    expect(replacements).toHaveLength(1);
  });

  test('preserves non-placeholder values', () => {
    const template = JSON.stringify({
      name: 'app',
      auth: { token: '${MY_TOKEN}' },
    });
    const local = JSON.stringify({
      name: 'my-app',
      auth: { token: 'secret' },
    });

    const { sanitized } = sanitizeWithTemplate(local, template);
    const result = JSON.parse(sanitized);

    expect(result.name).toBe('my-app'); // Not a placeholder, kept as-is
    expect(result.auth.token).toBe('${MY_TOKEN}'); // Placeholder restored
  });

  test('handles Bearer token prefix', () => {
    const template = JSON.stringify({
      headers: { Authorization: 'Bearer ${GITHUB_TOKEN}' },
    });
    const local = JSON.stringify({
      headers: { Authorization: 'Bearer ghp_abc123xyz' },
    });

    const { sanitized } = sanitizeWithTemplate(local, template);
    const result = JSON.parse(sanitized);

    expect(result.headers.Authorization).toBe('Bearer ${GITHUB_TOKEN}');
  });

  test('handles multiple placeholders', () => {
    const template = JSON.stringify({
      token1: '${TOKEN_A}',
      nested: { token2: '${TOKEN_B}' },
    });
    const local = JSON.stringify({
      token1: 'secret-a',
      nested: { token2: 'secret-b' },
    });

    const { sanitized, replacements } = sanitizeWithTemplate(local, template);
    const result = JSON.parse(sanitized);

    expect(result.token1).toBe('${TOKEN_A}');
    expect(result.nested.token2).toBe('${TOKEN_B}');
    expect(replacements).toHaveLength(2);
  });

  test('skips already-placeholder values', () => {
    const template = JSON.stringify({
      token: '${MY_TOKEN}',
    });
    const local = JSON.stringify({
      token: '${MY_TOKEN}', // Already a placeholder
    });

    const { replacements } = sanitizeWithTemplate(local, template);

    expect(replacements).toHaveLength(0);
  });

  test('returns original content for non-JSON', () => {
    const template = 'not json';
    const local = 'also not json';

    const { sanitized, replacements } = sanitizeWithTemplate(local, template);

    expect(sanitized).toBe(local);
    expect(replacements).toHaveLength(0);
  });

  test('handles extra fields in local that are not in template', () => {
    const template = JSON.stringify({
      token: '${MY_TOKEN}',
    });
    const local = JSON.stringify({
      token: 'secret',
      extraField: 'should be preserved',
      nested: { data: 'also preserved' },
    });

    const { sanitized } = sanitizeWithTemplate(local, template);
    const result = JSON.parse(sanitized);

    expect(result.token).toBe('${MY_TOKEN}');
    expect(result.extraField).toBe('should be preserved');
    expect(result.nested.data).toBe('also preserved');
  });

  test('handles missing fields in local that are in template', () => {
    const template = JSON.stringify({
      token: '${MY_TOKEN}',
      other: '${OTHER}',
    });
    const local = JSON.stringify({
      token: 'secret',
      // 'other' is missing
    });

    const { sanitized, replacements } = sanitizeWithTemplate(local, template);
    const result = JSON.parse(sanitized);

    expect(result.token).toBe('${MY_TOKEN}');
    expect(result.other).toBeUndefined();
    expect(replacements).toHaveLength(1); // Only token was replaced
  });
});
