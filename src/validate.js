// Discrepancy checks. Each issue is { code, severity, field, message, expected?, actual? }.
// severity: 'error' = the figures do not add up; 'warning' = missing or suspicious data a person must check.
import { CommercialInvoice, BillOfLading } from './schemas.js';
import { toCents, fromCents } from './money.js';

const issue = (code, severity, field, message, extra = {}) => ({ code, severity, field, message, ...extra });

/** Default tolerance: the larger of an absolute amount and a share of the expected value. */
export const DEFAULT_TOLERANCE = { pct: 0.02, abs: 50 };
const allowed = (expectedCents, { pct, abs }) => Math.max(toCents(abs), Math.round(Math.abs(expectedCents) * pct));

/** Parse with a zod schema and turn schema errors into issues instead of throwing. */
function parseOrIssues(schema, data) {
  const r = schema.safeParse(data);
  if (r.success) return { data: r.data, issues: [] };
  return { data: null, issues: r.error.issues.map((e) => issue('schema', 'error', e.path.join('.'), e.message)) };
}

/**
 * Check a commercial invoice: arithmetic, HS codes, importer TIN.
 * @param {object} raw
 * @param {object} [opt]
 * @param {boolean} [opt.requireBuyerTin=true]  Fiji requires the importer TIN on the entry
 */
export function checkInvoice(raw, { requireBuyerTin = true } = {}) {
  const { data: inv, issues } = parseOrIssues(CommercialInvoice, raw);
  if (!inv) return { ok: false, issues, invoice: null };

  let linesSum = 0;
  inv.lines.forEach((l, i) => {
    const expected = Math.round(l.quantity * toCents(l.unitPrice));
    const actual = toCents(l.lineTotal);
    linesSum += actual;
    // A line may be off by rounding only: 1 cent per line, or 0.5 % for fractional quantities.
    if (Math.abs(expected - actual) > Math.max(1, Math.round(expected * 0.005))) {
      issues.push(issue('line_total_mismatch', 'error', `lines.${i}.lineTotal`, `Line ${i + 1}: ${l.quantity} × ${l.unitPrice} = ${fromCents(expected)}, but the invoice says ${l.lineTotal}.`, { expected: fromCents(expected), actual: l.lineTotal }));
    }
    if (!l.hsCode) issues.push(issue('hs_missing', 'warning', `lines.${i}.hsCode`, `Line ${i + 1} has no HS code: the customs agent must classify "${l.description}".`));
  });

  const extras = toCents(inv.freight ?? 0) + toCents(inv.insurance ?? 0);
  const total = toCents(inv.total);
  // The invoice total may or may not include freight and insurance; accept either reading.
  if (Math.abs(total - linesSum) > 1 && Math.abs(total - (linesSum + extras)) > 1) {
    issues.push(issue('invoice_total_mismatch', 'error', 'total', `Lines add up to ${fromCents(linesSum)}${extras ? ` (${fromCents(linesSum + extras)} with freight and insurance)` : ''}, but the invoice total is ${inv.total}.`, { expected: fromCents(linesSum + extras), actual: inv.total }));
  }
  if (requireBuyerTin && !inv.buyer.tin) issues.push(issue('buyer_tin_missing', 'warning', 'buyer.tin', 'The importer tax ID is missing (TIN in Fiji, numéro TAHITI in French Polynesia); customs entries need it.'));
  if (inv.incoterm && ['CIF', 'CIP'].includes(inv.incoterm) && inv.freight == null) {
    issues.push(issue('freight_missing', 'warning', 'freight', `Incoterm ${inv.incoterm} includes freight, but no freight amount is shown: the CIF value cannot be split.`));
  }
  return { ok: !issues.some((x) => x.severity === 'error'), issues, invoice: inv };
}

/** Cross-check an invoice against its bill of lading (parties, port, weight). */
export function crossCheck(invoiceRaw, blRaw, { weightTolerancePct = 0.05 } = {}) {
  const a = parseOrIssues(CommercialInvoice, invoiceRaw);
  const b = parseOrIssues(BillOfLading, blRaw);
  const issues = [...a.issues.map((x) => ({ ...x, field: `invoice.${x.field}` })), ...b.issues.map((x) => ({ ...x, field: `bl.${x.field}` }))];
  if (!a.data || !b.data) return { ok: false, issues };
  const inv = a.data; const bl = b.data;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm(inv.buyer.name) !== norm(bl.consignee.name)) {
    issues.push(issue('consignee_mismatch', 'warning', 'bl.consignee.name', `Invoice buyer "${inv.buyer.name}" differs from B/L consignee "${bl.consignee.name}".`));
  }
  if (inv.portOfDischarge && inv.portOfDischarge !== bl.portOfDischarge) {
    issues.push(issue('port_mismatch', 'error', 'bl.portOfDischarge', `Invoice port ${inv.portOfDischarge} differs from B/L port ${bl.portOfDischarge}.`, { expected: inv.portOfDischarge, actual: bl.portOfDischarge }));
  }
  if (inv.grossWeightKg != null && bl.grossWeightKg != null) {
    const diff = Math.abs(inv.grossWeightKg - bl.grossWeightKg);
    if (diff > inv.grossWeightKg * weightTolerancePct) {
      issues.push(issue('weight_mismatch', 'warning', 'bl.grossWeightKg', `Gross weight differs: invoice ${inv.grossWeightKg} kg, B/L ${bl.grossWeightKg} kg.`, { expected: inv.grossWeightKg, actual: bl.grossWeightKg }));
    }
  }
  return { ok: !issues.some((x) => x.severity === 'error'), issues };
}

/**
 * Compare charges written on a document (or by a person) with the deterministic calculation.
 * @param {{fiscalDuty?:number, importExcise?:number, vat?:number}} declared
 * @param {ReturnType<import('./compute.js').computeImportCharges>} computed
 */
export function compareCharges(declared, computed, tolerance = DEFAULT_TOLERANCE) {
  const issues = [];
  // Keys are charge codes (fiscal_duty, customs_duty, tea, vat...); camelCase aliases are accepted.
  const alias = { fiscalDuty: 'fiscal_duty', importExcise: 'import_excise', customsDuty: 'customs_duty' };
  for (const [key, value] of Object.entries(declared ?? {})) {
    if (value == null) continue;
    const code = alias[key] ?? key;
    const line = computed.lines.find((l) => l.code === code);
    if (!line) continue;
    const exp = toCents(line.amount); const act = toCents(value);
    if (Math.abs(exp - act) > allowed(exp, tolerance)) {
      const how = line.rate != null ? ` (${(line.rate * 100).toFixed(line.rate * 1000 % 10 ? 2 : 1)}% of ${line.base})` : '';
      issues.push(issue(`${code}_discrepancy`, 'error', key,
        `${line.name}: the document says ${value} ${computed.currency}, the calculation gives ${line.amount} ${computed.currency}${how}.`,
        { expected: line.amount, actual: value, difference: fromCents(act - exp) }));
    }
  }
  return { ok: issues.length === 0, issues, tolerance };
}
