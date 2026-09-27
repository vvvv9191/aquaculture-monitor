import { formatDateTime } from './waterQuality'
import { getAlertLevel } from '../utils/alert'

export function createPrediction(current, history = [], settings) {
  const now = new Date()
  const rule = settings.dissolvedOxygen
  const currentDo = Number(current?.dissolvedOxygen || 5.8)
  const drift = currentDo < rule.normal.min ? -0.28 : -0.16
  const hours = [1, 2, 6]
  const points = hours.map((hour) => ({ hour, time: formatDateTime(new Date(now.getTime() + hour * 60 * 60 * 1000)), value: Number(Math.max(2.8, currentDo + drift * hour).toFixed(1)) }))
  const levels = points.map((point) => getAlertLevel('dissolvedOxygen', point.value, settings))
  const riskLevel = levels.includes('red') ? '高风险' : levels.includes('orange') || levels.includes('yellow') ? '中风险' : '低风险'
  const warningPoint = points.find((point) => getAlertLevel('dissolvedOxygen', point.value, settings) !== 'normal')
  return { metricKey: 'dissolvedOxygen', current: currentDo, points, riskLevel, warningTime: warningPoint ? `约 ${warningPoint.hour} 小时后` : '预测期内不会达到', trend: drift < -0.08 ? '下降' : '稳定', simulated: true, generatedAt: formatDateTime(now) }
}
