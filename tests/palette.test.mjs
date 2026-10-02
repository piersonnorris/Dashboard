/* Market colors (app/palette.js): the three choices, the saved preference,
   and the promise in the file's own header — every color reads at AA on the
   surfaces it is drawn on. The contrast is recomputed here from the hexes,
   so a later tweak to a color cannot quietly drop below 4.5:1. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = fs.readFileSync(path.join(HERE, '..', 'app', 'palette.js'), 'utf8');
const CSS = fs.readFileSync(path.join(HERE, '..', 'app', 'styles.css'), 'utf8');

/* Run palette.js in a fresh window with a fake <html> and storage. */
function boot({ stored = null, storageThrows = false } = {}) {
  const attrs = {};
  const store = new Map(stored === null ? [] : [['dashboard.marketPalette', stored]]);
  const localStorage = {
    getItem(k) { if (storageThrows) throw new Error('blocked'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { if (storageThrows) throw new Error('blocked'); store.set(k, String(v)); }
  };
  const window = {
    localStorage,
    document: { documentElement: { setAttribute(k, v) { attrs[k] = v; } } }
  };
  vm.runInNewContext(SOURCE, { window, globalThis: window });
  return { P: window.DashboardPalette, attrs, store };
}

/* WCAG relative luminance and contrast. */
const rgb = (hex) => hex.replace('#', '').match(/\w\w/g).map((x) => parseInt(x, 16));
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, bg, alpha) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

test('offers exactly the three palettes asked for', () => {
  const { P } = boot();
  /* Array.from: the sandbox array is from another realm, which deepEqual rejects */
  const pairs = Array.from(P.PALETTES, (p) => `${p.bull.label}/${p.bear.label}`);
  assert.deepEqual(pairs, ['Green/Red', 'Orange/Blue', 'Pink/Blue']);
});

test('applies the default before anything is saved', () => {
  const { attrs } = boot();
  assert.equal(attrs['data-market'], 'classic');
});

test('a saved choice is applied on boot — before the page paints', () => {
  const { attrs } = boot({ stored: 'ember' });
  assert.equal(attrs['data-market'], 'ember');
});

test('save then load round-trips, and apply sets the attribute', () => {
  const { P, attrs, store } = boot();
  assert.equal(P.save('bloom'), true);
  assert.equal(store.get('dashboard.marketPalette'), 'bloom');
  assert.equal(P.load(), 'bloom');
  assert.equal(P.apply('bloom').id, 'bloom');
  assert.equal(attrs['data-market'], 'bloom');
});

test('an unknown or tampered value falls back to the default', () => {
  const { attrs, P } = boot({ stored: '<script>' });
  assert.equal(attrs['data-market'], 'classic');
  assert.equal(P.save('neon'), false, 'refuses to store a palette that does not exist');
  assert.equal(P.apply('neon').id, 'classic');
});

test('blocked storage never breaks the page', () => {
  const { P, attrs } = boot({ storageThrows: true });
  assert.equal(attrs['data-market'], 'classic');
  assert.equal(P.load(), 'classic');
  assert.equal(P.save('ember'), false, 'reports that it could not remember');
});

test('every palette color is AA on the card surface and on its own badge', () => {
  const { P } = boot();
  const surface = rgb('#111420');
  for (const p of P.PALETTES) {
    for (const side of ['bull', 'bear']) {
      const c = rgb(p[side].hex);
      const onCard = contrast(c, surface);
      const onBadge = contrast(c, mix(c, surface, 0.12));
      assert.ok(onCard >= 4.5, `${p.name} ${side} on card: ${onCard.toFixed(2)}:1`);
      assert.ok(onBadge >= 4.5, `${p.name} ${side} on its badge: ${onBadge.toFixed(2)}:1`);
    }
  }
});

test('the stylesheet carries the same hexes as palette.js', () => {
  const { P } = boot();
  for (const p of P.PALETTES) {
    const block = p.id === 'classic'
      ? CSS.slice(0, CSS.indexOf(':root[data-market='))
      : CSS.slice(CSS.indexOf(`:root[data-market="${p.id}"]`)).split('}')[0];
    assert.ok(block.toLowerCase().includes(p.bull.hex), `${p.id} bull ${p.bull.hex} in styles.css`);
    assert.ok(block.toLowerCase().includes(p.bear.hex), `${p.id} bear ${p.bear.hex} in styles.css`);
  }
});

test('status green is its own token, untouched by the palette', () => {
  for (const id of ['ember', 'bloom']) {
    const block = CSS.slice(CSS.indexOf(`:root[data-market="${id}"]`)).split('}')[0];
    assert.doesNotMatch(block, /--ok\b/, `${id} must not recolor status`);
  }
  assert.match(CSS, /\.status-pill[^}]*color: var\(--ok\)/);
});

test('nothing in the stylesheet is set below 11px', () => {
  const tiny = [...CSS.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => +m[1]).filter((n) => n < 11);
  assert.deepEqual(tiny, []);
});
