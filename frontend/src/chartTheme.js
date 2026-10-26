export const axisTick = {
  fill: "#93a8ba",
  fontSize: 11,
  fontFamily: "IBM Plex Mono, ui-monospace, monospace",
}

export const legendStyle = {
  color: "#93a8ba",
  fontSize: 12,
}

export function chartMargin(compact = false) {
  return { top: 12, right: compact ? 8 : 18, left: 0, bottom: 0 }
}
