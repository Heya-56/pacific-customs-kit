import { FJ } from './fj.js';
import { PF } from './pf.js';

export const profiles = { FJ, PF };

export function getProfile(code) {
  const p = profiles[String(code ?? '').toUpperCase()];
  if (!p) throw new Error(`Unknown country profile "${code}". Available: ${Object.keys(profiles).join(', ')}`);
  return p;
}

export const listProfiles = () => Object.values(profiles).map((p) => ({ code: p.code, name: p.name, currency: p.currency, vatRate: p.vat.rate }));
