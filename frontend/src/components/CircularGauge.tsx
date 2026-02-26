type CircularGaugeProps = {
  /** 0–100 */
  percentage: number
  label: string
  size?: number
  strokeWidth?: number
}

export function CircularGauge({ percentage, label, size = 170, strokeWidth = 10 }: CircularGaugeProps) {
  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, percentage))
  const offset = circumference - (clamped / 100) * circumference

  const hue = 100 + clamped * 0.3
  const activeColor = clamped > 70 ? '#22C55E' : clamped > 30 ? '#4ADE80' : clamped > 10 ? '#F59E0B' : '#EF4444'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={`gauge-grad-${hue}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={activeColor} stopOpacity={0.9} />
              <stop offset="100%" stopColor={activeColor} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-forest/6"
          />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`url(#gauge-grad-${hue})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${activeColor}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-bold tabular-nums text-forest">
            {Math.round(clamped)}%
          </span>
          <span className="mt-1 text-xs font-medium uppercase tracking-wider text-forest/45">
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
