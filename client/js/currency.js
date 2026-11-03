const STORAGE_KEY = 'bs_currency';

const CURRENCIES = {
  INR: { perUsd: 83, locale: 'en-IN', decimals: 0 },
  USD: { perUsd: 1, locale: 'en-US', decimals: 2 },
  EUR: { perUsd: 0.92, locale: 'de-DE', decimals: 2 },
};

export const DEFAULT_CURRENCY = 'INR';

function readStoredCurrency() {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY;

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return CURRENCIES[value] ? value : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

let current = readStoredCurrency();

export function getCurrency() {
  return current;
}

export function currencyCodes() {
  return Object.keys(CURRENCIES);
}

export function setCurrency(code) {
  const next = String(code ?? '').toUpperCase();
  if (!CURRENCIES[next] || next === current) return;

  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable; the in-memory preference still applies.
    }

    window.dispatchEvent(new CustomEvent('currency:changed', { detail: { currency: next } }));
  }
}

function perUsd(code) {
  return CURRENCIES[String(code ?? 'USD').toUpperCase()]?.perUsd ?? 1;
}

export function formatPrice(cents, sourceCurrency = 'USD') {
  const target = CURRENCIES[current];
  const amount = (cents / 100) * (target.perUsd / perUsd(sourceCurrency));

  return new Intl.NumberFormat(target.locale, {
    style: 'currency',
    currency: current,
    minimumFractionDigits: target.decimals,
    maximumFractionDigits: target.decimals,
  }).format(amount);
}
