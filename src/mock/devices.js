export function createMockDevices() {
  return [
    { id: 'AERATOR-001', name: '1号增氧机', type: 'aerator', pondId: 'POND-01', pondName: '1号养殖池', online: true, status: 'off', mode: 'auto', lastRunTime: '2026-09-26 14:42:10', lastAction: '系统初始化' },
    { id: 'AERATOR-002', name: '2号增氧机', type: 'aerator', pondId: 'POND-02', pondName: '2号养殖池', online: true, status: 'off', mode: 'manual', lastRunTime: '2026-09-26 13:18:45', lastAction: '等待手动控制' },
    { id: 'PUMP-001', name: '循环水泵', type: 'pump', pondId: 'POND-01', pondName: '1号养殖池', online: true, status: 'on', mode: 'manual', lastRunTime: '2026-09-26 15:05:20', lastAction: '操作员手动开启' },
    { id: 'HEATER-001', name: '恒温加热器', type: 'heater', pondId: 'POND-01', pondName: '1号养殖池', online: true, status: 'off', mode: 'auto', lastRunTime: '2026-09-26 14:10:00', lastAction: '等待温度控制' },
  ]
}

export function createMockDeviceLogs() {
  return [
    { id: 'LOG-3', time: '2026-09-26 15:05:20', deviceId: 'PUMP-001', deviceName: '循环水泵', action: '开启', source: '手动', detail: '操作员手动开启循环水泵' },
    { id: 'LOG-2', time: '2026-09-26 14:42:10', deviceId: 'AERATOR-001', deviceName: '1号增氧机', action: '关闭', source: '自动', detail: '溶解氧恢复正常，自动关闭增氧机' },
    { id: 'LOG-1', time: '2026-09-26 14:20:36', deviceId: 'AERATOR-001', deviceName: '1号增氧机', action: '开启', source: '自动', detail: '系统检测溶解氧低于阈值，自动启动增氧机' },
    { id: 'LOG-0', time: '2026-09-26 14:10:00', deviceId: 'HEATER-001', deviceName: '恒温加热器', action: '关闭', source: '自动', detail: '水温达到恒温上限，自动关闭加热器' },
  ]
}
