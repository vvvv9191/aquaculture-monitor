import { WATER_QUALITY_METRICS } from '../config/waterQualityConfig'
import { evaluateWarning, getWarningDirection, getWarningRule } from '../utils/warningEvaluator'

const LEVEL_PRIORITY = { normal: 0, yellow: 1, orange: 2, red: 3 }
const LEVEL_LABELS = { yellow: '黄色', orange: '橙色', red: '红色' }

function hasNumber(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
}

function slugify(value) {
  return encodeURIComponent(String(value || '').trim()).replace(/%/g, '_')
}

function metricValue(point, metric) {
  return point?.[metric.key]
}

function metricDetails(metric, settings) {
  const rule = getWarningRule(metric.key, settings)
  return {
    normalRange: rule ? `${rule.normal.min}～${rule.normal.max}${metric.unit ? ` ${metric.unit}` : ''}` : '--',
    yellowBoundary: rule ? { low: rule.lowWarning.yellow, high: rule.highWarning.yellow } : { low: null, high: null },
    orangeBoundary: rule ? { low: rule.lowWarning.orange, high: rule.highWarning.orange } : { low: null, high: null },
  }
}

function directionText(direction) {
  return direction === 'low' ? '偏低' : direction === 'high' ? '偏高' : '正常'
}

function buildCommonAlert({ farm, metric, value, level, direction, time, source, settings }) {
  const details = metricDetails(metric, settings)
  return {
    farm,
    metric: metric.key,
    metricKey: metric.key,
    metricLabel: metric.label,
    value: Number(value),
    unit: metric.unit,
    level,
    direction,
    directionLabel: directionText(direction),
    time,
    normalRange: details.normalRange,
    yellowBoundary: direction === 'low' ? details.yellowBoundary.low : details.yellowBoundary.high,
    orangeBoundary: direction === 'low' ? details.orangeBoundary.low : details.orangeBoundary.high,
    reason: `${metric.label}${direction === 'low' ? '低于' : '高于'}正常范围`,
    source,
    type: source,
  }
}

export function evaluateRealtimeAlerts({ points = [], settings }) {
  // 历史数据分析“全部数据”范围：每条记录的六项指标逐项生成告警记录，不再只取最新一条。
  return points.flatMap((point) => {
    const farm = String(point.farmName || point.farm || '').trim()
    if (!farm) return []
    return WATER_QUALITY_METRICS.flatMap((metric) => {
      const value = metricValue(point, metric)
      if (!hasNumber(value)) return []
      const level = evaluateWarning(metric.key, value, settings)
      if (level === 'normal') return []
      const direction = getWarningDirection(metric.key, value, settings)
      return [{
        id: `history-${slugify(farm)}-${metric.key}-${slugify(point.id || point.time || point.timestamp)}`,
        ...buildCommonAlert({ farm, metric, value, level, direction, time: point.time, source: 'history', settings }),
        pondId: point.pondId,
        status: '未处理',
      }]
    })
  })
}

function sortForecastPoints(points = []) {
  return [...points].sort((a, b) => {
    const timeA = new Date(a.time || '').getTime()
    const timeB = new Date(b.time || '').getTime()
    return (Number.isFinite(timeA) ? timeA : 0) - (Number.isFinite(timeB) ? timeB : 0)
  })
}

