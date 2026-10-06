import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeImportCharges, cifValue, checkInvoice, crossCheck, compareCharges, getProfile, listProfiles, schemas } from '../src/index.js';

const invoice = () => ({
  documentType: 'commercial_invoice',
  invoiceNumber: 'INV-2026-0142',
  invoiceDate: '2026-09-28',
  seller: { name: 'Coral Pack Industries (demo)', country: 'CN' },
  buyer: { name: 'Bula Naturals Ltd (demo)', country: 'FJ', tin: '50-12345-0-1' },
  currency: 'USD',
  incoterm: 'FOB',
  lines: [
    { description: 'Amber glass bottle 100 ml', hsCode: '7010.90', originCountry: 'CN', quantity: 20000, unit: 'pcs', unitPrice: 0.18, lineTotal: 3600 },
    { description: 'Aluminium screw cap', hsCode: '8309.90', originCountry: 'CN', quantity: 20000, unit: 'pcs', unitPrice: 0.02, lineTotal: 400 },
  ],
  total: 4000,
  grossWeightKg: 4200,
  portOfDischarge: 'FJSUV',
});

const bl = () => ({
  documentType: 'bill_of_lading',
  blNumber: 'NGBSUV260931',
  shipper: { name: 'Coral Pack Industries (demo)' },
  consignee: { name: 'Bula Naturals Ltd (demo)' },
  portOfLoading: 'CNNGB',
  portOfDischarge: 'FJSUV',
  packages: 420,
  grossWeightKg: 4180,
  containers: [{ number: 'MSCU1234567', type: '20GP' }],
});

test('Fiji profile: official VAT 12.5% since 1 Aug 2025, with source', () => {
  const fj = getProfile('fj');
  assert.equal(fj.vat.rate, 0.125);
  assert.equal(fj.vat.effectiveFrom, '2025-08-01');
  assert.equal(fj.vat.verified, true);
  assert.match(fj.vat.source, /^https:\/\/frcs\.org\.fj\//);
  assert.equal(fj.duty.verified, false, 'tariff rates stay illustrative until confirmed');
  assert.deepEqual(listProfiles().map((p) => p.code), ['FJ']);
  assert.throws(() => getProfile('ZZ'), /Unknown country profile/);
});

test('FRCS formula: VAT is charged on VFD + fiscal duty + import excise', () => {
  const r = computeImportCharges({ country: 'FJ', valueForDuty: 1000, fiscalDutyRate: 0.15, importExciseRate: 0.10 });
  const [duty, excise, vat] = r.lines;
  assert.equal(duty.amount, 150);
  assert.equal(excise.amount, 100);
  assert.equal(r.valueForVat, 1250);
  assert.equal(vat.amount, 156.25);
  assert.equal(r.totalCharges, 406.25);
  assert.equal(r.landedValue, 1406.25);
  assert.equal(duty.rateSource, 'caller');
  assert.equal(vat.rateSource, 'official');
  assert.equal(r.disclaimer, null, 'no disclaimer when the caller supplies the tariff rates');
});

test('category defaults are flagged as illustrative', () => {
  const r = computeImportCharges({ valueForDuty: 10000, category: 'packaging' });
  assert.equal(r.lines[0].amount, 1500);
  assert.equal(r.lines[2].amount, 1437.5);
  assert.equal(r.totalCharges, 2937.5);
  assert.equal(r.lines[0].rateSource, 'illustrative-default');
  assert.ok(r.disclaimer);
});

test('money math stays exact to the cent', () => {
  const r = computeImportCharges({ valueForDuty: 99.99, fiscalDutyRate: 0.05, importExciseRate: 0 });
  assert.equal(r.lines[0].amount, 5); // 4.9995 → 5.00
  assert.equal(r.valueForVat, 104.99);
  assert.equal(r.lines[2].amount, 13.12); // 13.12375 → 13.12
  assert.equal(cifValue({ goods: 4000, freight: 350, insurance: 21.85, fxRate: 2.25 }), 9836.66);
  assert.throws(() => cifValue({ goods: 1, fxRate: 0 }), /fxRate/);
});

test('HS codes: 6, 8 or 10 digits, dots allowed', () => {
  assert.equal(schemas.HsCode.parse('7010.90'), '701090');
  assert.equal(schemas.HsCode.parse('3304.99.00'), '33049900');
  assert.equal(schemas.HsCode.safeParse('70109').success, false);
  assert.equal(schemas.HsCode.safeParse('7010900').success, false);
});

test('a correct invoice passes', () => {
  const r = checkInvoice(invoice());
  assert.equal(r.ok, true);
  assert.deepEqual(r.issues, []);
  assert.equal(r.invoice.lines[0].hsCode, '701090');
});

test('invoice arithmetic errors are caught', () => {
  const inv = invoice();
  inv.lines[0].lineTotal = 3800; // should be 3600
  const r = checkInvoice(inv);
  assert.equal(r.ok, false);
  const codes = r.issues.map((i) => i.code);
  assert.ok(codes.includes('line_total_mismatch'));
  assert.ok(codes.includes('invoice_total_mismatch'));
  assert.equal(r.issues.find((i) => i.code === 'line_total_mismatch').expected, 3600);
});

test('invoice total including freight and insurance is accepted', () => {
  const inv = invoice();
  Object.assign(inv, { incoterm: 'CIF', freight: 350, insurance: 21.85, total: 4371.85 });
  assert.equal(checkInvoice(inv).ok, true);
});

test('missing TIN and HS code are warnings, not errors', () => {
  const inv = invoice();
  delete inv.buyer.tin;
  delete inv.lines[1].hsCode;
  const r = checkInvoice(inv);
  assert.equal(r.ok, true);
  assert.deepEqual(r.issues.map((i) => [i.code, i.severity]), [['hs_missing', 'warning'], ['buyer_tin_missing', 'warning']]);
});

test('schema errors become issues instead of exceptions (bad scans)', () => {
  const r = checkInvoice({ documentType: 'commercial_invoice', invoiceNumber: '', currency: 'usd', lines: [] });
  assert.equal(r.ok, false);
  assert.ok(r.issues.length >= 3);
  assert.ok(r.issues.every((i) => i.code === 'schema'));
});

test('invoice vs bill of lading cross-check', () => {
  assert.equal(crossCheck(invoice(), bl()).ok, true);
  const wrong = bl();
  wrong.portOfDischarge = 'FJLTK';
  wrong.grossWeightKg = 5200;
  const r = crossCheck(invoice(), wrong);
  assert.equal(r.ok, false);
  assert.deepEqual(r.issues.map((i) => i.code).sort(), ['port_mismatch', 'weight_mismatch']);
});

test('declared VAT at the old 15% rate raises an alert; rounding noise does not', () => {
  const computed = computeImportCharges({ valueForDuty: 9836.66, fiscalDutyRate: 0.15, importExciseRate: 0 });
  // VFD 9836.66 → duty 1475.50 → VFV 11312.16 → VAT 1414.02
  assert.equal(computed.lines[2].amount, 1414.02);
  const old = compareCharges({ fiscalDuty: 1475.5, vat: 1696.82 }, computed); // 15% of VFV
  assert.equal(old.ok, false);
  assert.equal(old.issues[0].code, 'vat_discrepancy');
  assert.equal(old.issues[0].difference, 282.8);
  assert.equal(compareCharges({ fiscalDuty: 1475.49, vat: 1414.1 }, computed).ok, true);
});
