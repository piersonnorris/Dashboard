import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DASHBOARD_DEMO_DATA as data } from '../app/demo-data.js';
import { signedPercent } from '../app/formatters.js';
import {
  PRIVACY_MASK,
  displaySensitiveValue,
  redactCurrencyText,
  tokenizeCurrencyText,
} from '../app/privacy.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('dashboard demo data', () => {
  test('is explicitly synthetic and its balance sheet reconciles', () => {
    assert.equal(data.meta.classification, 'synthetic-demo');
    assert.match(data.meta.disclosure, /fictional demo data/i);
    assert.equal(data.summary.assets - data.summary.liabilities, data.summary.netWorth);
    assert.equal(data.accounts.reduce((sum, account) => sum + account.balance, 0), data.summary.netWorth);
  });

  test('holdings and allocation reconcile to invested assets', () => {
    assert.equal(data.holdings.reduce((sum, holding) => sum + holding.value, 0), data.summary.invested);
    assert.equal(data.allocation.reduce((sum, group) => sum + group.value, 0), data.summary.invested);
    assert.ok(Math.abs(data.holdings.reduce((sum, holding) => sum + holding.portfolioWeight, 0) - 100) < 0.01);
  });
});

describe('privacy presentation', () => {
  test('redacts every currency token in an attention narrative', () => {
    const narrative = data.attention.find((item) => item.detail.includes('$')).detail;
    const tokens = tokenizeCurrencyText(narrative);
    assert.deepEqual(tokens.filter((token) => token.sensitive).map((token) => token.value), ['$15,800', '$18,000']);
    const redacted = redactCurrencyText(narrative, true);
    assert.equal(redacted.includes('$'), false);
    assert.equal(redacted.match(new RegExp(PRIVACY_MASK, 'g')).length, 2);
    assert.equal(redactCurrencyText(narrative, false), narrative);
    assert.equal(displaySensitiveValue('$84,010', true), PRIVACY_MASK);
  });

  test('does not turn missing percentage evidence into zero', () => {
    assert.equal(signedPercent(null), '—');
    assert.equal(signedPercent(undefined), '—');
    assert.equal(signedPercent(Number.NaN), '—');
    assert.equal(signedPercent(0), '+0.00%');
    assert.equal(signedPercent(-0.26), '-0.26%');
  });
});

test('the deny-by-default ignore policy rejects an unapproved app data file', () => {
  const result = spawnSync('git', ['check-ignore', '--no-index', 'app/real-balances.json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /app\/real-balances\.json|app\\real-balances\.json/);
});
