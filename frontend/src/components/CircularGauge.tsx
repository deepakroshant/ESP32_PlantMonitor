type CircularGaugeProps = {
  /** 0–100 */
  percentage: number
  label: string
  size?: number
  strokeWidth?: number
}

export function CircularGauge({ percentage, label, size = 180, strokeWidth = 11 }: CircularGaugeProps) {
  const r             = (size - strokeWidth) / 2
  const cx            = size / 2
  const cy            = size / 2
  const circumference = 2 * Math.PI * r
  const clamped       = Math.max(0, Math.min(100, percentage))
  const offset        = circumference - (clamped / 100) * circumference

  const activeColor =
    clamped > 70 ? '#34D399'   // emerald-400 — healthy
    : clamped > 30 ? '#6EE7B7' // emerald-300 — OK
    : clamped > 10 ? '#FBBF24' // amber-400 — dry
    : '#F87171'                 // red-400 — very dry

  const gradientId = `gauge-grad-${Math.round(clamped)}`

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-hidden="true"
          style={{ filter: `drop-shadow(0 0 10px ${activeColor}28)` }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={activeColor} stopOpacity={1}    />
              <stop offset="100%" stopColor={activeColor} stopOpacity={0.50} />
            </linearGradient>
          </defs>

          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(27,47,39,0.06)"
            strokeWidth={strokeWidth}
          />

          {/* Progress arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display tabular-nums text-forest"
            style={{ fontSize: size > 140 ? '2.4rem' : '1.75rem', fontWeight: 700, lineHeight: 1 }}
            aria-label={`${Math.round(clamped)} percent`}
          >
            {Math.round(clamped)}%
          </span>
          <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-forest/45">
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
