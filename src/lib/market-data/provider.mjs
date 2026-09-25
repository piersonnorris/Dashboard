/* The provider seam. BLUEPRINT §11: application features talk to this shape,
   never to a vendor, so swapping Twelve Data for something else is one file.

   Chunk 1 needs quotes only. The rest of the interface is declared and throws,
   so an accidental call fails loudly instead of silently returning nothing.

   @typedef {object} Quote
   @property {boolean} ok            false when the provider had no answer
   @property {string}  symbol
   @property {number|null} price     last / close
   @property {number|null} previousClose
   @property {number|null} change    absolute, price - previousClose
   @property {number|null} percentChange
   @property {string|null} name
   @property {string|null} exchange
   @property {string|null} asOf      ISO 8601, provider's own timestamp
   @property {string|null} error     set when ok is false

   @typedef {object} MarketDataProvider
   @property {string} id
   @property {(symbols: string[]) => Promise<Record<string, Quote>>} getQuotes
*/

export class NotImplemented extends Error {
  constructor(method) {
    super(`${method} is not implemented in chunk 1`);
    this.name = 'NotImplemented';
  }
}

export function missing(symbol, error) {
  return {
    ok: false,
    symbol,
    price: null,
    previousClose: null,
    change: null,
    percentChange: null,
    name: null,
    exchange: null,
    asOf: null,
    error: String(error || 'no quote returned')
  };
}

export const unimplemented = {
  getBars() { throw new NotImplemented('getBars'); },
  getCorporateActions() { throw new NotImplemented('getCorporateActions'); },
  getFxRate() { throw new NotImplemented('getFxRate'); },
  searchSecurities() { throw new NotImplemented('searchSecurities'); }
};
