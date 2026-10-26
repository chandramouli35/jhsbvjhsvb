import { Activity, Flame, Gauge, Scale, TrendingUp, Waves, Wind, Zap } from "lucide-react"
import { formatCount, formatEnergy, formatPercent, formatPower, formatSignedPower, isFiniteNumber } from "../format"

export default function KpiGrid({ summary }) {
  if (!summary) return null
  const latest = summary.latest_period
  const cards = [
    {
      label: "Total wind generation",
      value: formatEnergy(summary.total_actual_generation_mwh),
      hint: `${formatCount(summary.periods)} half-hours · metered FUELHH`,
      icon: Wind,
      tone: "text-wind",
    },
    {
      label: "Gate forecast",
      value: formatEnergy(summary.latest_forecast_mwh),
      hint: latest
        ? `${summary.day_ahead_vintage || "—"} UTC run · last period ${formatPower(latest.day_ahead_mw)}`
        : "Latest publication before gate closure",
      icon: Gauge,
      tone: "text-gate",
    },
    {
      label: "MAE",
      value: formatPower(summary.mae_mw),
      hint: isFiniteNumber(summary.intraday_mae_mw)
        ? `Intraday MAE ${formatPower(summary.intraday_mae_mw)}`
        : "Mean absolute error",
      icon: Activity,
      tone: "text-foam",
    },
    {
      label: "RMSE",
      value: formatPower(summary.rmse_mw),
      hint: "Penalises the large misses",
      icon: TrendingUp,
      tone: "text-foam",
    },
    {
      label: "MAPE",
      value: formatPercent(summary.mape_pct),
      hint: `Energy-weighted ${formatPercent(summary.wape_pct)}`,
      icon: Scale,
      tone: "text-foam",
    },
    {
      label: "Bias",
      value: formatSignedPower(summary.bias_mw),
      hint: summary.bias_mw > 0 ? "Forecast above metered wind" : "Forecast below metered wind",
      icon: Zap,
      tone: summary.bias_mw > 25 ? "text-short" : summary.bias_mw < -25 ? "text-wind" : "text-foam",
    },
    {
      label: "Thermal procurement",
      value: formatEnergy(summary.recommended_thermal_procurement_mwh),
      hint: `P90 reserve ${formatPower(summary.recommended_reserve_mw_p90)} · avg ${formatPower(summary.mean_shortfall_mw)}`,
      icon: Flame,
      tone: "text-short",
    },
    {
      label: "Wind surplus",
      value: formatEnergy(summary.surplus_mwh),
      hint: `${formatCount(summary.surplus_periods)} periods above the gate forecast`,
      icon: Waves,
      tone: "text-wind",
    },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="panel px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="kicker">{card.label}</p>
            <card.icon className="h-4 w-4 text-mist" aria-hidden="true" />
          </div>
          <p className={`mt-3 font-serif text-[1.65rem] leading-none ${card.tone}`}>{card.value}</p>
          <p className="mt-2 min-h-8 text-xs leading-5 text-mist">{card.hint}</p>
        </article>
      ))}
    </section>
  )
}
