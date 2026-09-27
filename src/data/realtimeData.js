// 综合监控大屏的最近90分钟短期监测序列。
// 使用确定性正弦叠加生成平滑、连续、小幅波动的数据，避免 Math.random() 导致刷新后完全变化。
// 两个养殖场各自维护独立序列，量级符合实际养殖环境。
import { FARM_OPTIONS } from '../config/farms'

const KEYS = ['temperature', 'ph', 'dissolvedOxygen', 'ammoniaNitrogen', 'salinity', 'nitrite']

// 每个指标：base 为基准值，amp 为波动幅度，decimals 为保留小数位。
const SERIES_CONFIG = {
  zhimin: {
    temperature: { base: 21.7, amp: 0.35, decimals: 1 },
    ph: { base: 7.75, amp: 0.08, decimals: 2 },
    dissolvedOxygen: { base: 8.95, amp: 0.25, decimals: 1 },
    ammoniaNitrogen: { base: 0.118, amp: 0.006, decimals: 2 },
    salinity: { base: 10.6, amp: 0.12, decimals: 1 },
    nitrite: { base: 0.032, amp: 0.005, decimals: 2 },
  },
  lijinshan: {
    temperature: { base: 21.2, amp: 0.3, decimals: 1 },
    ph: { base: 7.63, amp: 0.07, decimals: 2 },
    dissolvedOxygen: { base: 8.55, amp: 0.28, decimals: 1 },
    ammoniaNitrogen: { base: 0.102, amp: 0.005, decimals: 2 },
    salinity: { base: 11.1, amp: 0.14, decimals: 1 },
    nitrite: { base: 0.028, amp: 0.005, decimals: 2 },
  },
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// 叠加两个不同频率的正弦波，产生平滑且不单调重复的短时波动。
function wave(base, amp, index, phase) {
  return base + amp * Math.sin((index + phase) * 0.42) + amp * 0.5 * Math.sin((index + phase) * 0.17 + 1.3)
}

export function buildRealtimeSeries(farmId, pointCount = 19, intervalMinutes = 5) {
  const config = SERIES_CONFIG[farmId] || SERIES_CONFIG.zhimin
  const phase = farmId === 'lijinshan' ? 2.2 : 0
  const now = Date.now()
  const start = now - (pointCount - 1) * intervalMinutes * 60 * 1000

  return Array.from({ length: pointCount }, (_, index) => {
    const time = formatDateTime(new Date(start + index * intervalMinutes * 60 * 1000))
    const point = { id: `${farmId}-rt-${index}`, time }
    KEYS.forEach((key) => {
      const { base, amp, decimals } = config[key]
      point[key] = Number(wave(base, amp, index, phase).toFixed(decimals))
    })
    return point
  })
}

export function resolveFarm(farmId) {
  return FARM_OPTIONS.find((farm) => farm.id === farmId) || FARM_OPTIONS[0]
}
