import { DEFAULT_WATER_QUALITY_SETTINGS, WATER_QUALITY_METRICS } from '../config/waterQualityConfig'

const clone = (value) => JSON.parse(JSON.stringify(value))
const toNumberOrNull = (value, fallback = null) => {
  if (value === '' || value === null || value === undefined) return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : value
}
const toBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') return value !== 'false'
  return Boolean(value)
}

function hasLegacyMetricShape(rule) {
  return Boolean(rule && (
    'normalMin' in rule || 'normalMax' in rule || 'yellowMin' in rule || 'yellowMax' in rule ||
    'orangeMin' in rule || 'orangeMax' in rule || 'redMin' in rule || 'redMax' in rule ||
    rule.yellow || rule.orange || rule.red
  ))
}

export function isLegacyThresholdSettings(input = {}) {
  return WATER_QUALITY_METRICS.some(({ key }) => hasLegacyMetricShape(input?.[key]))
}

function readLegacyBoundary(source, side, color, bound, fallback) {
  const flatKey = `${color}${side === 'low' ? 'Min' : 'Max'}`
  const nested = source?.[color]?.[bound]
  const value = source?.[flatKey] ?? nested
  return toNumberOrNull(value, fallback)
}

function normalizeMetricRule(source = {}, fallback) {
  const hasNewShape = source.normal && source.lowWarning && source.highWarning
  if (hasNewShape) {
    return {
      normal: {
        min: toNumberOrNull(source.normal.min, fallback.normal.min),
        max: toNumberOrNull(source.normal.max, fallback.normal.max),
      },
      lowWarning: {
        enabled: toBoolean(source.lowWarning.enabled, fallback.lowWarning.enabled),
        yellow: toNumberOrNull(source.lowWarning.yellow, fallback.lowWarning.yellow),
        orange: toNumberOrNull(source.lowWarning.orange, fallback.lowWarning.orange),
      },
      highWarning: {
        enabled: toBoolean(source.highWarning.enabled, fallback.highWarning.enabled),
        yellow: toNumberOrNull(source.highWarning.yellow, fallback.highWarning.yellow),
        orange: toNumberOrNull(source.highWarning.orange, fallback.highWarning.orange),
      },
    }
  }

  // 兼容旧的 flat 结构和旧的 normal/yellow/orange/red 嵌套结构。
  const hasLegacyShape = hasLegacyMetricShape(source)
  const normalMin = toNumberOrNull(source.normalMin ?? source.normal?.min, fallback.normal.min)
  const normalMax = toNumberOrNull(source.normalMax ?? source.normal?.max, fallback.normal.max)
  const lowYellow = readLegacyBoundary(source, 'low', 'yellow', 'min', fallback.lowWarning.yellow)
  const lowOrange = readLegacyBoundary(source, 'low', 'orange', 'min', fallback.lowWarning.orange)
  const highYellow = readLegacyBoundary(source, 'high', 'yellow', 'max', fallback.highWarning.yellow)
  const highOrange = readLegacyBoundary(source, 'high', 'orange', 'max', fallback.highWarning.orange)
  const lowHasBoundary = lowYellow !== null || lowOrange !== null
  const highHasBoundary = highYellow !== null || highOrange !== null

  return {
    normal: { min: normalMin, max: normalMax },
    lowWarning: {
      enabled: hasLegacyShape ? lowHasBoundary : fallback.lowWarning.enabled,
      yellow: lowYellow,
      orange: lowOrange,
    },
    highWarning: {
      enabled: hasLegacyShape ? highHasBoundary : fallback.highWarning.enabled,
      yellow: highYellow,
      orange: highOrange,
    },
  }
}

export function normalizeThresholdSettings(input = {}) {
  const normalized = {}
  WATER_QUALITY_METRICS.forEach(({ key }) => {
    normalized[key] = normalizeMetricRule(input?.[key] || {}, DEFAULT_WATER_QUALITY_SETTINGS[key])
  })
  return normalized
}

function checkNumber(value, label, errors, allowNull = false) {
  if (allowNull && value === null) return
  if (!Number.isFinite(value) || value < 0) errors.push(`${label}必须是非负数字${allowNull ? '或留空' : ''}`)
}

export function validateThresholdSettings(input) {
  const settings = normalizeThresholdSettings(input)
  const errors = []
  WATER_QUALITY_METRICS.forEach(({ key, label }) => {
    const rule = settings[key]
    checkNumber(rule.normal.min, `${label}正常范围最低值`, errors)
    checkNumber(rule.normal.max, `${label}正常范围最高值`, errors)
    if (Number.isFinite(rule.normal.min) && Number.isFinite(rule.normal.max) && !(rule.normal.min < rule.normal.max)) {
      errors.push(`${label}正常范围设置错误，应满足：正常最低值 < 正常最高值。`)
    }

    if (rule.lowWarning.enabled) {
      checkNumber(rule.lowWarning.yellow, `${label}偏低黄色边界`, errors, true)
      checkNumber(rule.lowWarning.orange, `${label}偏低橙色边界`, errors, true)
      if (rule.lowWarning.yellow === null || rule.lowWarning.orange === null) {
        errors.push(`${label}偏低预警设置错误，启用后必须填写黄色和橙色边界。`)
      } else if (!(rule.lowWarning.orange < rule.lowWarning.yellow && rule.lowWarning.yellow < rule.normal.min)) {
        errors.push(`${label}偏低预警设置错误，应满足：橙色边界 < 黄色边界 < 正常最低值。`)
      }
    }

    if (rule.highWarning.enabled) {
      checkNumber(rule.highWarning.yellow, `${label}偏高黄色边界`, errors, true)
      checkNumber(rule.highWarning.orange, `${label}偏高橙色边界`, errors, true)
      if (rule.highWarning.yellow === null || rule.highWarning.orange === null) {
        errors.push(`${label}偏高预警设置错误，启用后必须填写黄色和橙色边界。`)
      } else if (!(rule.normal.max < rule.highWarning.yellow && rule.highWarning.yellow < rule.highWarning.orange)) {
        errors.push(`${label}偏高预警设置错误，应满足：正常最高值 < 黄色边界 < 橙色边界。`)
      }
    }
  })
  return { valid: errors.length === 0, errors, settings }
}

export function cloneDefaultThresholdSettings() {
  return clone(DEFAULT_WATER_QUALITY_SETTINGS)
}
