import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useMonitorStore } from './monitor'
import { FARM_OPTIONS } from '../config/farms'
import { evaluateForecastAlerts, evaluateRealtimeAlerts, getAlertSummary, LEVEL_PRIORITY } from '../services/alertEngine'

const STATUS_STORAGE_KEY = 'aquaculture-monitor-warning-statuses'
const clone = (value) => JSON.parse(JSON.stringify(value))

function readStatuses() {
  try {
    if (typeof window === 'undefined') return {}
    return JSON.parse(window.localStorage.getItem(STATUS_STORAGE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function saveStatuses(value) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // localStorage 不可用时仍保留当前会话中的处理状态。
  }
}

function timestampOf(alert) {
  const value = alert.source === 'forecast' ? alert.forecastTime : alert.time
  const timestamp = new Date(value || '').getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export const useWarningStore = defineStore('warning', () => {
  const monitor = useMonitorStore()
  const forecastData = ref(null)
  const loading = ref(false)
  const errorMessage = ref('')
  const selectedFarm = ref('all')
  const filterType = ref('all')
  const statusById = ref(readStatuses())
  let initialized = false

  const realtimeAlerts = computed(() => evaluateRealtimeAlerts({ points: monitor.aquacultureData, settings: monitor.settings }))
  const forecastAlerts = computed(() => evaluateForecastAlerts({ forecastData: forecastData.value, settings: monitor.settings }))
  const rawAlerts = computed(() => [...realtimeAlerts.value, ...forecastAlerts.value])
  const allAlerts = computed(() => rawAlerts.value.map((alert) => ({
    ...alert,
    status: statusById.value[alert.id] || alert.status || (alert.source === 'forecast' ? '待观察' : '未处理'),
  })).sort((a, b) => {
    const levelDiff = (LEVEL_PRIORITY[b.level] || 0) - (LEVEL_PRIORITY[a.level] || 0)
    if (levelDiff) return levelDiff
    const sourceDiff = a.source === b.source ? 0 : a.source === 'realtime' ? -1 : 1
    if (sourceDiff) return sourceDiff
    return timestampOf(b) - timestampOf(a)
  }))
  const farms = computed(() => {
    const actualNames = new Set([
      ...(monitor.farmNames || []),
      ...(forecastData.value?.farms || []).map((farm) => farm.farm),
    ].filter(Boolean))
    const configured = FARM_OPTIONS.filter((farm) => actualNames.has(farm.name)).map((farm) => farm.name)
    return configured.length ? configured : [...actualNames]
  })
  const selectedAlerts = computed(() => allAlerts.value.filter((alert) => selectedFarm.value === 'all' || alert.farm === selectedFarm.value))
  const visibleAlerts = computed(() => selectedAlerts.value.filter((alert) => filterType.value === 'all' || alert.source === filterType.value))
  const summary = computed(() => getAlertSummary(selectedAlerts.value))

  async function loadForecast() {
    const response = await fetch(`/data/future_24h_predictions.json?ts=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`预测 JSON 请求失败：HTTP ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload.farms)) throw new Error('预测 JSON 中没有养殖场数据')
    forecastData.value = payload
    if (selectedFarm.value !== 'all' && !payload.farms.some((farm) => farm.farm === selectedFarm.value)) selectedFarm.value = 'all'
  }

  async function init(force = false) {
    if (initialized && !force) return
    loading.value = true
    errorMessage.value = ''
    try {
      await monitor.init(force)
      await loadForecast()
      initialized = true
    } catch (error) {
      console.error('加载告警数据失败：', error)
      errorMessage.value = '真实监测或预测数据加载失败，请检查数据文件。'
    } finally {
      loading.value = false
    }
  }

  function setStatus(id, status) {
    statusById.value = { ...statusById.value, [id]: status }
    saveStatuses(statusById.value)
  }

  function markHandled(id) {
    setStatus(id, '已处理')
  }

  function markProcessing(id) {
    setStatus(id, '处理中')
  }

  function markObserved(id) {
    setStatus(id, '已解除')
  }

  function clearStatus(id) {
    const next = clone(statusById.value)
    delete next[id]
    statusById.value = next
    saveStatuses(next)
  }

  return {
    forecastData,
    loading,
    errorMessage,
    farms,
    selectedFarm,
    filterType,
    realtimeAlerts,
    forecastAlerts,
    allAlerts,
    visibleAlerts,
    summary,
    init,
    refresh: () => init(true),
    setStatus,
    markHandled,
    markProcessing,
    markObserved,
    clearStatus,
  }
})