function mergeMetricForecastAlerts({ farmData, metric, settings, farmIndex }) {
  const points = sortForecastPoints(farmData?.predictions || [])
  const model = farmData?.modelTypes?.[metric.dataKey] || '未配置'
  const events = []
  let active = null

  const closeActive = () => {
    if (!active) return
    const highest = active.level
    const highestEntry = active.entries[highest] || active.entries[active.firstLevel]
    active.forecastTime = highestEntry.time
    active.predictedValue = highestEntry.value
    active.value = highestEntry.value
    active.horizonHours = highestEntry.horizonHours
    active.lastForecastTime = active.lastPoint.time
    active.id = `forecast-${slugify(active.farm)}-${metric.key}-${farmIndex}-${active.sequence}`
    events.push(active)
    active = null
  }

  points.forEach((point, pointIndex) => {
    const value = point?.[metric.dataKey]
    const level = hasNumber(value) ? evaluateWarning(metric.key, value, settings) : 'normal'
    if (level === 'normal') {
      closeActive()
      return
    }

    const direction = getWarningDirection(metric.key, value, settings)
    const forecastTime = point.time || '--'
    const entry = { time: forecastTime, value: Number(value), level, horizonHours: Number(point.horizonHours ?? point.hour ?? 0) }
    if (!active) {
      active = {
        farm: farmData.farm,
        metric: metric.key,
        metricKey: metric.key,
        metricLabel: metric.label,
        unit: metric.unit,
        source: 'forecast',
        type: 'forecast',
        level,
        direction,
        directionLabel: directionText(direction),
        firstLevel: level,
        startedAt: forecastTime,
        lastPoint: entry,
        entries: { [level]: entry },
        sequence: pointIndex,
        model,
        normalRange: metricDetails(metric, settings).normalRange,
        yellowBoundary: direction === 'low' ? metricDetails(metric, settings).yellowBoundary.low : metricDetails(metric, settings).yellowBoundary.high,
        orangeBoundary: direction === 'low' ? metricDetails(metric, settings).orangeBoundary.low : metricDetails(metric, settings).orangeBoundary.high,
        reason: `${metric.label}${direction === 'low' ? '低于' : '高于'}正常范围`,
      }
      return
    }

    active.lastPoint = entry
    if (!active.entries[level]) active.entries[level] = entry
    if (LEVEL_PRIORITY[level] > LEVEL_PRIORITY[active.level]) {
      active.level = level
      active.direction = direction
      active.directionLabel = directionText(direction)
      active.reason = `${metric.label}${direction === 'low' ? '低于' : '高于'}正常范围`
      const details = metricDetails(metric, settings)
      active.yellowBoundary = direction === 'low' ? details.yellowBoundary.low : details.yellowBoundary.high
      active.orangeBoundary = direction === 'low' ? details.orangeBoundary.low : details.orangeBoundary.high
    }
  })
  closeActive()

  return events.map((event) => ({
    ...event,
    forecastTime: event.forecastTime,
    horizonHours: event.horizonHours,
    predictedValue: event.predictedValue,
    escalationTimes: {
      yellow: event.entries.yellow?.time || null,
      orange: event.entries.orange?.time || null,
      red: event.entries.red?.time || null,
    },
    status: '待观察',
  }))
}

export function evaluateForecastAlerts({ forecastData, settings }) {
  const alerts = (forecastData?.farms || []).flatMap((farmData, index) => WATER_QUALITY_METRICS.flatMap((metric) => mergeMetricForecastAlerts({ farmData, metric, settings, farmIndex: index })))
  return mergeContinuousAlerts(alerts)
}

export function mergeContinuousAlerts(alerts = []) {
  const merged = []
  const ordered = [...alerts].sort((a, b) => {
    const timeA = new Date(a.startedAt || a.forecastTime || a.time || '').getTime()
    const timeB = new Date(b.startedAt || b.forecastTime || b.time || '').getTime()
    return (Number.isFinite(timeA) ? timeA : 0) - (Number.isFinite(timeB) ? timeB : 0)
  })
  ordered.forEach((alert) => {
    const previous = merged.at(-1)
    const sameSeries = previous && alert.source === 'forecast' && previous.source === 'forecast' && previous.farm === alert.farm && previous.metric === alert.metric
    const overlaps = sameSeries && previous.lastForecastTime && alert.startedAt && new Date(alert.startedAt).getTime() <= new Date(previous.lastForecastTime).getTime()
    if (!overlaps) {
      merged.push({ ...alert })
      return
    }
    if (LEVEL_PRIORITY[alert.level] > LEVEL_PRIORITY[previous.level]) {
      previous.level = alert.level
      previous.forecastTime = alert.forecastTime
      previous.predictedValue = alert.predictedValue
      previous.direction = alert.direction
      previous.directionLabel = alert.directionLabel
    }
    previous.lastForecastTime = alert.lastForecastTime || previous.lastForecastTime
    previous.escalationTimes = { ...previous.escalationTimes, ...alert.escalationTimes }
  })
  return merged
}

export function getAlertSummary(alerts = []) {
  return {
    realtime: alerts.filter((alert) => alert.source === 'history' || alert.source === 'realtime').length,
    forecast: 0,
    yellow: alerts.filter((alert) => alert.level === 'yellow').length,
    orange: alerts.filter((alert) => alert.level === 'orange').length,
    red: alerts.filter((alert) => alert.level === 'red').length,
    unhandled: alerts.filter((alert) => !['已处理', '已解除'].includes(alert.status)).length,
  }
}

export { LEVEL_PRIORITY, LEVEL_LABELS }
