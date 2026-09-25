export function signedPercent(value) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
}
