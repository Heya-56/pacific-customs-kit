// French Polynesia (PF) customs profile.
//
// Figures marked verified:true come from the official customs FAQ of the Direction régionale des douanes de
// Polynésie française (service-public.pf, page updated 3 Feb 2025). Tariff-line duty rates and product-specific taxes
// (TDL, TCP, alcohol, tobacco and fuel taxes...) depend on the exact tariff line: they are not guessed here.

const FAQ = 'https://www.service-public.pf/douane/faq/';
const TAX_LIST = 'https://www.service-public.pf/douane/professionnels/la-fiscalite-douaniere/les-droits-et-taxes-applicables/';
const SIMULATOR = 'https://simulateur-douane-polynesie.com';
const TARIFF_PDF = 'https://www.service-public.pf/douane/wp-content/uploads/sites/18/2024/12/Tarif-des-douanes-2025-01.pdf';
const TARIFF_2026 = 'Tarif des douanes de Polynésie française (TAPA), extract dated 1 January 2026, published by the Direction régionale des douanes de Polynésie française on its website (service-public.pf/douane)';

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

  // Official tariff ("Taux de taxation et assiettes"): ad valorem taxes are a share of the CAF value; TDL is charged on
  // CAF + customs duty; VAT is charged on CAF + all duties and taxes EXCEPT TDL + landing costs (frais de débarquement).
  valuation: {
    basis: 'CIF (CAF)',
    vatBase: 'CIF + all duties and taxes except TDL + landing costs',
    source: TARIFF_PDF,
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

  // Charges in the order they are computed (definitions: official tariff, section "Taux de taxation et assiettes").
  // A tariff line (tariffLines below) can set its own duty, VAT, TEAP rate, TEEI, TDL and statistical-tax unit.
  charges: [
    { code: 'customs_duty', name: 'Customs duty (DD)', kind: 'tariff', tariffKey: 'duty' },
    { code: 'tdl', name: 'Local development tax (TDL)', kind: 'line_only', lineKey: 'tdl', base: 'cif_plus_duty', inVatBase: false, source: TARIFF_PDF, verified: true, note: '2% to 82% depending on the tariff line; charged on CIF + customs duty; not part of the VAT base.' },
    { code: 'teap', name: 'Environment, agriculture and fisheries tax (TEAP)', kind: 'ad_valorem', rate: 0.02, lineKey: 'teap', source: TARIFF_PDF, verified: true, note: '2% or 10% of CIF depending on the tariff line; some lines have none.' },
    { code: 'teei', name: 'Imported electrical equipment tax (TEEI)', kind: 'line_only', lineKey: 'teei', base: 'cif', source: TARIFF_PDF, verified: true },
    { code: 'toll', name: 'Papeete port toll (PEAGE)', kind: 'ad_valorem', rate: 0.0125, modes: ['sea'], source: TARIFF_PDF, verified: true },
    { code: 'setil', name: "Faa'a freight station fee (SETIL)", kind: 'per_kg', amount: 4.972, minimum: 45, modes: ['air'], source: TARIFF_PDF, verified: true, note: '4.972 XPF per net kg, minimum 45 XPF; air freight through the Faa\'a freight station.' },
    { code: 'statistical_tax', name: 'Statistical tax (TS)', kind: 'per_weight_unit', amount: 50, unitKg: 100, lineKey: 'tsUnitKg', source: TARIFF_PDF, verified: true, note: '50 XPF per 100 kg net (QU) or per metric tonne (TM) depending on the line; a started unit counts in full.' },
    { code: 'pid', name: 'Customs IT participation (PID)', kind: 'per_line', amount: 85, source: TARIFF_PDF, verified: true, note: '85 XPF per declaration item.' },
    { code: 'vat', name: 'VAT (TVA)', kind: 'vat' },
  ],

  // Tariff lines copied from the official tariff (DD standard / reduced rate, VAT, other taxes). The reduced customs
  // duty depends on origin (the tariff says "suivant origine"); which origins qualify must be confirmed per case.
  tariffLines: {
    source: TARIFF_2026,
    edition: '2026-01-01',
    verified: true,
    lines: {
      '09051000': { description: 'Vanilla, neither crushed nor ground', duty: 0.06, dutyReduced: 0.06, vat: 0.05, teap: 0.02, tsUnitKg: 100 },
      '15131100': { description: 'Coconut (copra) oil, crude', duty: 0.13, dutyReduced: 0.06, vat: 0.16, teap: 0.02, tsUnitKg: 1000 },
      '15131910': { description: 'Coconut oil, virgin', duty: 0.13, dutyReduced: 0.06, vat: 0.16, teap: 0.02, tsUnitKg: 1000 },
      '33049910': { description: 'Monoi-type preparations', duty: 0.13, dutyReduced: 0.06, vat: 0.16, teap: 0.02, tsUnitKg: 100 },
      '33049929': { description: 'Monoi de Tahiti (appellation of origin), packaged', duty: 0.15, dutyReduced: 0.06, vat: 0.16, teap: 0.02, tdl: 0.37, tsUnitKg: 100 },
      '48193000': { description: 'Paper sacks and bags, base width 40 cm or more', duty: 0.06, dutyReduced: 0.04, vat: 0.16, teap: 0, tsUnitKg: 100 },
      '48194000': { description: 'Other paper sacks and bags', duty: 0.06, dutyReduced: 0.04, vat: 0.16, teap: 0, tsUnitKg: 100 },
      '70109000': { description: 'Glass bottles, flasks, jars and similar containers', duty: 0.13, dutyReduced: 0.06, vat: 0.16, teap: 0.02, teei: 0.01, tsUnitKg: 100 },
    },
  },
  productSpecificTaxes: 'Other product-specific taxes (TCP, alcohol, tobacco, fuel...) apply to some tariff lines only. Pass them as extraRates when known.',

  offices: [
    { id: 'papeete-port', name: 'Papeete port', mode: 'sea', unlocode: 'PFPPT', island: 'Tahiti' },
    { id: 'faaa-airport', name: "Tahiti Faa'a airport freight station", mode: 'air', unlocode: null, island: 'Tahiti' },
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
