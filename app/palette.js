/* Market colors — which hue means "up" and which means "down".

   Loaded as a classic, blocking script in <head>, before styles.css paints,
   so a saved choice is on <html> before the first frame: no flash of the
   default greens before the page switches. The CSP allows only 'self'
   scripts, which is why this is a file and not an inline snippet.

   The palette only changes MARKET direction — price moves, sparklines,
   gains and losses. Status colors ("On track", the online dot) keep their
   own fixed green: an orange "On track" would read as a warning.

   Every color here is AA (4.5:1) on the card surface and on its own tinted
   badge; the contrast was measured, not eyeballed. Direction is never shown
   by color alone — values keep their + / − sign and the chart its arrow. */
(function (global) {
  'use strict';

  var KEY = 'dashboard.marketPalette';

  var PALETTES = [
    {
      id: 'classic',
      name: 'Classic',
      bull: { label: 'Green', hex: '#3fd68f' },
      bear: { label: 'Red', hex: '#ff6b7a' },
      note: 'The market default. Hard to tell apart with red–green color blindness.'
    },
    {
      id: 'ember',
      name: 'Ember',
      bull: { label: 'Orange', hex: '#ff9a3d' },
      bear: { label: 'Blue', hex: '#5b9dff' },
      note: 'Warm up, cool down. Readable with the common forms of color blindness.'
    },
    {
      id: 'bloom',
      name: 'Bloom',
      bull: { label: 'Pink', hex: '#ff78b9' },
      bear: { label: 'Blue', hex: '#5b9dff' },
      note: 'Pink up, blue down. Also color-blind friendly.'
    }
  ];
  var DEFAULT = 'classic';

  function find(id) {
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return PALETTES[i];
    return null;
  }

  /* Storage can throw (private windows, blocked site data) — a missing
     preference just means the default, never a broken page. */
  function load() {
    try {
      var saved = global.localStorage.getItem(KEY);
      return find(saved) ? saved : DEFAULT;
    } catch (e) {
      return DEFAULT;
    }
  }

  function save(id) {
    if (!find(id)) return false;
    try { global.localStorage.setItem(KEY, id); return true; } catch (e) { return false; }
  }

  function apply(id) {
    var palette = find(id) || find(DEFAULT);
    var root = global.document && global.document.documentElement;
    if (root) root.setAttribute('data-market', palette.id);
    return palette;
  }

  global.DashboardPalette = {
    PALETTES: PALETTES,
    DEFAULT: DEFAULT,
    KEY: KEY,
    find: find,
    load: load,
    save: save,
    apply: apply
  };

  apply(load());
})(typeof window !== 'undefined' ? window : globalThis);
