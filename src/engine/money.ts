export interface Money {
  minor: number;
  currency: string;
}

export function money(minor: number, currency: string): Money {
  if (!Number.isSafeInteger(minor)) throw new TypeError('minor must be a safe integer');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`bad currency code: ${currency}`);
  return { minor, currency };
}

export function times(m: Money, n: number): Money {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('multiplier must be a non-negative int');
  return money(m.minor * n, m.currency);
}

export function parseRate(rate: string): [bigint, bigint] {
  if (!/^\d+(\.\d+)?$/.test(rate)) throw new Error(`bad rate: ${rate}`);
  const [whole, frac = ''] = rate.split('.');
  const num = BigInt(whole + frac);
  if (num <= 0n) throw new Error('rate must be positive');
  return [num, 10n ** BigInt(frac.length)];
}

export function roundHalfEvenDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n || a < 0n) throw new Error('expects a >= 0, b > 0');
  let q = a / b;
  const r = a % b;
  if (2n * r > b || (2n * r === b && q % 2n === 1n)) q += 1n;
  return q;
}

export function convert(m: Money, to: string, rate: string): Money {
  const [num, den] = parseRate(rate);
  return money(Number(roundHalfEvenDiv(BigInt(m.minor) * num, den)), to);
}

export function ceilDiv(a: number, b: number): number {
  if (b <= 0) throw new Error('divisor must be positive');
  return Math.ceil(a / b);
}

export function fmt(m: Money): string {
  const whole = Math.floor(m.minor / 100);
  const frac = m.minor % 100;
  return `${m.currency} ${whole.toLocaleString('en-GB')}.${String(frac).padStart(2, '0')}`;
}
