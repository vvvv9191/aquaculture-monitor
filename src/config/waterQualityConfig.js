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
  { key: 'temperature', label: '水温', shortLabel: '水温', unit: '℃', decimals: 1, icon: '🌡', color: '#35d5c5' },
  { key: 'ph', label: 'pH', shortLabel: 'pH', unit: '', decimals: 2, icon: 'pH', color: '#5ca8ff' },
  { key: 'dissolvedOxygen', label: '溶解氧', shortLabel: 'DO', unit: 'mg/L', decimals: 1, icon: 'O₂', color: '#6de2ff' },
  { key: 'ammoniaNitrogen', label: '氨氮', shortLabel: '氨氮', unit: 'mg/L', decimals: 2, icon: 'NH₃', color: '#f7b955' },
  { key: 'salinity', label: '盐度', shortLabel: '盐度', unit: '‰', decimals: 1, icon: '‰', color: '#8c9eff' },
  { key: 'nitrite', label: '亚硝酸盐', shortLabel: '亚硝酸盐', unit: 'mg/L', decimals: 2, icon: 'NO₂', color: '#e983ff' },
]

export const DEFAULT_WATER_QUALITY_SETTINGS = {
  temperature: { min: 18, max: 30 },
  ph: { min: 7.0, max: 8.5 },
  dissolvedOxygen: { yellow: 5.0, orange: 4.5, red: 4.0, aeratorOn: 5.2, aeratorOff: 6.2 },
  ammoniaNitrogen: { warning: 0.2 },
  salinity: { min: 5, max: 12 },
  nitrite: { warning: 0.1 },
}

// 兼容第一阶段 Dashboard 组件使用的字段。
export const WATER_QUALITY_METRICS_WITH_DEFAULTS = WATER_QUALITY_METRICS.map((metric) => {
  const setting = DEFAULT_WATER_QUALITY_SETTINGS[metric.key]
  if (metric.key === 'dissolvedOxygen') return { ...metric, min: setting.yellow, max: 9, warningMin: 5.5, warningMax: 8.5, criticalMin: setting.red, criticalMax: 11 }
  if ('warning' in setting) return { ...metric, min: 0, max: setting.warning, warningMin: 0, warningMax: setting.warning * 0.8, criticalMin: 0, criticalMax: setting.warning * 2.5 }
  return { ...metric, min: setting.min, max: setting.max, warningMin: setting.min, warningMax: setting.max, criticalMin: setting.min * 0.85, criticalMax: setting.max * 1.15 }
})

export const DEVICE_CONTROL_CONFIG = {
  aerator: {
    label: '1号增氧机',
    lowThreshold: DEFAULT_WATER_QUALITY_SETTINGS.dissolvedOxygen.aeratorOn,
    highThreshold: DEFAULT_WATER_QUALITY_SETTINGS.dissolvedOxygen.aeratorOff,
  },
  pump: { label: '循环水泵' },
}

export const CULTURE_OPTIONS = {
  species: ['南美白对虾', '中国对虾', '海参', '半滑舌鳎'],
  stages: ['苗期', '生长期', '成熟期'],
}

export const getMetricConfig = (key) => WATER_QUALITY_METRICS.find((metric) => metric.key === key)
export const getPond = (pondId) => PONDS.find((pond) => pond.id === pondId)
