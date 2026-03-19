export function fmt(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function fmtShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M €`;
  }
  if (abs >= 1000) {
    return `${sign}${Math.round(abs / 1000)}k €`;
  }
  return `${sign}${(abs / 1000).toFixed(1)}k €`;
}
