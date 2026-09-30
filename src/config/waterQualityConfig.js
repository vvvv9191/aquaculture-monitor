export const FARM_INFO = {
  id: 'FARM-TJ-001',
  name: '天津市滨海新区志敏养殖场',
  location: '天津市滨海新区水产养殖监测',
}

export const PONDS = [
  { id: 'POND-01', name: '1号养殖池', deviceId: 'TJ-AQ-001' },
  { id: 'POND-02', name: '2号养殖池', deviceId: 'TJ-AQ-002' },
  { id: 'POND-03', name: '3号养殖池', deviceId: 'TJ-AQ-003' },
]

export const WATER_QUALITY_METRICS = [
  { key: 'temperature', label: '水温', shortLabel: '水温', unit: '℃', decimals: 1, csvFields: ['水温(℃)'], icon: '🌡', color: '#35d5c5' },
  { key: 'ph', label: 'pH', shortLabel: 'pH', unit: '', decimals: 2, csvFields: ['pH(无量纲)'], icon: 'pH', color: '#5ca8ff' },
  { key: 'dissolvedOxygen', label: '溶解氧', shortLabel: 'DO', unit: 'mg/L', decimals: 1, csvFields: ['溶解氧(mg/L)'], icon: 'O₂', color: '#6de2ff' },
  { key: 'ammoniaNitrogen', label: '氨氮', shortLabel: '氨氮', unit: 'mg/L', decimals: 2, csvFields: ['氨氮(mg/L)'], icon: 'NH₃', color: '#f7b955' },
  { key: 'salinity', label: '盐度', shortLabel: '盐度', unit: '‰', decimals: 1, csvFields: ['盐度（‰）', '盐度(‰)'], icon: '‰', color: '#8c9eff' },
  { key: 'nitrite', label: '亚硝酸盐', shortLabel: '亚硝酸盐', unit: 'mg/L', decimals: 2, csvFields: ['亚硝酸盐（mg/L）', '亚硝酸盐(mg/L)'], icon: 'NO₂', color: '#e983ff' },
]

// 每个指标统一使用：正常范围 + 偏低预警 + 偏高预警。
// 红色不单独保存边界，低于橙色边界或高于橙色边界自动进入红色预警。
// 保留原有方向启用状态：氨氮、亚硝酸盐低值侧默认关闭，其余保持原配置。
export const DEFAULT_WATER_QUALITY_SETTINGS = {
  temperature: { normal: { min: 22, max: 30 }, lowWarning: { enabled: true, yellow: 20, orange: 18 }, highWarning: { enabled: true, yellow: 32, orange: 34 } },
  ph: { normal: { min: 7.5, max: 8.5 }, lowWarning: { enabled: true, yellow: 7.0, orange: 6.5 }, highWarning: { enabled: true, yellow: 8.8, orange: 9.0 } },
  dissolvedOxygen: { normal: { min: 5.0, max: 12.0 }, lowWarning: { enabled: true, yellow: 4.5, orange: 4.0 }, highWarning: { enabled: true, yellow: 13.0, orange: 14.0 } },
  ammoniaNitrogen: { normal: { min: 0, max: 0.2 }, lowWarning: { enabled: false, yellow: null, orange: null }, highWarning: { enabled: true, yellow: 0.3, orange: 0.5 } },
  salinity: { normal: { min: 5, max: 12 }, lowWarning: { enabled: true, yellow: 4, orange: 3 }, highWarning: { enabled: true, yellow: 13, orange: 14 } },
  nitrite: { normal: { min: 0, max: 0.1 }, lowWarning: { enabled: false, yellow: null, orange: null }, highWarning: { enabled: true, yellow: 0.15, orange: 0.25 } },
}

// 设备控制规则与水质预警阈值分离，系统设置页面不会修改这里。
export const DEVICE_CONTROL_CONFIG = {
  aerator: { label: '1号增氧机', lowThreshold: 5.2, highThreshold: 6.2 },
  heater: { label: '恒温加热器', lowThreshold: 20, highThreshold: 22 },
  pump: { label: '循环水泵' },
}

export const CULTURE_OPTIONS = {
  species: ['南美白对虾', '中国对虾', '海参', '半滑舌鳎'],
  stages: ['苗期', '生长期', '成熟期'],
}

// 兼容已有 Dashboard/趋势组件使用的 min/max 字段，新页面使用上面的统一字段。
export const WATER_QUALITY_METRICS_WITH_DEFAULTS = WATER_QUALITY_METRICS.map((metric) => {
  const setting = DEFAULT_WATER_QUALITY_SETTINGS[metric.key]
  return { ...metric, min: setting.normal.min, max: setting.normal.max, warningMin: setting.lowWarning.enabled ? setting.lowWarning.yellow : null, warningMax: setting.highWarning.enabled ? setting.highWarning.yellow : null, criticalMin: setting.lowWarning.enabled ? setting.lowWarning.orange : null, criticalMax: setting.highWarning.enabled ? setting.highWarning.orange : null }
})

export const getMetricConfig = (key) => WATER_QUALITY_METRICS.find((metric) => metric.key === key)
export const getPond = (pondId) => PONDS.find((pond) => pond.id === pondId)
