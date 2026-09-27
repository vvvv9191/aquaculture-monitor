import { getMetricConfig } from '../config/waterQualityConfig'
import { evaluateWarning, getWarningDirection, getWarningRule, WARNING_LEVELS } from './warningEvaluator'

export const ALERT_LEVELS = WARNING_LEVELS

// 兼容现有页面和 Service 的旧函数名，真正判断统一放在 warningEvaluator。
export function getAlertLevel(metricOrKey, value, settings) {
  return evaluateWarning(metricOrKey, value, settings)
}

export const evaluateMetric = getAlertLevel

export function getNormalRange(key, settings) {
  const metric = getMetricConfig(key)
  const rule = getWarningRule(key, settings)
  if (!metric || !rule) return '--'
  return `${rule.normal.min}～${rule.normal.max} ${metric.unit}`.trim()
}

export function getAlertDescription(key, value, settings) {
  const metric = getMetricConfig(key)
  const rule = getWarningRule(key, settings)
  if (!metric || !rule) return { reason: '指标异常', suggestion: '请检查传感器和水体状态' }

  const direction = getWarningDirection(key, value, settings)
  const isLow = direction === 'low'
  if (key === 'dissolvedOxygen') return { reason: isLow ? `${metric.label}过低` : `${metric.label}过高`, suggestion: isLow ? '检查增氧设备并及时增氧' : '检查水体交换和传感器状态' }
  if (key === 'ammoniaNitrogen' || key === 'nitrite') return { reason: `${metric.label}浓度过高`, suggestion: '检查生物过滤并适量换水' }
  return { reason: `${metric.label}${isLow ? '过低' : '过高'}`, suggestion: '检查水体环境并校准传感器' }
}

export function getRecordStatus(record, settings) {
  return getAlertLevel(record.metricKey, record.value, settings)
}
