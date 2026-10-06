# pacific-customs-kit

Open-source customs toolkit for Pacific Island trade.

Importers in the Pacific work with scanned invoices, photos of bills of lading taken on the wharf, and tax rules that differ from one island state to the next. This kit gives developers the boring, exact part:

- **Country profiles**: VAT, valuation basis, customs offices, main trade lanes. Every figure has a `source` and a `verified` flag. **Fiji (FJ)** comes first.
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
const charges = computeImportCharges({ country: 'FJ', valueForDuty: vfd, fiscalDutyRate: 0.15, importExciseRate: 0 });
// fiscal duty 1475.50, VAT 1414.02 (12.5% of VFD + duty + excise)

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

## What this kit does not do

- It does **not** lodge declarations. Fiji has no public API for ASYCUDA World; a registered importer or customs agent must review and lodge the entry.
- It is **not** legal or tax advice. Tariff rates depend on the exact HS line, origin and concession codes. Rates not marked `verified` are placeholders.

## Contributing

New country profiles are welcome (Samoa, Tonga, Vanuatu, Papua New Guinea, Solomon Islands, New Caledonia, French Polynesia…). A profile must cite an official source for every figure marked `verified: true`, and come with tests.

## License

MIT © 2026 Heianui Tapare — Hinova Digital
