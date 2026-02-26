/** Leaf/plant icon for hero section */
export function PlantIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Stem */}
      <path d="M12 20V10" />
      {/* Left leaf */}
      <path d="M12 10c-2.5 0-5 1.5-6 4-.4.8 0 1.6.6 2 1.5.8 3.4.2 4.6-1.2" />
      {/* Right leaf */}
      <path d="M12 10c2.5 0 5 1.5 6 4 .4.8 0 1.6-.6 2-1.5.8-3.4.2-4.6-1.2" />
    </svg>
  )
}
