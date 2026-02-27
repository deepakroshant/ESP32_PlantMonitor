/** Plant icon — stem with leaves (leaf shapes point down/out, not up like umbrella) */
export function PlantIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Main stem */}
      <path d="M12 21V11" />
      {/* Left leaf — curves down and out */}
      <path d="M12 11c-2 1-4 2.5-4 5" />
      {/* Right leaf */}
      <path d="M12 11c2 1 4 2.5 4 5" />
      {/* Top pair — small leaves at stem tip */}
      <path d="M12 11l-2-3" />
      <path d="M12 11l2-3" />
    </svg>
  )
}
