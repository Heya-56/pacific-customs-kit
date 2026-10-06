// Money helpers: all customs math runs on integer cents so totals never drift by a cent.

export const toCents = (amount) => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new TypeError(`Not a finite amount: ${amount}`);
  return Math.round(amount * 100);
};
export const fromCents = (cents) => cents / 100;

/** Multiply cents by a rate and round half away from zero to the nearest cent. */
export const applyRate = (cents, rate) => {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) throw new TypeError(`Invalid rate: ${rate}`);
  const v = cents * rate;
  return Math.sign(v) * Math.round(Math.abs(v));
};
