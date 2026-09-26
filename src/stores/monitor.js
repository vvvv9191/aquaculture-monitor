import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { alertService } from '../api/alertService'
import { deviceService } from '../api/deviceService'
import { predictionService } from '../api/predictionService'
import { realtimeService, waterQualityService } from '../api/waterQualityService'
import { CULTURE_OPTIONS, DEFAULT_WATER_QUALITY_SETTINGS, PONDS } from '../config/waterQualityConfig'
import { formatDateTime } from '../mock/waterQuality'
import { ALERT_LEVELS, evaluateMetric } from '../utils/alert'

const clone = (value) => JSON.parse(JSON.stringify(value))

export const useMonitorStore = defineStore('monitor', () => {
  const currentByPond = ref({})
  const historyByPond = ref({})
  const alerts = ref([])
  const devices = ref([])
  const deviceLogs = ref([])
  const prediction = ref(null)
  const settings = ref(clone(DEFAULT_WATER_QUALITY_SETTINGS))
  const culture = ref({ species: CULTURE_OPTIONS.species[0], stage: CULTURE_OPTIONS.stages[1] })
  const selectedPondId = ref('POND-01')
  const initialized = ref(false)
  const realtimeRunning = ref(false)
  const demoActive = ref(false)
  const pendingDeviceActions = new Set()
  let disconnectRealtime = null
  let demoTimers = []

  const selectedPond = computed(() => PONDS.find((pond) => pond.id === selectedPondId.value) || PONDS[0])
  const current = computed(() => currentByPond.value['POND-01'] || null)
  const selectedCurrent = computed(() => currentByPond.value[selectedPondId.value] || current.value)
  const history = computed(() => historyByPond.value['POND-01'] || [])
  const selectedHistory = computed(() => historyByPond.value[selectedPondId.value] || [])
  const currentAlerts = computed(() => alerts.value.filter((item) => item.status !== '已处理' && item.status !== '已确认'))
  const todayAlertCount = computed(() => alerts.value.length)
  const unhandledAlertCount = computed(() => alerts.value.filter((item) => item.status === '未处理' || item.status === '实时关注').length)
  const handledAlertCount = computed(() => alerts.value.filter((item) => item.status === '已处理' || item.status === '已确认').length)
  const severeAlertCount = computed(() => alerts.value.filter((item) => item.level === 'red').length)
  const overallQuality = computed(() => getPointQuality(current.value))
  const deviceStatus = computed(() => {
    const online = devices.value.filter((device) => device.online).length
    const warningPonds = new Set(Object.values(currentByPond.value).filter((point) => getPointQuality(point) !== 'normal').map((point) => point.pondId))
    return { online, normal: Math.max(online - warningPonds.size, 0), warning: warningPonds.size, network: realtimeRunning.value ? '5G专网稳定' : '连接中' }
  })
  const aerator = computed(() => {
    const device = devices.value.find((item) => item.id === 'AERATOR-001')
    return device ? { ...device, active: device.status === 'on' } : { mode: 'auto', online: true, active: false, lastAction: '等待初始化' }
  })

  function getPointQuality(point) {
    if (!point) return 'normal'
    const levels = Object.keys(settings.value).map((key) => evaluateMetric(key, point[key], settings.value))
    if (levels.includes('red')) return 'red'
    if (levels.includes('orange')) return 'orange'
    if (levels.includes('yellow')) return 'yellow'
    return 'normal'
  }

  async function init() {
    if (initialized.value) return
    const [snapshot, oldAlerts, oldDevices, oldLogs] = await Promise.all([
      waterQualityService.getCurrentSnapshot(),
      alertService.getAlerts(),
      deviceService.getDevices(),
      deviceService.getLogs(),
    ])
    const histories = await Promise.all(PONDS.map(async (pond) => [pond.id, await waterQualityService.getRealtimeHistory(pond.id)]))
    currentByPond.value = snapshot
    historyByPond.value = Object.fromEntries(histories)
    alerts.value = oldAlerts
    devices.value = oldDevices
    deviceLogs.value = oldLogs
    initialized.value = true
    await refreshPrediction()
    startRealtime()
  }

  function startRealtime() {
    if (disconnectRealtime) return
    realtimeRunning.value = true
    disconnectRealtime = realtimeService.connect(() => ({ ...currentByPond.value }), applyRealtimeBatch)
  }

  function applyRealtimeBatch(batch) {
    Object.values(batch).forEach((point) => {
      if (demoActive.value && point.pondId === 'POND-01') return
      ingestPoint(point)
    })
    refreshPrediction()
  }

  function ingestPoint(point) {
    const nextPoint = { ...point, quality: getPointQuality(point) }
    currentByPond.value = { ...currentByPond.value, [point.pondId]: nextPoint }
    const oldHistory = historyByPond.value[point.pondId] || []
    historyByPond.value = { ...historyByPond.value, [point.pondId]: [...oldHistory.slice(-287), nextPoint] }
    appendPointAlerts(nextPoint)
    applyAutomaticControl(nextPoint)
  }

  function appendPointAlerts(point) {
    const nextAlerts = alertService.evaluatePoint(point, settings.value)
    nextAlerts.forEach((nextAlert) => {
      const existing = alerts.value.find((item) => item.pondId === nextAlert.pondId && item.metricKey === nextAlert.metricKey && item.status !== '已处理' && item.status !== '已确认')
      if (existing && existing.level === nextAlert.level) {
        alerts.value = alerts.value.map((item) => item.id === existing.id ? { ...item, value: nextAlert.value, time: point.time, normalRange: nextAlert.normalRange } : item)
        return
      }
      if (existing) alerts.value = alerts.value.map((item) => item.id === existing.id ? { ...item, status: '已处理' } : item)
      alerts.value = [{
        id: `LIVE-${Date.now()}-${nextAlert.metricKey}`,
        time: point.time,
        status: '未处理',
        ...nextAlert,
      }, ...alerts.value]
    })
  }

  function applyAutomaticControl(point) {
    const oxygenRule = settings.value.dissolvedOxygen
    devices.value.filter((device) => device.online && device.type === 'aerator' && device.pondId === point.pondId && device.mode === 'auto').forEach((device) => {
      if (device.status === 'off' && point.dissolvedOxygen < oxygenRule.aeratorOn) {
        controlDevice(device.id, 'on', '自动', '系统检测DO低于启动阈值，自动启动增氧机')
      } else if (device.status === 'on' && point.dissolvedOxygen >= oxygenRule.aeratorOff) {
        controlDevice(device.id, 'off', '自动', 'DO恢复正常，自动关闭增氧机')
      }
    })
  }

  async function controlDevice(deviceId, status, source = '手动', detail = '设备状态已更新') {
    const device = devices.value.find((item) => item.id === deviceId)
    if (!device || device.status === status || pendingDeviceActions.has(deviceId)) return
    pendingDeviceActions.add(deviceId)
    await deviceService.control(deviceId, status)
    const time = formatDateTime(new Date())
    devices.value = devices.value.map((item) => item.id === deviceId ? { ...item, status, lastRunTime: time, lastAction: detail } : item)
    deviceLogs.value = [{ id: `LOG-${Date.now()}`, time, deviceId, deviceName: device.name, action: status === 'on' ? '开启' : '关闭', source, detail }, ...deviceLogs.value]
    pendingDeviceActions.delete(deviceId)
  }

  async function setDeviceMode(deviceId, mode) {
    await deviceService.setMode(deviceId, mode)
    devices.value = devices.value.map((device) => device.id === deviceId ? { ...device, mode, lastAction: mode === 'auto' ? '已切换自动模式' : '已切换手动模式' } : device)
    if (mode === 'auto') {
      const device = devices.value.find((item) => item.id === deviceId)
      const point = currentByPond.value[device?.pondId]
      if (device && point) applyAutomaticControl(point)
    }
  }

  function setAerator(active, reason = '手动操作') {
    return controlDevice('AERATOR-001', active ? 'on' : 'off', '手动', reason)
  }

  function setAeratorMode(mode) {
    return setDeviceMode('AERATOR-001', mode)
  }

  async function refreshPrediction() {
    if (!selectedCurrent.value) return
    prediction.value = await predictionService.predictDissolvedOxygen(selectedCurrent.value, selectedHistory.value, settings.value)
  }

  async function fetchHistoricalData(query) {
    return waterQualityService.getHistory(query)
  }

  function selectPond(pondId) {
    selectedPondId.value = pondId
    refreshPrediction()
  }

  function markAlertHandled(alertId, status = '已处理') {
    alerts.value = alerts.value.map((alert) => alert.id === alertId ? { ...alert, status } : alert)
    alertService.updateStatus(alertId, status)
  }

  function simulateLowOxygen() {
    if (demoActive.value) return
    clearDemoTimers()
    demoActive.value = true
    const steps = [5.8, 5.2, 4.7, 4.2, 3.8]
    steps.forEach((dissolvedOxygen, index) => {
      demoTimers.push(window.setTimeout(() => {
        const base = currentByPond.value['POND-01']
        if (!base) return
        ingestPoint({ ...base, time: formatDateTime(new Date()), dissolvedOxygen })
        if (index === steps.length - 1) demoActive.value = false
      }, index * 1100))
    })
  }

  function saveSettings(nextSettings) {
    const next = clone(nextSettings)
    if (next.dissolvedOxygen.aeratorOff <= next.dissolvedOxygen.aeratorOn) next.dissolvedOxygen.aeratorOff = next.dissolvedOxygen.aeratorOn + 0.5
    settings.value = next
    Object.values(currentByPond.value).forEach((point) => {
      const updated = { ...point, quality: getPointQuality(point) }
      currentByPond.value = { ...currentByPond.value, [point.pondId]: updated }
      appendPointAlerts(updated)
      applyAutomaticControl(updated)
    })
    refreshPrediction()
  }

  function resetSettings() {
    saveSettings(DEFAULT_WATER_QUALITY_SETTINGS)
  }

  function saveCulture(nextCulture) {
    culture.value = { ...culture.value, ...nextCulture }
  }

  function clearDemoTimers() {
    demoTimers.forEach((timer) => window.clearTimeout(timer))
    demoTimers = []
  }

  function destroy() {
    disconnectRealtime?.()
    disconnectRealtime = null
    clearDemoTimers()
    realtimeRunning.value = false
    initialized.value = false
  }

  return {
    current, currentByPond, selectedCurrent, history, selectedHistory, selectedPond, selectedPondId,
    alerts, currentAlerts, todayAlertCount, unhandledAlertCount, handledAlertCount, severeAlertCount,
    devices, deviceLogs, deviceStatus, aerator, prediction, settings, culture, demoActive, overallQuality,
    init, destroy, selectPond, fetchHistoricalData, refreshPrediction, setAerator, setAeratorMode,
    setDeviceMode, controlDevice, markAlertHandled, simulateLowOxygen, saveSettings, resetSettings, saveCulture,
  }
})
