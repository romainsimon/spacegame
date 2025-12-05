const distanceFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const preciseFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

export const formatDistance = (meters: number) => {
  if (!Number.isFinite(meters)) return '—';
  if (meters >= 1000) {
    return `${preciseFormatter.format(meters / 1000)} km`;
  }
  return `${distanceFormatter.format(Math.max(0, meters))} m`;
};

export const formatVelocity = (metersPerSecond: number) => {
  if (!Number.isFinite(metersPerSecond)) return '—';
  if (metersPerSecond >= 1000) {
    return `${preciseFormatter.format(metersPerSecond / 1000)} km/s`;
  }
  return `${distanceFormatter.format(Math.max(0, metersPerSecond))} m/s`;
};

export const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
};
