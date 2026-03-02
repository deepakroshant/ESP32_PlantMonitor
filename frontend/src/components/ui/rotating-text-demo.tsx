import { RotatingText } from "./rotating-text";

const words = ["faster", "better", "smarter", "together"];

export default function RotatingTextDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-20 bg-surface px-6 py-20 dark:bg-forest-900">
      {/* Hero showcase */}
      <div className="text-center space-y-4">
        <p className="text-sm font-medium tracking-widest uppercase text-forest-400 dark:text-forest-500">
          5 animation modes
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-forest dark:text-forest-100">
          Build{" "}
          <RotatingText
            words={words}
            mode="slide"
            className="text-primary dark:text-primary-400"
          />
        </h1>
      </div>

      {/* All modes grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-3xl">
        {(["slide", "fade", "blur", "flip", "drop"] as const).map((mode, i) => (
          <div
            key={mode}
            className="flex flex-col items-center gap-3 rounded-2xl border border-forest/10 dark:border-forest-700 bg-white/80 dark:bg-forest-800/80 p-8 backdrop-blur-sm"
          >
            <span className="text-[11px] font-semibold tracking-widest uppercase text-forest-400 dark:text-forest-500">
              {mode}
            </span>
            <p className="text-xl font-bold tracking-tight text-forest dark:text-forest-100">
              Ship{" "}
              <RotatingText
                words={["today", "now", "fast", "more"]}
                mode={mode}
                interval={2000 + i * 300}
                className="text-primary dark:text-primary-400"
              />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
