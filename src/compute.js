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

/** Find an official tariff line in a profile by HS code (8 digits exact, or a unique 6-digit prefix). */
export function findTariffLine(country, hsCode) {
  const p = getProfile(country);
  const lines = p.tariffLines?.lines;
  if (!lines || !hsCode) return null;
  const d = String(hsCode).replace(/\D/g, '');
  if (lines[d]) return { code: d, ...lines[d] };
  if (d.length >= 6) {
    const hits = Object.keys(lines).filter((k) => k.startsWith(d.slice(0, Math.min(d.length, 8))));
    if (hits.length === 1) return { code: hits[0], ...lines[hits[0]] };
  }
  return null;
}

/**
 * Import charges for one country profile.
 * @param {object} i
 * @param {string} [i.country='FJ']     profile code: FJ, PF
 * @param {number} i.valueForDuty       CIF value in the profile currency
 * @param {string} [i.category]         packaging | food_raw | cosmetic_inputs | craft_materials | general (used when no tariff line is known)
 * @param {string} [i.hsCode]           tariff code: when the profile has this official line, its rates are used
 * @param {boolean} [i.reducedDuty]     apply the line's reduced customs duty (depends on origin; confirm eligibility)
 * @param {'sea'|'air'} [i.mode='sea']  some charges depend on the entry point (PF: port toll by sea, freight-station fee by air)
 * @param {number} [i.dutyRate]         exact duty rate given by the caller (aliases: fiscalDutyRate, customsDutyRate)
 * @param {number} [i.exciseRate]       exact excise rate (alias: importExciseRate)
 * @param {number} [i.weightKg]         net weight, for per-weight charges
 * @param {number} [i.lineCount=1]      number of declaration items, for per-item charges
 * @param {number} [i.landingCosts=0]   landing costs to add to the VAT base where the profile says so (PF)
 * @param {Array<{code:string,name:string,rate:number}>} [i.extraRates]  other product-specific ad valorem taxes, on CIF, before VAT
 */
export function computeImportCharges(i) {
  const { country = 'FJ', valueForDuty, category = 'general', weightKg, lineCount = 1, extraRates = [], mode = 'sea', landingCosts = 0, reducedDuty = false } = i;
  const p = getProfile(country);
  const defaults = p.duty.categories[category] ?? p.duty.categories.general;
  const tariffLine = findTariffLine(country, i.hsCode);
  const given = { duty: i.dutyRate ?? i.fiscalDutyRate ?? i.customsDutyRate, excise: i.exciseRate ?? i.importExciseRate };
  const round = (cents) => (p.currencyDecimals === 0 ? Math.round(cents / 100) * 100 : cents);
  const lineSrc = 'official-tariff';

  const vfd = round(toCents(valueForDuty));
  if (vfd < 0) throw new RangeError('valueForDuty must be >= 0');

  const notes = [];
  const lines = [];
  let illustrative = false;
  let total = 0; let vatBaseExtra = 0; let duty = 0;
  const push = (c, rate, base, amount, rateSource, extra = {}) => {
    lines.push({ code: c.code, name: c.name, rate, base: fromCents(base), amount: fromCents(amount), rateSource, ...extra });
    total += amount;
    if (c.inVatBase !== false) vatBaseExtra += amount;
  };
  const officialOr = (c) => (c.caller ? 'caller' : (c.verified ? 'official' : 'illustrative-default'));

  const chargeList = [...p.charges];
  const vatAt = chargeList.findIndex((c) => c.kind === 'vat');
  chargeList.splice(vatAt, 0, ...extraRates.map((x) => ({ code: x.code, name: x.name, kind: 'ad_valorem', rate: x.rate, caller: true })));

  for (const c of chargeList) {
    if (c.modes && !c.modes.includes(mode)) continue;
    if (c.kind === 'tariff') {
      let rate; let src;
      if (given[c.tariffKey] != null) { rate = given[c.tariffKey]; src = 'caller'; }
      else if (tariffLine && c.tariffKey === 'duty') { rate = reducedDuty ? tariffLine.dutyReduced : tariffLine.duty; src = lineSrc; }
      else { rate = defaults[c.tariffKey] ?? 0; src = p.duty.verified ? 'profile' : 'illustrative-default'; if (src === 'illustrative-default') illustrative = true; }
      const amount = round(applyRate(vfd, rate));
      if (c.tariffKey === 'duty') duty = amount;
      push(c, rate, vfd, amount, src);
    } else if (c.kind === 'line_only') {
      const rate = tariffLine?.[c.lineKey];
      if (!(rate > 0)) continue;
      const base = c.base === 'cif_plus_duty' ? vfd + duty : vfd;
      push(c, rate, base, round(applyRate(base, rate)), lineSrc);
    } else if (c.kind === 'ad_valorem') {
      const fromLine = tariffLine && c.lineKey && tariffLine[c.lineKey] != null;
      const rate = fromLine ? tariffLine[c.lineKey] : c.rate;
      if (!(rate > 0)) continue;
      push(c, rate, vfd, round(applyRate(vfd, rate)), fromLine ? lineSrc : officialOr(c));
    } else if (c.kind === 'per_kg') {
      if (!(weightKg > 0)) { notes.push(`${c.name} not computed: net weight unknown.`); continue; }
      const amount = round(Math.max(toCents(c.minimum ?? 0), Math.round(toCents(c.amount) * weightKg)));
      push(c, null, 0, amount, officialOr(c), { unitAmount: c.amount, per: 'kg', minimum: c.minimum, quantity: weightKg });
    } else if (c.kind === 'per_weight_unit' || c.kind === 'per_100kg') {
      if (!(weightKg > 0)) { notes.push(`${c.name} not computed: net weight unknown.`); continue; }
      const unitKg = tariffLine?.[c.lineKey] ?? c.unitKg ?? 100;
      const units = Math.ceil(weightKg / unitKg); // a started unit counts in full
      push(c, null, 0, round(toCents(c.amount) * units), officialOr(c), { unitAmount: c.amount, per: unitKg === 1000 ? 'tonne' : `${unitKg} kg`, quantity: units });
    } else if (c.kind === 'per_line') {
      const n = Math.max(1, Math.floor(lineCount));
      push(c, null, 0, round(toCents(c.amount) * n), officialOr(c), { unitAmount: c.amount, per: 'item', quantity: n });
    } else if (c.kind === 'vat') {
      const rate = tariffLine?.vat ?? p.vat.rate;
      const base = vfd + vatBaseExtra + (landingCosts ? round(toCents(landingCosts)) : 0);
      push({ code: 'vat', name: c.name }, rate, base, round(applyRate(base, rate)), tariffLine?.vat != null ? lineSrc : (p.vat.verified ? 'official' : 'illustrative-default'));
    }
  }
  const vatLine = lines.find((l) => l.code === 'vat');
  return {
    country: p.code,
    currency: p.currency,
    valueForDuty: fromCents(vfd),
    mode,
    tariffLine: tariffLine ? { code: tariffLine.code, description: tariffLine.description, source: p.tariffLines.source, edition: p.tariffLines.edition, reducedDuty } : null,
    lines,
    valueForVat: vatLine?.base ?? null,
    totalCharges: fromCents(total),
    landedValue: fromCents(vfd + total),
    rateSources: { vat: p.vat.source, valuation: p.valuation.source },
    notes,
    disclaimer: illustrative ? p.duty.note : null,
  };
}
