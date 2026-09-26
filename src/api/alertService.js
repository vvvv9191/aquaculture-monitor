import { createMockAlerts } from '../mock/alerts'
import { WATER_QUALITY_METRICS } from '../config/waterQualityConfig'
import { evaluateMetric, getAlertDescription, getNormalRange } from '../utils/alert'

export const alertService = {
  async getAlerts() {
    return createMockAlerts()
  },
  evaluatePoint(point, settings) {
    return WATER_QUALITY_METRICS.map((metric) => {
      const level = evaluateMetric(metric.key, point[metric.key], settings)
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
    // 后续替换为 PATCH /api/alerts/{alertId}
    return { alertId, status, success: true }
  },
}
