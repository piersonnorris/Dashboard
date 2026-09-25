export const PRIVACY_MASK = '••••••';

const CURRENCY_TOKEN = /\$\d[\d,]*(?:\.\d{2})?/g;

export function tokenizeCurrencyText(value) {
  const text = String(value ?? '');
  const tokens = [];
  let cursor = 0;

  for (const match of text.matchAll(CURRENCY_TOKEN)) {
    if (match.index > cursor) {
      tokens.push({ sensitive: false, value: text.slice(cursor, match.index) });
    }
    tokens.push({ sensitive: true, value: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    tokens.push({ sensitive: false, value: text.slice(cursor) });
  }

  return tokens;
}

export function redactCurrencyText(value, privacyEnabled, mask = PRIVACY_MASK) {
  return tokenizeCurrencyText(value)
    .map((token) => token.sensitive && privacyEnabled ? mask : token.value)
    .join('');
}

export function displaySensitiveValue(value, privacyEnabled, mask = PRIVACY_MASK) {
  return privacyEnabled ? mask : String(value ?? '');
}
