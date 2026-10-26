import { formatCount, formatEnergy, formatPercent, formatPower, isFiniteNumber } from "../format"

export default function Narrative({ summary, gate }) {
  if (!summary || summary.periods_with_day_ahead === 0) {
    return (
      <section className="panel px-5 py-4 text-sm text-mist">
        No day-ahead forecast was published before {gate} UTC for this window.
      </section>
    )
  }

  const vintage = summary.day_ahead_vintage
  const share = summary.day_ahead_vintage_share
  const vintageText =
    vintage && share >= 0.99
      ? `The ${gate} UTC gate locks the ${vintage} UTC WINDFOR run for this window.`
      : `The ${gate} UTC gate most often locks the ${vintage} UTC WINDFOR run (${formatPercent((share || 0) * 100)} of periods).`

  let biasText = "Across these settlement periods the gate forecast was effectively unbiased."
  if (summary.bias_mw > 25) {
    biasText = `It ran ${formatPower(summary.bias_mw)} high on average, which left the desk short of wind.`
  } else if (summary.bias_mw < -25) {
    biasText = `It ran ${formatPower(Math.abs(summary.bias_mw))} low on average, so more wind arrived than the day-ahead position assumed.`
  }

  const thermal = `Thermal and balancing energy required to replace that missing wind: ${formatEnergy(summary.recommended_thermal_procurement_mwh)}, across ${formatCount(summary.shortfall_periods)} of ${formatCount(summary.periods)} half-hours.`

  let revision = ""
  if (isFiniteNumber(summary.intraday_mae_mw) && isFiniteNumber(summary.mae_mw)) {
    if (summary.intraday_mae_mw + 1 < summary.mae_mw) {
      revision = ` Forecasts published after the gate reduced MAE from ${formatPower(summary.mae_mw)} to ${formatPower(summary.intraday_mae_mw)}. Those later runs were issued after the day-ahead order book had closed.`
    } else {
      revision = ` Forecasts published after the gate had MAE of ${formatPower(summary.intraday_mae_mw)}, compared with ${formatPower(summary.mae_mw)} at the gate.`
    }
  }

  return (
    <section className="panel px-5 py-4 text-sm leading-6 text-mist">
      <p>
        <span className="text-foam">{vintageText}</span> {biasText} {thermal}
        {revision}
      </p>
    </section>
  )
}
