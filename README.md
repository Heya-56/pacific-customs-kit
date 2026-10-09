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

// French Polynesia, official tariff line 7010.90.00 (glass bottles), by sea, 120 kg net:
computeImportCharges({ country: 'PF', valueForDuty: 100000, hsCode: '7010.90', weightKg: 120 });
// DD 13% 13,000 · TEAP 2% 2,000 · TEEI 1% 1,000 · port toll 1,250 · TS 100 · PID 85 · VAT 16% 18,790 (whole francs)

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

Sources: the official customs tariff (*Tarif des douanes*, section "Taux de taxation et assiettes", [PDF on service-public.pf](https://www.service-public.pf/douane/wp-content/uploads/sites/18/2024/12/Tarif-des-douanes-2025-01.pdf)) and an extract of the tariff dated **1 January 2026** for the lines below.

| Item | Value | Status |
|---|---|---|
| Valuation | CIF (CAF) | verified |
| VAT (TVA) | 0%, 5% or 16% by tariff line, on **CIF + all duties and taxes except TDL + landing costs** | verified |
| TDL (local development tax) | 2% to 82% by line, on **CIF + customs duty**, not in the VAT base | verified (rule); per line in `tariffLines` |
| TEAP (environment, agriculture, fisheries) | 2% or 10% of CIF by line; some lines have none | verified |
| TEEI (imported electrical equipment) | 1% of CIF on some lines | verified |
| Port toll (PEAGE, Papeete) | 1.25% of CIF, sea freight | verified |
| SETIL (Faa'a freight station) | 4.972 XPF per net kg, minimum 45 XPF, air freight | verified |
| Statistical tax (TS) | 50 XPF per started 100 kg or per started tonne, by line | verified |
| PID (customs IT participation) | 85 XPF per declaration item | verified |
| Customs duty (DD) | standard or reduced rate by line and origin | verified for the lines below; reduced-rate eligibility (origin) to confirm per case |
| Currency | XPF, no subunit (amounts rounded to the franc); pegged to the euro | |

Official tariff lines included (1 Jan 2026): vanilla 0905.10.00, coconut oil 1513.11.00 and 1513.19.10, monoi-type preparations 3304.99.10, Monoi de Tahiti packaged 3304.99.29 (TDL 37%), paper bags 4819.30.00 and 4819.40.00, glass bottles 7010.90.00. Other lines fall back to illustrative category defaults and are flagged as such.

## What this kit does not do

- It does **not** lodge declarations. Neither Fiji (ASYCUDA World) nor French Polynesia offers a public API for this; a registered importer or customs agent must review and lodge the entry.
- It is **not** legal or tax advice. Tariff rates depend on the exact HS line, origin and concession codes. Rates not marked `verified` are placeholders.

## Contributing

New country profiles are welcome: the 24 members of the Oceania Customs Organisation share the same problems (Samoa, Tonga, Vanuatu, Papua New Guinea, Solomon Islands, New Caledonia, Wallis and Futuna, Cook Islands…). A profile must cite an official source for every figure marked `verified: true`, and come with tests.

## License

MIT © 2026 Heianui Tapare — Hinova Digital
