import { Wind } from "lucide-react"

export default function Header({ meta }) {
  const periods = meta?.actual_periods
  return (
    <header className="flex flex-col gap-4 border-b border-line/80 pb-5 md:flex-row md:items-end md:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl border border-gate/40 bg-gate/10 text-gate">
          <Wind className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="kicker">GB electricity · day-ahead desk</p>
          <h1 className="font-serif text-4xl leading-none text-foam">Windgate</h1>
          <p className="mt-2 max-w-xl text-sm text-mist">
            National wind the desk could actually buy against, locked before gate closure, then scored against metered generation.
          </p>
        </div>
      </div>
      <div className="text-left md:text-right">
        <p className="font-mono text-sm text-gate">January 2026 · UTC</p>
        <p className="mt-1 text-xs text-mist">
          {periods ? `${periods.toLocaleString("en-GB")} settlement periods` : "Elexon BMRS"} · FUELHH wind · WINDFOR
        </p>
      </div>
    </header>
  )
}
