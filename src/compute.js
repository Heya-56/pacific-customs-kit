// Deterministic import-charge calculation. No AI here: an LLM may read documents, but never computes taxes.
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
 * Fiji (FRCS): VFD = CIF; fiscal duty = VFD × rate; import excise = VFD × rate;
 * VFV = VFD + fiscal duty + excise; VAT = VFV × VAT rate.
 * @param {object} i
 * @param {string} i.country           profile code, e.g. 'FJ'
 * @param {number} i.valueForDuty      CIF value in the profile currency
 * @param {number} [i.fiscalDutyRate]  overrides the category default
 * @param {number} [i.importExciseRate]
 * @param {string} [i.category]        packaging | food_raw | cosmetic_inputs | craft_materials | general
 */
export function computeImportCharges({ country = 'FJ', valueForDuty, fiscalDutyRate, importExciseRate, category = 'general' }) {
  const p = getProfile(country);
  const defaults = p.duty.categories[category] ?? p.duty.categories.general;
  const dutyRate = fiscalDutyRate ?? defaults.fiscalDuty;
  const exciseRate = importExciseRate ?? defaults.importExcise;
  const dutySrc = fiscalDutyRate == null ? (p.duty.verified ? 'profile' : 'illustrative-default') : 'caller';
  const exciseSrc = importExciseRate == null ? (p.duty.verified ? 'profile' : 'illustrative-default') : 'caller';

  const vfd = toCents(valueForDuty);
  if (vfd < 0) throw new RangeError('valueForDuty must be >= 0');
  const fiscalDuty = applyRate(vfd, dutyRate);
  const importExcise = applyRate(vfd, exciseRate);
  const valueForVat = vfd + fiscalDuty + importExcise;
  const vat = applyRate(valueForVat, p.vat.rate);
  const total = fiscalDuty + importExcise + vat;

  return {
    country: p.code,
    currency: p.currency,
    valueForDuty: fromCents(vfd),
    lines: [
      { code: 'fiscal_duty', name: 'Fiscal duty', rate: dutyRate, base: fromCents(vfd), amount: fromCents(fiscalDuty), rateSource: dutySrc },
      { code: 'import_excise', name: 'Import excise', rate: exciseRate, base: fromCents(vfd), amount: fromCents(importExcise), rateSource: exciseSrc },
      { code: 'vat', name: 'VAT', rate: p.vat.rate, base: fromCents(valueForVat), amount: fromCents(vat), rateSource: p.vat.verified ? 'official' : 'illustrative-default' },
    ],
    valueForVat: fromCents(valueForVat),
    totalCharges: fromCents(total),
    landedValue: fromCents(vfd + total),
    rateSources: { vat: p.vat.source, valuation: p.valuation.source },
    disclaimer: [dutySrc, exciseSrc].includes('illustrative-default') ? p.duty.note : null,
  };
}
