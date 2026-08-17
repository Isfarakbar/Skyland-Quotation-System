import { describe, expect, test } from 'vitest';
import { pageResult } from './api';

describe('pageResult', () => {
  test('keeps paginated server responses', () => {
    const result = pageResult({ items: [{ id: 1 }], meta: { page: 2, limit: 1, total: 3, pages: 3 } });
    expect(result.meta.page).toBe(2);
  });

  test('adapts legacy arrays during the staged rollout', () => {
    const result = pageResult([{ id: 1 }, { id: 2 }]);
    expect(result.meta.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });
});
