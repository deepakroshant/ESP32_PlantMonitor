/**
 * Map raw soil ADC (e.g. 1500–3500) to a simple status for the dashboard.
 */
export function soilStatus(raw: number): 'soggy' | 'ideal' | 'dry' | 'very_dry' {
  if (raw <= 1800) return 'soggy'
  if (raw <= 2500) return 'ideal'
  if (raw <= 3200) return 'dry'
  return 'very_dry'
}

export function soilStatusLabel(status: 'soggy' | 'ideal' | 'dry' | 'very_dry'): string {
  switch (status) {
    case 'soggy':
      return 'Soggy'
    case 'ideal':
      return 'Ideal'
    case 'dry':
      return 'Dry'
    case 'very_dry':
      return 'Very dry'
    default:
      return 'Unknown'
  }
}

/** Tailwind-compatible class for status badge background. */
export function soilStatusBadgeClass(status: 'soggy' | 'ideal' | 'dry' | 'very_dry'): string {
  switch (status) {
    case 'soggy':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/40'
    case 'ideal':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    case 'dry':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    case 'very_dry':
      return 'bg-red-500/20 text-red-300 border-red-500/40'
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/40'
  }
}

/** 0–1 for gauge: 0 = driest (raw 4095), 1 = wettest (raw 0). */
export function soilRawToGauge(raw: number): number {
  const min = 1200
  const max = 3800
  const clamped = Math.max(min, Math.min(max, raw))
  return 1 - (clamped - min) / (max - min)
}

/**
 * 0–1 for gauge using user calibration: boneDry = dry reading, submerged = wet reading.
 * If either is missing, falls back to default range.
 */
export function soilRawToGaugeCalibrated(
  raw: number,
  boneDry: number | null | undefined,
  submerged: number | null | undefined
): number {
  if (boneDry != null && submerged != null && boneDry !== submerged) {
    const min = Math.min(boneDry, submerged)
    const max = Math.max(boneDry, submerged)
    const clamped = Math.max(min, Math.min(max, raw))
    return 1 - (clamped - min) / (max - min)
  }
  return soilRawToGauge(raw)
}
