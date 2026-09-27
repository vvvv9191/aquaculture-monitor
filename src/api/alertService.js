import { WATER_QUALITY_METRICS } from '../config/waterQualityConfig'
import { getAlertDescription, getAlertLevel, getNormalRange } from '../utils/alert'

export const alertService = {
  evaluatePoint(point, settings) {
    return WATER_QUALITY_METRICS.map((metric) => {
      const level = getAlertLevel(metric.key, point[metric.key], settings)
      if (level === 'normal') return null
      const description = getAlertDescription(metric.key, point[metric.key], settings)
      return {
        pondId: point.pondId,
        pondName: point.pondName,
        metricKey: metric.key,
        value: point[metric.key],
        normalRange: getNormalRange(metric.key, settings),
        level,
        ...description,
      }
    }).filter(Boolean)
  },
  async updateStatus(alertId, status) {
    return { alertId, status, success: true }
  },
}
