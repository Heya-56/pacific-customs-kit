// Deterministic import-charge calculation. No AI here: an LLM may read documents, but never computes taxes.
// Each country profile lists its charges in order; this engine applies them in integer cents.
import { toCents, fromCents, applyRate } from './money.js';
import { getProfile } from './profiles/index.js';

/**
 * CIF value in the destination currency.
 * @param {object} i
 * @param {number} i.goods       invoice value of the goods (FOB / EXW), in `currency`
 * @param {number} [i.freight]   international freight, in `currency`
 * @param {number} [i.insurance] insurance, in `currency`
 * @param {number} i.fxRate      destination currency units per 1 unit of `currency` (e.g. FJD per USD)
 */
export function cifValue({ goods, freight = 0, insurance = 0, fxRate }) {
  if (!(fxRate > 0)) throw new RangeError('fxRate must be > 0');
  const foreignCents = toCents(goods) + toCents(freight) + toCents(insurance);
  return fromCents(applyRate(foreignCents, fxRate));
}

/**
 * Import charges for one country profile.
 * @param {object} i
 * @param {string} [i.country='FJ']     profile code: FJ, PF
 * @param {number} i.valueForDuty       CIF value in the profile currency
 * @param {string} [i.category]         packaging | food_raw | cosmetic_inputs | craft_materials | general
 * @param {number} [i.dutyRate]         exact tariff-line duty rate (aliases: fiscalDutyRate for Fiji, customsDutyRate for PF)
 * @param {number} [i.exciseRate]       exact excise rate (alias: importExciseRate)
 * @param {number} [i.weightKg]         for per-weight charges (e.g. PF statistical tax)
 * @param {number} [i.lineCount=1]      number of declaration lines, for per-line charges (e.g. PF PID)
 * @param {Array<{code:string,name:string,rate:number}>} [i.extraRates]  product-specific ad valorem taxes (e.g. PF TDL), charged on CIF before VAT
 */
export function computeImportCharges(i) {
  const { country = 'FJ', valueForDuty, category = 'general', weightKg, lineCount = 1, extraRates = [] } = i;
  const p = getProfile(country);
  const defaults = p.duty.categories[category] ?? p.duty.categories.general;
  const given = { duty: i.dutyRate ?? i.fiscalDutyRate ?? i.customsDutyRate, excise: i.exciseRate ?? i.importExciseRate };
  const round = (cents) => (p.currencyDecimals === 0 ? Math.round(cents / 100) * 100 : cents);

  const vfd = round(toCents(valueForDuty));
  if (vfd < 0) throw new RangeError('valueForDuty must be >= 0');

  const notes = [];
  const lines = [];
  let illustrative = false;
  const push = (c, rate, base, amount, rateSource, extra = {}) =>
    lines.push({ code: c.code, name: c.name, rate, base: fromCents(base), amount: fromCents(amount), rateSource, ...extra });

  const chargeList = [...p.charges];
  // Product-specific ad valorem taxes go just before VAT.
  const vatAt = chargeList.findIndex((c) => c.kind === 'vat');
  chargeList.splice(vatAt, 0, ...extraRates.map((x) => ({ code: x.code, name: x.name, kind: 'ad_valorem', rate: x.rate, caller: true })));

  let running = 0;
  for (const c of chargeList) {
    if (c.kind === 'tariff') {
      const rate = given[c.tariffKey] ?? defaults[c.tariffKey] ?? 0;
      const src = given[c.tariffKey] != null ? 'caller' : (p.duty.verified ? 'profile' : 'illustrative-default');
      if (src === 'illustrative-default') illustrative = true;
      const amount = round(applyRate(vfd, rate)); running += amount; push(c, rate, vfd, amount, src);
    } else if (c.kind === 'ad_valorem') {
      const amount = round(applyRate(vfd, c.rate)); running += amount;
      push(c, c.rate, vfd, amount, c.caller ? 'caller' : (c.verified ? 'official' : 'illustrative-default'));
    } else if (c.kind === 'per_100kg') {
      if (!(weightKg > 0)) { notes.push(`${c.name} not computed: weight unknown.`); continue; }
      const amount = round(Math.round(toCents(c.amount) * (weightKg / 100))); running += amount;
      push(c, null, 0, amount, c.verified ? 'official' : 'illustrative-default', { unitAmount: c.amount, per: '100 kg', quantity: weightKg });
    } else if (c.kind === 'per_line') {
      const amount = round(toCents(c.amount) * Math.max(1, Math.floor(lineCount))); running += amount;
      push(c, null, 0, amount, c.verified ? 'official' : 'illustrative-default', { unitAmount: c.amount, per: 'line', quantity: lineCount });
    } else if (c.kind === 'vat') {
      const base = vfd + running;
      const amount = round(applyRate(base, p.vat.rate)); running += amount;
      push({ code: 'vat', name: c.name }, p.vat.rate, base, amount, p.vat.verified ? 'official' : 'illustrative-default');
    }
  }
  const vatLine = lines.find((l) => l.code === 'vat');
  return {
    country: p.code,
    currency: p.currency,
    valueForDuty: fromCents(vfd),
    lines,
    valueForVat: vatLine?.base ?? null,
    totalCharges: fromCents(running),
    landedValue: fromCents(vfd + running),
    rateSources: { vat: p.vat.source, valuation: p.valuation.source },
    notes,
    disclaimer: illustrative ? p.duty.note : null,
  };
}
