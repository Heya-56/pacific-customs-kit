// Fiji (FJ) customs profile.
//
// Every figure carries `verified` and a `source`. Only figures checked against an official FRCS page are
// marked verified:true. Everything else is an illustrative default that a licensed customs agent must
// confirm for the exact tariff line before use.

export const FJ = {
  code: 'FJ',
  name: 'Fiji',
  currency: 'FJD',
  currencyDecimals: 2,
  customsAuthority: 'Fiji Revenue and Customs Service (FRCS)',
  customsSystem: 'ASYCUDA World',
  lodgement: {
    // There is no public third-party API: the importer or its customs agent lodges the entry in ASYCUDA World.
    note: 'Declarations (SAD) are lodged in ASYCUDA World by the importer or a designated customs agent with a registered TIN. This kit produces a pre-filled draft for that person to review; it does not lodge anything.',
    requiredDocuments: ['Customs entry (SAD)', 'Commercial invoice', 'Bill of lading or air waybill', 'Packing list', 'Import permit (if applicable)', 'Tax Identification Number (TIN)'],
    source: 'https://frcs.org.fj/our-services/customs/trade-business/importers/import-procedure/',
    verified: true,
  },

  vat: {
    rate: 0.125,
    effectiveFrom: '2025-08-01',
    label: 'G',
    source: 'https://frcs.org.fj/public-notice/implementation-of-new-vat-tax-label-g-effective-1-august-2025/',
    verified: true,
  },

  // How FRCS computes import charges (official calculator page):
  //   VFD (value for duty) = CIF
  //   fiscal duty = VFD × fiscal rate ; import excise = VFD × excise rate
  //   VFV (value for VAT) = VFD + fiscal duty + import excise ; VAT = VFV × VAT rate
  valuation: {
    basis: 'CIF',
    vatBase: 'VFD + fiscal duty + import excise',
    source: 'https://frcs.org.fj/our-services/calculators/customs-charges-duties/',
    verified: true,
  },

  fx: {
    // FRCS converts foreign currency at the weekly ASYCUDA exchange rate: pass the rate of the week when you have it.
    note: 'FRCS uses weekly ASYCUDA exchange rates. The default below is an indicative planning rate only.',
    indicativeFjdPerUsd: 2.25,
    source: 'https://frcs.org.fj/our-services/calculators/customs-charges-duties/',
    verified: false,
  },

  // Illustrative fiscal-duty and excise rates by broad product category. The real rate depends on the exact
  // tariff line (Customs Tariff Act schedule), origin and any concession code.
  duty: {
    verified: false,
    note: 'Illustrative defaults — confirm the tariff line and rate in the current Fiji Customs Tariff with a licensed customs agent.',
    categories: {
      packaging:       { duty: 0.15, excise: 0 },
      food_raw:        { duty: 0.05, excise: 0 },
      cosmetic_inputs: { duty: 0.15, excise: 0 },
      craft_materials: { duty: 0.05, excise: 0 },
      general:         { duty: 0.15, excise: 0 },
    },
  },

  // Charges in the order FRCS computes them. "tariff" rates come from the tariff line (duty.categories or the caller);
  // VAT is charged on the value for duty plus every charge before it.
  charges: [
    { code: 'fiscal_duty', name: 'Fiscal duty', kind: 'tariff', tariffKey: 'duty' },
    { code: 'import_excise', name: 'Import excise', kind: 'tariff', tariffKey: 'excise' },
    { code: 'vat', name: 'VAT', kind: 'vat' },
  ],

  // Customs entry points. UN/LOCODEs are standard; ASYCUDA office codes must be confirmed with FRCS.
  offices: [
    { id: 'suva-port', name: 'Suva port', mode: 'sea', unlocode: 'FJSUV', asycudaOfficeCode: null, island: 'Viti Levu' },
    { id: 'lautoka-port', name: 'Lautoka port', mode: 'sea', unlocode: 'FJLTK', asycudaOfficeCode: null, island: 'Viti Levu' },
    { id: 'nadi-airport', name: 'Nadi International Airport', mode: 'air', unlocode: 'FJNAN', asycudaOfficeCode: null, island: 'Viti Levu' },
  ],

  // Main trade lanes into Fiji. Transit days are indicative planning values (direct vs. transhipment varies by carrier).
  lanes: {
    verified: false,
    note: 'Indicative transit times for planning; check the current carrier schedule.',
    items: [
      { from: 'AUBNE', fromName: 'Brisbane', country: 'Australia', to: 'FJSUV', mode: 'sea', transitDays: 7 },
      { from: 'AUSYD', fromName: 'Sydney', country: 'Australia', to: 'FJSUV', mode: 'sea', transitDays: 9 },
      { from: 'NZAKL', fromName: 'Auckland', country: 'New Zealand', to: 'FJSUV', mode: 'sea', transitDays: 6 },
      { from: 'NZAKL', fromName: 'Auckland', country: 'New Zealand', to: 'FJLTK', mode: 'sea', transitDays: 5 },
      { from: 'CNSHA', fromName: 'Shanghai', country: 'China', to: 'FJSUV', mode: 'sea', transitDays: 21 },
      { from: 'CNNGB', fromName: 'Ningbo', country: 'China', to: 'FJLTK', mode: 'sea', transitDays: 22 },
      { from: 'USLAX', fromName: 'Los Angeles', country: 'United States', to: 'FJSUV', mode: 'sea', transitDays: 18 },
      { from: 'PFPPT', fromName: 'Papeete', country: 'French Polynesia', to: 'FJSUV', mode: 'sea', transitDays: 12 },
      { from: 'NCNOU', fromName: 'Nouméa', country: 'New Caledonia', to: 'FJSUV', mode: 'sea', transitDays: 5 },
      { from: 'WSAPW', fromName: 'Apia', country: 'Samoa', to: 'FJSUV', mode: 'sea', transitDays: 4 },
      { from: 'TONUK', fromName: "Nuku'alofa", country: 'Tonga', to: 'FJSUV', mode: 'sea', transitDays: 4 },
      { from: 'AUSYD', fromName: 'Sydney', country: 'Australia', to: 'FJNAN', mode: 'air', transitDays: 1 },
      { from: 'NZAKL', fromName: 'Auckland', country: 'New Zealand', to: 'FJNAN', mode: 'air', transitDays: 1 },
      { from: 'HKHKG', fromName: 'Hong Kong', country: 'Hong Kong', to: 'FJNAN', mode: 'air', transitDays: 2 },
      { from: 'USLAX', fromName: 'Los Angeles', country: 'United States', to: 'FJNAN', mode: 'air', transitDays: 1 },
    ],
  },
};
