import { PONDS, WATER_QUALITY_METRICS, getPond } from '../config/waterQualityConfig'

const BASELINES = {
  'POND-01': { temperature: 24.8, ph: 7.62, dissolvedOxygen: 5.8, ammoniaNitrogen: 0.12, salinity: 8.2, nitrite: 0.06 },
  'POND-02': { temperature: 25.1, ph: 7.74, dissolvedOxygen: 6.4, ammoniaNitrogen: 0.10, salinity: 8.7, nitrite: 0.05 },
  'POND-03': { temperature: 24.4, ph: 7.58, dissolvedOxygen: 5.6, ammoniaNitrogen: 0.16, salinity: 7.9, nitrite: 0.07 },
}

const BOUNDS = {
  temperature: [21.5, 31.5],
  ph: [6.8, 8.8],
  dissolvedOxygen: [3.7, 8.2],
  ammoniaNitrogen: [0.05, 0.36],
  salinity: [4.5, 13.2],
  nitrite: [0.02, 0.18],
}

const DRIFT = { temperature: 0.32, ph: 0.06, dissolvedOxygen: 0.30, ammoniaNitrogen: 0.018, salinity: 0.22, nitrite: 0.014 }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function createWaterQualityPoint(previous, at = new Date(), pondId = 'POND-01') {
  const pond = getPond(pondId) || PONDS[0]
  const source = previous || BASELINES[pond.id]
  const next = {
    deviceId: pond.deviceId,
    pondId: pond.id,
    pondName: pond.name,
    time: formatDateTime(at),
  }
  WATER_QUALITY_METRICS.forEach((metric) => {
    const value = Number(source[metric.key] ?? BASELINES[pond.id][metric.key]) + (Math.random() - 0.5) * DRIFT[metric.key]
    next[metric.key] = Number(clamp(value, ...BOUNDS[metric.key]).toFixed(metric.decimals))
  })
  next.quality = 'normal'
  return next
}

export function createCurrentSnapshot() {
  return Object.fromEntries(PONDS.map((pond) => [pond.id, createWaterQualityPoint(BASELINES[pond.id], new Date(), pond.id)]))
}

export function createHistory({ pondId = 'POND-01', count = 48, intervalMinutes = 5, endTime = new Date() } = {}) {
  const points = []
  let previous = { ...BASELINES[pondId] }
  for (let index = count - 1; index >= 0; index -= 1) {
    const point = createWaterQualityPoint(previous, new Date(endTime.getTime() - index * intervalMinutes * 60 * 1000), pondId)
    points.push(point)
    previous = point
  }
  return points
}

export function createHistoryByRange(pondId, range = '24h') {
  const presets = {
    '24h': { count: 96, intervalMinutes: 15 },
    '7d': { count: 168, intervalMinutes: 60 },
    '30d': { count: 180, intervalMinutes: 240 },
    custom: { count: 120, intervalMinutes: 60 },
  }
  return createHistory({ pondId, ...(presets[range] || presets['24h']) })
}

export function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
