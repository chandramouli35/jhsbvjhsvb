const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function get(path, signal) {
  const response = await fetch(`${BASE}${path}`, {
    signal,
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = await response.json()
      if (typeof body.detail === "string") detail = body.detail
      else if (Array.isArray(body.detail)) detail = body.detail.map((item) => item.msg).join(" ")
    } catch {
      detail = response.statusText
    }
    throw new Error(detail || "Request failed")
  }
  return response.json()
}

export function fetchDashboard({ start, end, gate, signal }) {
  const query = new URLSearchParams({ start, end, gate })
  const range = query.toString()
  return Promise.all([
    get(`/api/summary?${range}`, signal),
    get(`/api/timeseries?${range}`, signal),
    get(`/api/accuracy?${range}`, signal),
    get(`/api/gates?${new URLSearchParams({ start, end })}`, signal),
    get("/api/meta", signal),
  ]).then(([summary, timeseries, accuracy, gates, meta]) => ({
    summary,
    timeseries,
    accuracy,
    gates,
    meta,
  }))
}
