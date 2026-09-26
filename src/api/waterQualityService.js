import { PONDS } from '../config/waterQualityConfig'
import { createCurrentSnapshot, createHistory, createHistoryByRange, createWaterQualityPoint } from '../mock/waterQuality'

// 统一水质数据服务层。未来只需把这些方法改为 Axios/FastAPI 请求，页面和 Store 无需重写。
export const waterQualityService = {
  async getCurrentSnapshot() {
    return createCurrentSnapshot()
  },
  async getLatest(pondId = 'POND-01', previous) {
    return createWaterQualityPoint(previous, new Date(), pondId)
  },
  async getRealtimeBatch(previousByPond = {}) {
    return Object.fromEntries(PONDS.map((pond) => [
      pond.id,
      createWaterQualityPoint(previousByPond[pond.id], new Date(), pond.id),
    ]))
  },
  async getHistory({ pondId = 'POND-01', range = '24h' } = {}) {
    return createHistoryByRange(pondId, range)
  },
  async getRealtimeHistory(pondId = 'POND-01') {
    return createHistory({ pondId, count: 48, intervalMinutes: 5 })
  },
}

export const realtimeService = {
  connect(getCurrentState, onMessage) {
    const timer = window.setInterval(async () => {
      const batch = await waterQualityService.getRealtimeBatch(getCurrentState())
      onMessage(batch)
    }, 5000)
    return () => window.clearInterval(timer)
  },
  // 未来替换为 WebSocket：ws://<FastAPI>/ws/water-quality
}
