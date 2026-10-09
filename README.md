# pacific-customs-kit

Open-source customs toolkit for Pacific Island trade.

Importers in the Pacific work with scanned invoices, photos of bills of lading taken on the wharf, and tax rules that differ from one island state to the next. This kit gives developers the boring, exact part:

- **Country profiles**: VAT, valuation basis, customs offices, main trade lanes. Every figure has a `source` and a `verified` flag. **Fiji (FJ)** and **French Polynesia (PF)** are available.
- **Strict document schemas** ([zod](https://zod.dev)): commercial invoice, bill of lading, HS codes, UN/LOCODEs, ISO currencies. The same schemas produce JSON Schema for structured LLM output.
- **Deterministic charge calculation** in integer cents. An AI may *read* a document, but taxes are always computed by code.
- **Discrepancy checks**: line totals, invoice totals, importer TIN, invoice vs. bill of lading, and declared vs. computed duty and VAT, with a configurable tolerance.

It powers the customs features of [ManaLog](https://github.com/Heya-56/manalog), a voice sourcing agent for Alexa+.

## Install and test

```bash
git clone https://github.com/Heya-56/pacific-customs-kit
cd pacific-customs-kit
npm install
npm test
```

Node 20 or later. One dependency (zod).

## Usage

```js
import { cifValue, computeImportCharges, checkInvoice, compareCharges } from 'pacific-customs-kit';

// 1. CIF value in FJD (pass the weekly ASYCUDA exchange rate when you have it)
const vfd = cifValue({ goods: 4000, freight: 350, insurance: 21.85, fxRate: 2.25 }); // 9836.66

// 2. Import charges with the FRCS formula
const charges = computeImportCharges({ country: 'FJ', valueForDuty: vfd, dutyRate: 0.15, exciseRate: 0 });
// fiscal duty 1475.50, VAT 1414.02 (12.5% of VFD + duty + excise)

// French Polynesia: amounts in whole CFP francs, per-weight and per-line taxes, product taxes before VAT
computeImportCharges({ country: 'PF', valueForDuty: 100000, dutyRate: 0.10, weightKg: 250, lineCount: 1,
  extraRates: [{ code: 'tdl', name: 'TDL', rate: 0.05 }] });

// 3. Check a document (for example the output of an OCR / LLM extraction)
const { ok, issues } = checkInvoice(invoiceJson);

// 4. Compare what a document or a person declared with the calculation
compareCharges({ vat: 1696.82 }, charges);
// → vat_discrepancy: the document says 1696.82 FJD, the calculation gives 1414.02 FJD
```

Each issue looks like `{ code, severity, field, message, expected, actual }`. `error` means the figures do not add up; `warning` means data is missing or must be checked by a person.

## Fiji profile

| Item | Value | Status |
|---|---|---|
| VAT | 12.5% (tax label "G"), from 1 Aug 2025 | verified ([FRCS notice](https://frcs.org.fj/public-notice/implementation-of-new-vat-tax-label-g-effective-1-august-2025/)) |
| Valuation | VFD = CIF; VAT base = VFD + fiscal duty + import excise | verified ([FRCS calculator](https://frcs.org.fj/our-services/calculators/customs-charges-duties/)) |
| Lodgement | ASYCUDA World, by the importer or its customs agent, with a TIN | verified ([FRCS import procedure](https://frcs.org.fj/our-services/customs/trade-business/importers/import-procedure/)) |
| Offices | Suva port (FJSUV), Lautoka port (FJLTK), Nadi airport (FJNAN) | ASYCUDA office codes to confirm with FRCS |
| Fiscal duty / excise by category | Illustrative defaults | **not verified**: use the exact tariff line |
| Exchange rate | Indicative 2.25 FJD/USD | **not verified**: FRCS uses weekly ASYCUDA rates |
| Trade lanes | Australia, New Zealand, China, US, French Polynesia, New Caledonia, Samoa, Tonga | indicative transit times |

## French Polynesia profile

| Item | Value | Status |
|---|---|---|
| VAT (TVA) | 16% standard rate, on CIF + customs duty + other taxes | verified ([customs FAQ](https://www.service-public.pf/douane/faq/), updated 3 Feb 2025) |
| Valuation | CIF (CAF); every duty is a share of CIF except VAT | verified (same source) |
| TEA (environment and agriculture tax) | 2% of CIF | verified (same source) |
| Toll (péage) | 1.25% of CIF in most cases | verified (same source) |
| Statistical tax (TS) | 50 XPF per 100 kg | verified (same source) |
| Customs IT participation (PID) | 85 XPF per declaration line | verified (same source) |
| Customs duty (DD) | depends on the tariff line and origin | **not verified**: illustrative defaults; use the [official simulator](https://simulateur-douane-polynesie.com) |
| TDL, TCP, alcohol, tobacco, fuel taxes | product-specific | pass them as `extraRates` |
| Currency | XPF, no subunit (amounts rounded to the franc); pegged to the euro | |
| Customs system | SOFIX / FENIX | name from official pages |

## What this kit does not do

- It does **not** lodge declarations. Neither Fiji (ASYCUDA World) nor French Polynesia (SOFIX / FENIX) offers a public API; a registered importer or customs agent must review and lodge the entry.
- It is **not** legal or tax advice. Tariff rates depend on the exact HS line, origin and concession codes. Rates not marked `verified` are placeholders.

## Contributing

New country profiles are welcome: the 24 members of the Oceania Customs Organisation share the same problems (Samoa, Tonga, Vanuatu, Papua New Guinea, Solomon Islands, New Caledonia, Wallis and Futuna, Cook Islands…). A profile must cite an official source for every figure marked `verified: true`, and come with tests.

## License

MIT © 2026 Heianui Tapare — Hinova Digital
