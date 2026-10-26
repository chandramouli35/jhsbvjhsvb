export function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
}

export function formatPower(value, digits = 0) {
  if (!isFiniteNumber(value)) return "—"
  const sign = value < 0 ? "−" : ""
  const absolute = Math.abs(value)
  return `${sign}${absolute.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} MW`
}

export function formatSignedPower(value, digits = 0) {
  if (!isFiniteNumber(value)) return "—"
  if (value > 0) return `+${formatPower(value, digits)}`
  return formatPower(value, digits)
}

export function formatEnergy(mwh) {
  if (!isFiniteNumber(mwh)) return "—"
  const sign = mwh < 0 ? "−" : ""
  const absolute = Math.abs(mwh)
  if (absolute >= 1_000_000) {
    return `${sign}${(absolute / 1_000_000).toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} TWh`
  }
  if (absolute >= 1_000) {
    return `${sign}${(absolute / 1_000).toLocaleString("en-GB", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} GWh`
  }
  return `${sign}${absolute.toLocaleString("en-GB", { maximumFractionDigits: 0 })} MWh`
}

export function formatPercent(value) {
  if (!isFiniteNumber(value)) return "—"
  return `${value.toLocaleString("en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

export function formatCount(value) {
  if (!isFiniteNumber(value)) return "—"
  return Math.round(value).toLocaleString("en-GB")
}

export function formatCompactMw(value) {
  if (!isFiniteNumber(value)) return ""
  const sign = value < 0 ? "−" : ""
  const absolute = Math.abs(value)
  if (absolute >= 1000) return `${sign}${(absolute / 1000).toFixed(1)}k`
  return `${sign}${Math.round(absolute)}`
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function formatDay(isoDate) {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

export function formatWeekday(isoDate) {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
  return WEEKDAYS[date.getUTCDay()]
}

export function formatClock(iso) {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`
}

export function formatSettlement(iso, period) {
  const date = new Date(iso)
  const startHour = date.getUTCHours()
  const startMinute = date.getUTCMinutes()
  const endTotal = startHour * 60 + startMinute + 30
  const endHour = Math.floor(endTotal / 60) % 24
  const endMinute = endTotal % 60
  const pad = (value) => String(value).padStart(2, "0")
  return `${formatWeekday(iso)} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} · SP ${period} · ${pad(startHour)}:${pad(startMinute)}–${pad(endHour)}:${pad(endMinute)} UTC`
}

export function axisInterval(count) {
  if (count <= 8) return 0
  const targetTicks = count > 400 ? 7 : 6
  return Math.max(1, Math.ceil(count / targetTicks) - 1)
}

export function tickLabel(iso, count) {
  const date = new Date(iso)
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  if (count <= 48) return `${hours}:${minutes}`
  if (count <= 48 * 4) return `${date.getUTCDate()} ${hours}:${minutes}`
  return `${date.getUTCDate()} Jan`
}

export function downloadSeries(points, start, end, gate) {
  const columns = [
    "start_time",
    "settlement_date",
    "settlement_period",
    "actual_mw",
    "day_ahead_mw",
    "day_ahead_publish_time",
    "intraday_mw",
    "intraday_publish_time",
    "error_mw",
    "shortfall_mw",
    "surplus_mw",
    "shortfall_mwh",
    "surplus_mwh",
  ]
  const lines = [columns.join(",")]
  for (const point of points) {
    lines.push(columns.map((column) => (point[column] ?? "")).join(","))
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `windgate_${start}_${end}_gate${gate.replace(":", "")}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
