export default function Methodology({ clocks }) {
  const observed = clocks?.length ? clocks.join(", ") : "02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30"
  return (
    <details className="panel px-5 py-4 text-sm leading-6 text-mist">
      <summary className="cursor-pointer font-medium text-foam">How the gate, the error, and the thermal volume are defined</summary>
      <div className="mt-3 space-y-3">
        <p>
          Actuals are Elexon FUELHH, fuel type WIND: average MW over each 30-minute settlement period. Forecasts are Elexon WINDFOR,
          which in this month is an hourly series. Each hourly value is held across the two settlement periods inside that hour, so the
          energy is unchanged.
        </p>
        <p>
          For every settlement period on delivery day D, the operational baseline is the latest WINDFOR publication strictly before the
          chosen gate on D−1. Publications in this file land at {observed} UTC. An 11:00 gate therefore keeps the 09:30 run. A 12:00 gate
          also admits 11:30. The EPEX hourly auction at 09:20 is earlier than the 09:30 run, so that desk is still on the 07:30 forecast.
          N2EX, closing at 09:50, can use 09:30.
        </p>
        <p>
          The intraday line is the latest run published after the gate and before the settlement period begins. It is the revision a
          control room could see. It is not a number the day-ahead bid can use.
        </p>
        <p className="font-mono text-xs text-foam">
          MAE = mean(|F − A|) · RMSE = sqrt(mean((F − A)²)) · MAPE = mean(|F − A| / |A|) · Bias = mean(F − A)
        </p>
        <p>
          F is the gate forecast in MW and A is metered wind. Positive bias means the forecast was high. Shortfall energy is the sum of
          max(F − A, 0) × 0.5 h. That is the thermal or balancing volume required to bridge the gap. The P90 reserve is the 90th percentile
          of those half-hourly shortfalls, a standing buffer for a similar day. January 2026 is GMT for the whole month, so UTC and UK
          settlement time match. A summer month would need Europe/London.
        </p>
      </div>
    </details>
  )
}
