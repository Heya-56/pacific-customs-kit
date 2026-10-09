// French Polynesia (PF) customs profile.
//
// Figures marked verified:true come from the official customs FAQ of the Direction régionale des douanes de
// Polynésie française (service-public.pf, page updated 3 Feb 2025). Tariff-line duty rates and product-specific taxes
// (TDL, TCP, alcohol, tobacco and fuel taxes...) depend on the exact tariff line: they are not guessed here.

const FAQ = 'https://www.service-public.pf/douane/faq/';
const TAX_LIST = 'https://www.service-public.pf/douane/professionnels/la-fiscalite-douaniere/les-droits-et-taxes-applicables/';
const SIMULATOR = 'https://simulateur-douane-polynesie.com';

export const PF = {
  code: 'PF',
  name: 'French Polynesia',
  currency: 'XPF',
  currencyDecimals: 0, // the CFP franc has no subunit: amounts are rounded to the franc
  customsAuthority: 'Direction régionale des douanes de Polynésie française',
  customsSystem: 'SOFIX / FENIX',
  lodgement: {
    note: 'Declarations are lodged in the customs system (SOFIX / FENIX) by the importer or a customs agent (transitaire). This kit produces an estimate and checks documents; it does not lodge anything. Use the official customs simulator for a binding-quality estimate of a tariff line.',
    officialSimulator: SIMULATOR,
    source: TAX_LIST,
    verified: false, // system name from official pages; lodgement details to confirm with the customs service
  },

  vat: {
    rate: 0.16,
    label: 'standard rate',
    otherRates: 'A 5% rate applies to some goods (for example sailboats in the official FAQ); other reduced rates depend on the product.',
    source: FAQ,
    verified: true,
  },

  // Official FAQ: goods are valued CAF (coût, assurance, fret) to the point of entry; each duty is a percentage of CAF,
  // except VAT, which is charged on CAF + customs duty + the other taxes.
  valuation: {
    basis: 'CIF (CAF)',
    vatBase: 'CIF + customs duty + other taxes',
    source: FAQ,
    verified: true,
  },

  fx: {
    note: 'The CFP franc is pegged to the euro (1,000 XPF = 8.38 EUR). The USD rate floats: the default below is an indicative planning rate.',
    xpfPerEur: 119.33,
    indicativeXpfPerUsd: 110,
    verified: false,
  },

  duty: {
    verified: false,
    note: 'Customs duty (DD) depends on the tariff line and origin (the official FAQ shows 0%, 8% and 13% on different goods). These defaults are illustrative: check the line with the official customs simulator or a transitaire.',
    categories: {
      packaging:       { duty: 0.05 },
      food_raw:        { duty: 0 },
      cosmetic_inputs: { duty: 0.05 },
      craft_materials: { duty: 0.05 },
      general:         { duty: 0.10 },
    },
  },

  // Charges in the order they are computed. Ad valorem charges are a share of CIF; VAT is charged on CIF plus
  // every charge before it (official FAQ).
  charges: [
    { code: 'customs_duty', name: 'Customs duty (DD)', kind: 'tariff', tariffKey: 'duty' },
    { code: 'tea', name: 'Environment and agriculture tax (TEA)', kind: 'ad_valorem', rate: 0.02, source: FAQ, verified: true },
    { code: 'toll', name: 'Port / airport toll (péage)', kind: 'ad_valorem', rate: 0.0125, source: FAQ, verified: true, note: '1.25% of CIF "in most cases" (official FAQ).' },
    { code: 'statistical_tax', name: 'Statistical tax (TS)', kind: 'per_100kg', amount: 50, source: FAQ, verified: true, note: '50 XPF per 100 kg; needs the weight.' },
    { code: 'pid', name: 'Customs IT participation (PID)', kind: 'per_line', amount: 85, source: FAQ, verified: true, note: '85 XPF per article (line) of the declaration.' },
    { code: 'vat', name: 'VAT (TVA)', kind: 'vat' },
  ],
  productSpecificTaxes: 'TDL (local development tax), TCP, and taxes on alcohol, tobacco, fuel and electrical equipment apply to some tariff lines only. Pass them as extraRates when known.',

  offices: [
    { id: 'papeete-port', name: 'Papeete port', mode: 'sea', unlocode: 'PFPPT', island: 'Tahiti' },
    { id: 'faaa-airport', name: "Tahiti Faa'a airport (freight)", mode: 'air', unlocode: null, island: 'Tahiti' },
  ],

  lanes: {
    verified: false,
    note: 'Indicative transit times for planning; check the current carrier schedule.',
    items: [
      { from: 'NZAKL', fromName: 'Auckland', country: 'New Zealand', to: 'PFPPT', mode: 'sea', transitDays: 10 },
      { from: 'AUSYD', fromName: 'Sydney', country: 'Australia', to: 'PFPPT', mode: 'sea', transitDays: 16 },
      { from: 'CNSHA', fromName: 'Shanghai', country: 'China', to: 'PFPPT', mode: 'sea', transitDays: 30 },
      { from: 'USLAX', fromName: 'Los Angeles', country: 'United States', to: 'PFPPT', mode: 'sea', transitDays: 14 },
      { from: 'FRLEH', fromName: 'Le Havre', country: 'France', to: 'PFPPT', mode: 'sea', transitDays: 40 },
      { from: 'FJSUV', fromName: 'Suva', country: 'Fiji', to: 'PFPPT', mode: 'sea', transitDays: 12 },
      { from: 'NCNOU', fromName: 'Nouméa', country: 'New Caledonia', to: 'PFPPT', mode: 'sea', transitDays: 14 },
    ],
  },
};
