export function createMockAlerts() {
  return [
    { id: 'AL-1001', time: '2026-09-26 12:26:18', pondId: 'POND-01', pondName: '1号养殖池', metricKey: 'dissolvedOxygen', value: 4.7, normalRange: '≥ 5.0 mg/L', level: 'yellow', reason: '溶解氧偏低', suggestion: '检查增氧设备并关注水体变化', status: '未处理' },
    { id: 'AL-1002', time: '2026-09-26 11:58:42', pondId: 'POND-03', pondName: '3号养殖池', metricKey: 'ammoniaNitrogen', value: 0.32, normalRange: '≤ 0.20 mg/L', level: 'orange', reason: '氨氮浓度偏高', suggestion: '减少投喂并检查换水系统', status: '处理中' },
    { id: 'AL-1003', time: '2026-09-26 10:41:07', pondId: 'POND-02', pondName: '2号养殖池', metricKey: 'nitrite', value: 0.11, normalRange: '≤ 0.10 mg/L', level: 'yellow', reason: '亚硝酸盐偏高', suggestion: '检查生物过滤并适量换水', status: '已处理' },
  ]
}
