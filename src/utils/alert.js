import { DEFAULT_WATER_QUALITY_SETTINGS, getMetricConfig } from '../config/waterQualityConfig'

export const ALERT_LEVELS = {
  normal: { label: '正常', color: '#38d9a9', className: 'normal' },
  yellow: { label: '黄色预警', color: '#f6c453', className: 'yellow' },
  orange: { label: '橙色预警', color: '#ff8a4c', className: 'orange' },
  red: { label: '红色预警', color: '#ff5d73', className: 'red' },
}

export function evaluateMetric(key, value, settings = DEFAULT_WATER_QUALITY_SETTINGS) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'normal'
  const rule = settings[key]
  if (!rule) return 'normal'
  const number = Number(value)
  if (key === 'dissolvedOxygen') {
    if (number < rule.red) return 'red'
    if (number < rule.orange) return 'orange'
    if (number < rule.yellow) return 'yellow'
    return 'normal'
  }
  if ('warning' in rule) {
    if (number >= rule.warning * 2.5) return 'red'
    if (number >= rule.warning * 1.5) return 'orange'
    if (number > rule.warning) return 'yellow'
    return 'normal'
  }
  if (number >= rule.min && number <= rule.max) return 'normal'
  const span = Math.max(rule.max - rule.min, 0.01)
  const distance = number < rule.min ? rule.min - number : number - rule.max
  if (distance > span * 0.3) return 'red'
  if (distance > span * 0.15) return 'orange'
  return 'yellow'
}

export function getNormalRange(key, settings = DEFAULT_WATER_QUALITY_SETTINGS) {
  const metric = getMetricConfig(key)
  const rule = settings[key]
  if (!metric || !rule) return '--'
  if (key === 'dissolvedOxygen') return `≥ ${rule.yellow} ${metric.unit}`
  if ('warning' in rule) return `≤ ${rule.warning} ${metric.unit}`
  return `${rule.min}～${rule.max} ${metric.unit}`.trim()
}

export function getAlertDescription(key, value, settings = DEFAULT_WATER_QUALITY_SETTINGS) {
  const metric = getMetricConfig(key)
  const rule = settings[key]
  if (!metric || !rule) return { reason: '指标异常', suggestion: '请检查传感器和水体状态' }
  if (key === 'dissolvedOxygen') return { reason: `${metric.label}过低`, suggestion: '检查增氧设备并及时增氧' }
  if ('warning' in rule) return { reason: `${metric.label}浓度过高`, suggestion: key === 'ammoniaNitrogen' ? '减少投喂并检查换水系统' : '检查生物过滤并适量换水' }
  const direction = value < rule.min ? '过低' : '过高'
  return { reason: `${metric.label}${direction}`, suggestion: '检查水体环境并校准传感器' }
}

export function getRecordStatus(record, settings) {
  return evaluateMetric(record.metricKey, record.value, settings)
}
