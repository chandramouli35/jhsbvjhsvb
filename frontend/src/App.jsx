import { useEffect, useState } from "react"
import { fetchDashboard } from "./api"
import Controls from "./components/Controls"
import DailyTable from "./components/DailyTable"
import DailyTrend from "./components/DailyTrend"
import DistributionChart from "./components/DistributionChart"
import GateCompare from "./components/GateCompare"
import GenerationChart from "./components/GenerationChart"
import Header from "./components/Header"
import Heatmap from "./components/Heatmap"
import KpiGrid from "./components/KpiGrid"
import Methodology from "./components/Methodology"
import Narrative from "./components/Narrative"
import ProcurementChart from "./components/ProcurementChart"

export default function App() {
  const [start, setStart] = useState("2026-01-01")
  const [end, setEnd] = useState("2026-01-31")
  const [gate, setGate] = useState("11:00")
  const [bundle, setBundle] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    fetchDashboard({ start, end, gate, signal: controller.signal })
      .then((data) => {
        setBundle(data)
        setLoading(false)
      })
      .catch((reason) => {
        if (reason.name === "AbortError") return
        setError(reason.message || "The desk could not reach the API")
        setLoading(false)
      })
    return () => controller.abort()
  }, [start, end, gate])

  function onStart(value) {
    if (!value) return
    setStart(value)
    if (value > end) setEnd(value)
  }

  function onEnd(value) {
    if (!value) return
    setEnd(value)
    if (value < start) setStart(value)
  }

  const summary = bundle?.summary
  const points = bundle?.timeseries?.points || []
  const coverage = summary?.coverage_pct

  return (
    <div className="mx-auto flex min-h-screen max-w-[1380px] flex-col gap-4 px-4 py-6 md:px-6">
      <Header meta={bundle?.meta} />
      <Controls
        start={start}
        end={end}
        gate={gate}
        gates={bundle?.meta?.gates}
        points={points}
        onStart={onStart}
        onEnd={onEnd}
        onRange={(nextStart, nextEnd) => {
          setStart(nextStart)
          setEnd(nextEnd)
        }}
        onGate={setGate}
      />

      {error && (
        <div className="rounded-2xl border border-short/50 bg-short/10 px-4 py-3 text-sm text-foam" role="alert">
          {error}. The API is expected at <span className="font-mono">/api</span>.
        </div>
      )}

      {!bundle && loading && (
        <div className="panel px-5 py-8 text-sm text-mist" aria-live="polite">
          Loading January 2026 wind actuals and aligning them to the {gate} UTC gate.
        </div>
      )}

      {bundle && (
        <div className={`flex flex-col gap-4 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          {coverage != null && coverage < 99.5 && (
            <div className="rounded-2xl border border-gate/40 bg-gate/10 px-4 py-3 text-sm text-foam">
              Day-ahead coverage for this gate is {coverage}% of settlement periods. Metrics use the periods that had a forecast before the cut-off.
            </div>
          )}
          {loading && <p className="text-xs text-gate">Updating the desk for the new window.</p>}
          <Narrative summary={summary} gate={summary?.gate || gate} />
          <KpiGrid summary={summary} />
          <GateCompare rows={bundle.gates?.gates} gate={gate} onGate={setGate} />
          <GenerationChart points={points} vintages={bundle.timeseries?.vintages} />
          <ProcurementChart points={points} />
          <div className="grid gap-4 xl:grid-cols-2">
            <DistributionChart distribution={bundle.accuracy?.distribution} />
            <DailyTrend daily={bundle.accuracy?.daily} onSelectDay={(day) => { setStart(day); setEnd(day) }} />
          </div>
          <Heatmap periods={bundle.accuracy?.by_settlement_period} />
          <DailyTable daily={bundle.accuracy?.daily} onSelectDay={(day) => { setStart(day); setEnd(day) }} />
          <Methodology clocks={bundle.meta?.publish_clocks_utc} />
        </div>
      )}

      <footer className="pb-4 pt-2 text-xs leading-5 text-mist">
        Actuals: Elexon FUELHH wind. Forecasts: Elexon WINDFOR. Generation is average MW. Energy is MW × 0.5 h.
        Thermal procurement is the wind shortfall versus the gate forecast. This desk does not estimate consumer demand.
        All clocks are UTC, which is UK civil time throughout January 2026.
      </footer>
    </div>
  )
}
