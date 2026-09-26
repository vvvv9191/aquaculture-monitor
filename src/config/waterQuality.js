// 第一阶段兼容入口。新功能统一从 waterQualityConfig.js 读取配置。
export {
  CULTURE_OPTIONS,
  DEFAULT_WATER_QUALITY_SETTINGS,
  DEVICE_CONTROL_CONFIG,
  FARM_INFO,
  PONDS,
  WATER_QUALITY_METRICS_WITH_DEFAULTS as WATER_QUALITY_METRICS,
  getMetricConfig,
  getPond,
} from './waterQualityConfig'
