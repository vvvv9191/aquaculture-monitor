import { DEFAULT_WATER_QUALITY_SETTINGS, getMetricConfig } from '../config/waterQualityConfig'
import { normalizeThresholdSettings } from './thresholds'

export const WARNING_LEVELS = {
  normal: { label: '正常', color: '#38d9a9', className: 'normal' },
  yellow: { label: '黄色预警', color: '#f6c453', className: 'yellow' },
  orange: { label: '橙色预警', color: '#ff8a4c', className: 'orange' },
  red: { label: '红色预警', color: '#ff5d73', className: 'red' },
}

function resolveSettings(settings) {
  if (!settings) return DEFAULT_WATER_QUALITY_SETTINGS
  const firstRule = settings.temperature
  return firstRule?.normal && firstRule?.lowWarning && firstRule?.highWarning
    ? settings
    : normalizeThresholdSettings(settings)
}

function getRule(metricOrKey, settings) {
  const key = typeof metricOrKey === 'string' ? metricOrKey : metricOrKey?.key
  const normalized = resolveSettings(settings)
  return { key, rule: normalized[key], metric: getMetricConfig(key) }
}

/**
 * 统一判断 normal/yellow/orange/red。
 * 边界采用闭区间连接：正常范围优先，其次黄色、橙色，超出橙色边界为红色。
 */
export function evaluateWarning(metricOrKey, value, settings = DEFAULT_WATER_QUALITY_SETTINGS) {
  const { rule } = getRule(metricOrKey, settings)
  const number = Number(value)
  if (!rule || value === null || value === undefined || !Number.isFinite(number)) return 'normal'

  if (number >= rule.normal.min && number <= rule.normal.max) return 'normal'

  if (number < rule.normal.min) {
    if (!rule.lowWarning.enabled) return 'normal'
    if (number >= rule.lowWarning.yellow) return 'yellow'
    if (number >= rule.lowWarning.orange) return 'orange'
    return 'red'
  }

  if (!rule.highWarning.enabled) return 'normal'
  if (number <= rule.highWarning.yellow) return 'yellow'
  if (number <= rule.highWarning.orange) return 'orange'
  return 'red'
}

export function getWarningRule(metricOrKey, settings = DEFAULT_WATER_QUALITY_SETTINGS) {
  return getRule(metricOrKey, settings).rule
}

export function getWarningDirection(metricOrKey, value, settings = DEFAULT_WATER_QUALITY_SETTINGS) {
  const { rule } = getRule(metricOrKey, settings)
  const number = Number(value)
  if (!rule || !Number.isFinite(number) || number >= rule.normal.min && number <= rule.normal.max) return 'normal'
  if (number < rule.normal.min) return rule.lowWarning.enabled ? 'low' : 'normal'
  return rule.highWarning.enabled ? 'high' : 'normal'
}
