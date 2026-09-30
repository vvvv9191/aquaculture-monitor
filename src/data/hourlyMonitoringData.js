import { FARM_OPTIONS } from '../config/farms'

// 用户提供的两家养殖场逐项监测值，按提交顺序作为最近五小时的 6 个时间点。
// 6 个点覆盖 5 小时，点间隔 1 小时；没有拼接历史 CSV 或生成随机值。
const FARM_VALUES = {
  zhimin: [
    { temperature: 21.6, ph: 8.28, dissolvedOxygen: 9.46, ammoniaNitrogen: 0.074, salinity: 9.387, nitrite: 0.067 },
    { temperature: 21.9, ph: 8.02, dissolvedOxygen: 8.42, ammoniaNitrogen: 0.291, salinity: 9.415, nitrite: 0.205 },
    { temperature: 22.5, ph: 6.98, dissolvedOxygen: 9.15, ammoniaNitrogen: 0.119, salinity: 9.306, nitrite: 0.025 },
    { temperature: 23.1, ph: 7.13, dissolvedOxygen: 5.37, ammoniaNitrogen: 0.28, salinity: 9.217, nitrite: 0.067 },
    { temperature: 22.9, ph: 8.51, dissolvedOxygen: 8.13, ammoniaNitrogen: 0.155, salinity: 9.217, nitrite: 0.071 },
    { temperature: 22.4, ph: 8.22, dissolvedOxygen: 8.6, ammoniaNitrogen: 0.243, salinity: 9.282, nitrite: 0.045 },
  ],
  lijinshan: [
    { temperature: 24.3, ph: 8.14, dissolvedOxygen: 3.25, ammoniaNitrogen: 0.108, salinity: 12.985, nitrite: 0.027 },
    { temperature: 24.3, ph: 7.99, dissolvedOxygen: 3.29, ammoniaNitrogen: 0.125, salinity: 13.156, nitrite: 0.092 },
    { temperature: 23.4, ph: 8.02, dissolvedOxygen: 8.66, ammoniaNitrogen: 0.215, salinity: 13.044, nitrite: 0.031 },
    { temperature: 23.4, ph: 7.32, dissolvedOxygen: 3.29, ammoniaNitrogen: 0.196, salinity: 12.833, nitrite: 0.056 },
    { temperature: 22.6, ph: 7.33, dissolvedOxygen: 8.77, ammoniaNitrogen: 0.14, salinity: 12.817, nitrite: 0.041 },
    { temperature: 22.9, ph: 8.2, dissolvedOxygen: 8.68, ammoniaNitrogen: 0.181, salinity: 12.896, nitrite: 0.088 },
  ],
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatLocalDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function buildHourlyMonitoringData(now = new Date()) {
  // 按需求固定从当天 12:17 开始，随后每小时记录一次：12:17、13:17 … 17:17。
  const startTime = new Date(now)
  startTime.setHours(12, 17, 0, 0)

  return Object.fromEntries(FARM_OPTIONS.map((farm) => [
    farm.id,
    FARM_VALUES[farm.id].map((values, index) => ({
      id: `${farm.id}-provided-${index + 1}`,
      farmId: farm.id,
      farmName: farm.name,
      time: formatLocalDateTime(new Date(startTime.getTime() + index * 60 * 60 * 1000)),
      ...values,
    })),
  ]))
}
