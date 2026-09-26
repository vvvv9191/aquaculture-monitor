import { createMockDeviceLogs, createMockDevices } from '../mock/devices'

export const deviceService = {
  async getDevices() {
    return createMockDevices()
  },
  async getLogs() {
    return createMockDeviceLogs()
  },
  async control(deviceId, action) {
    // 后续替换为 POST /api/devices/{deviceId}/commands，由 FastAPI 发布 MQTT 指令。
    return { deviceId, action, success: true, time: new Date().toISOString() }
  },
  async setMode(deviceId, mode) {
    // 后续替换为 PATCH /api/devices/{deviceId}/mode
    return { deviceId, mode, success: true }
  },
}
