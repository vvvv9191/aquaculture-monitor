import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { alertService } from '../api/alertService'
import { deviceService } from '../api/deviceService'
import { predictionService } from '../api/predictionService'
import { waterQualityService } from '../api/waterQualityService'
import { getAquacultureData } from '../api/aquaculture'

import {
  CULTURE_OPTIONS,
  DEFAULT_WATER_QUALITY_SETTINGS,
  DEVICE_CONTROL_CONFIG,
  PONDS,
  WATER_QUALITY_METRICS,
} from '../config/waterQualityConfig'
import { normalizeThresholdSettings, validateThresholdSettings } from '../utils/thresholds'

import { formatDateTime } from '../mock/waterQuality'
import { getAlertLevel } from '../utils/alert'


const clone = (value) => JSON.parse(JSON.stringify(value))
const SETTINGS_STORAGE_KEY = 'aquaculture-monitor-water-quality-settings'
const CULTURE_STORAGE_KEY = 'aquaculture-monitor-culture-profile'
const SAVED_THRESHOLD_PROFILES_KEY = 'aquaculture-monitor-saved-threshold-profiles'

function readStorage(key, fallback) {
  try {
    if (typeof window === 'undefined') return clone(fallback)
    const saved = window.localStorage.getItem(key)
    return saved ? JSON.parse(saved) : clone(fallback)
  } catch {
    return clone(fallback)
  }
}

function loadThresholdSettings() {
  const stored = readStorage(SETTINGS_STORAGE_KEY, DEFAULT_WATER_QUALITY_SETTINGS)
  const normalized = normalizeThresholdSettings(stored)
  // 统一把旧 flat/嵌套范围结构升级为 normal + lowWarning + highWarning。
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // localStorage 不可用时仍使用当前会话中的规范化配置。
  }
  return normalized
}

/**
 * 把 JSON 中的监测日期 + 监测时间
 * 转换成：
 *
 * 2022-01-02 00:04
 */
function buildDateTime(date, time) {
  if (!date) return '--'

  // 把 2022_01_02 转成 2022-01-02
  const dateText = String(date)
    .trim()
    .replaceAll('_', '-')

  const timeText = String(time || '').trim()

  const match = timeText.match(/(\d{1,2})h(\d{1,2})m/)

  if (match) {
    const hour = match[1].padStart(2, '0')
    const minute = match[2].padStart(2, '0')

    return `${dateText} ${hour}:${minute}`
  }

  return `${dateText} ${timeText}`.trim()
}


/**
 * 生成排序用时间戳
 */
function buildTimestamp(date, time) {
  // 把 2022_01_02 转成 2022-01-02
  const dateText = String(date || '')
    .trim()
    .replaceAll('_', '-')

  const timeText = String(time || '').trim()

  const match = timeText.match(/(\d{1,2})h(\d{1,2})m/)

  if (match) {
    const hour = match[1].padStart(2, '0')
    const minute = match[2].padStart(2, '0')

    const timestamp = new Date(
      `${dateText}T${hour}:${minute}:00`
    ).getTime()

    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  const timestamp = new Date(dateText).getTime()

  return Number.isNaN(timestamp) ? 0 : timestamp
}

/**
 * 防止 CSV -> JSON 后出现空值、字符串数字等情况
 */
function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0
  }

  const result = Number(value)

  return Number.isFinite(result) ? result : 0
}

function readCsvMetric(item, metric) {
  const rawValue = (metric.csvFields || []).map((field) => item[field]).find((value) => value !== undefined && value !== null && value !== '')
  return toNumber(rawValue)
}


export const useMonitorStore = defineStore('monitor', () => {

  /*
  |--------------------------------------------------------------------------
  | 基础状态
  |--------------------------------------------------------------------------
  */

  const currentByPond = ref({})

  const historyByPond = ref({})

  const alerts = ref([])

  const devices = ref([])

  const deviceLogs = ref([])

  const prediction = ref(null)

  const settings = ref(loadThresholdSettings())

  const culture = ref(readStorage(CULTURE_STORAGE_KEY, {
    species: CULTURE_OPTIONS.species[0],
    stage: CULTURE_OPTIONS.stages[1],
  }))

  const savedThresholdProfiles = ref(readStorage(SAVED_THRESHOLD_PROFILES_KEY, []))

  const selectedPondId = ref('POND-01')

  const initialized = ref(false)

  const realtimeRunning = ref(false)

  const pendingDeviceActions = new Set()


  /*
  |--------------------------------------------------------------------------
  | 保存真实 JSON 数据
  |--------------------------------------------------------------------------
  */

  const aquacultureData = ref([])

  const farmNames = ref([])


  /*
  |--------------------------------------------------------------------------
  | 计算属性
  |--------------------------------------------------------------------------
  */

  const selectedPond = computed(() => {
    return (
      PONDS.find(
        (pond) => pond.id === selectedPondId.value
      ) || PONDS[0]
    )
  })


  const current = computed(() => {
    return currentByPond.value['POND-01'] || null
  })


  const selectedCurrent = computed(() => {
    return (
      currentByPond.value[selectedPondId.value] ||
      current.value
    )
  })


  const history = computed(() => {
    return historyByPond.value['POND-01'] || []
  })


  const selectedHistory = computed(() => {
    return (
      historyByPond.value[selectedPondId.value] || []
    )
  })


  const currentAlerts = computed(() => {
    return alerts.value.filter(
      (item) =>
        item.status !== '已处理' &&
        item.status !== '已确认'
    )
  })


  const todayAlertCount = computed(() => {
    return alerts.value.length
  })


  const unhandledAlertCount = computed(() => {
    return alerts.value.filter(
      (item) =>
        item.status === '未处理' ||
        item.status === '实时关注'
    ).length
  })


  const handledAlertCount = computed(() => {
    return alerts.value.filter(
      (item) =>
        item.status === '已处理' ||
        item.status === '已确认'
    ).length
  })


  const severeAlertCount = computed(() => {
    return alerts.value.filter(
      (item) => item.level === 'red'
    ).length
  })


  const overallQuality = computed(() => {
    return getPointQuality(current.value)
  })


  const deviceStatus = computed(() => {

    const online = devices.value.filter(
      (device) => device.online
    ).length

    const warningPonds = new Set(
      Object.values(currentByPond.value)
        .filter(
          (point) =>
            getPointQuality(point) !== 'normal'
        )
        .map(
          (point) => point.pondId
        )
    )

    return {
      online,

      normal: Math.max(
        online - warningPonds.size,
        0
      ),

      warning: warningPonds.size,

      network: realtimeRunning.value
        ? '数据源已连接'
        : '连接中',
    }
  })


  const aerator = computed(() => {

    const device = devices.value.find(
      (item) => item.id === 'AERATOR-001'
    )

    return device
      ? {
          ...device,
          active: device.status === 'on',
        }
      : {
          mode: 'auto',
          online: true,
          active: false,
          lastAction: '等待初始化',
        }
  })


  /*
  |--------------------------------------------------------------------------
  | 水质等级判断
  |--------------------------------------------------------------------------
  */

  function getPointQuality(point) {

    if (!point) return 'normal'

    const levels = Object.keys(
      settings.value
    ).map((key) => {

      return getAlertLevel(
        key,
        point[key],
        settings.value
      )
    })


    if (levels.includes('red')) {
      return 'red'
    }

    if (levels.includes('orange')) {
      return 'orange'
    }

    if (levels.includes('yellow')) {
      return 'yellow'
    }

    return 'normal'
  }


  /*
  |--------------------------------------------------------------------------
  | 把 aquaculture.json 转成项目原来需要的数据结构
  |--------------------------------------------------------------------------
  */

  function normalizeAquacultureData(rawData) {

    if (!Array.isArray(rawData)) {
      return []
    }


    /*
     * 自动识别有哪些养殖场
     */

    const farms = [
      ...new Set(
        rawData
          .map(
            (item) =>
              String(
                item['养殖场名称'] || ''
              ).trim()
          )
          .filter(Boolean)
      ),
    ]


    farmNames.value = farms


    /*
     * 养殖场对应 POND
     *
     * 第一个养殖场 -> POND-01
     * 第二个养殖场 -> POND-02
     */

    const farmMap = new Map()

    farms.forEach((farmName, index) => {

      const pondFromConfig = PONDS[index]

      const pondId =
        pondFromConfig?.id ||
        `POND-${String(index + 1).padStart(2, '0')}`

      farmMap.set(
        farmName,
        {
          pondId,

          deviceId:
            `TJ-AQ-${String(index + 1).padStart(
              3,
              '0'
            )}`,
        }
      )
    })


    /*
     * 中文 CSV 字段
     * 转成 Vue 项目内部字段
     */

    return rawData
      .map((item, index) => {

        const farmName =
          String(
            item['养殖场名称'] || ''
          ).trim()

        const mapping =
          farmMap.get(farmName) || {
            pondId: 'POND-01',
            deviceId: 'TJ-AQ-001',
          }


        const date =
          item['监测日期'] || ''

        const monitorTime =
          item['监测时间'] || ''


        const point = {

          id:
            `AQ-${index + 1}`,

          province:
            item['省份'] || '天津市',

          farmName,

          pondId:
            mapping.pondId,

          /*
           * 页面原来使用 pondName
           */
          pondName:
            farmName,

          deviceId:
            mapping.deviceId,

          date,

          monitorTime,

          time:
            buildDateTime(
              date,
              monitorTime
            ),

          timestamp:
            buildTimestamp(
              date,
              monitorTime
            ),


          /* 六项指标统一按照 waterQualityConfig.csvFields 映射。 */
          ...Object.fromEntries(
            WATER_QUALITY_METRICS.map((metric) => [metric.key, readCsvMetric(item, metric)])
          ),
        }


        /*
         * 增加一些兼容字段
         *
         * 防止其他组件使用不同名字
         */

        point.waterTemperature =
          point.temperature

        point.pH =
          point.ph

        point.ammonia =
          point.ammoniaNitrogen

        point.nitriteNitrogen =
          point.nitrite


        point.quality =
          getPointQuality(point)


        return point
      })

      /*
       * 按时间从早到晚排序
       */

      .sort(
        (a, b) =>
          a.timestamp - b.timestamp
      )
  }


  /*
  |--------------------------------------------------------------------------
  | 初始化
  |--------------------------------------------------------------------------
  */

  async function init(force = false) {

    if (initialized.value && !force) {
      return
    }


    try {

      /*
       * 读取真实 JSON
       *
       * 设备、日志暂时继续沿用原项目服务
       */

      const [
        rawData,
        oldDevices,
        oldLogs,
      ] = await Promise.all([
        getAquacultureData(),
        deviceService.getDevices(),
        deviceService.getLogs(),
      ])


      /*
       * JSON -> 项目数据结构
       */

      const normalized =
        normalizeAquacultureData(rawData)


      aquacultureData.value =
        normalized


      /*
       * 根据 POND 分组
       */

      const grouped = {}


      normalized.forEach((point) => {

        if (!grouped[point.pondId]) {
          grouped[point.pondId] = []
        }

        grouped[point.pondId].push(
          point
        )
      })


      /*
       * 历史数据
       */

      historyByPond.value =
        grouped


      /*
       * 每个养殖场最后一条
       * 作为当前数据
       */

      const snapshot = {}


      Object.entries(
        grouped
      ).forEach(
        ([pondId, points]) => {

          if (!points.length) {
            return
          }

          snapshot[pondId] =
            points[
              points.length - 1
            ]
        }
      )


      currentByPond.value =
        snapshot


      /*
       * 设备和设备日志继续复用原项目服务；告警统一由 warningStore + alertEngine 生成。
       */

      alerts.value = []

      devices.value =
        oldDevices || []

      deviceLogs.value =
        oldLogs || []


      initialized.value =
        true


      /*
       * 这里的 true 表示：
       * JSON 数据源已经成功连接
       *
       * 不再启动原来的 Mock realtimeService，
       * 否则 Mock 数据会混入真实数据。
       */

      realtimeRunning.value =
        true



      await refreshPrediction()

    } catch {
      realtimeRunning.value = false
    }
  }


  /*
  |--------------------------------------------------------------------------
  | 写入一条新数据
  |--------------------------------------------------------------------------
  */

  function ingestPoint(point) {

    const nextPoint = {

      ...point,

      quality:
        getPointQuality(point),

    }


    currentByPond.value = {

      ...currentByPond.value,

      [point.pondId]:
        nextPoint,

    }


    const oldHistory =
      historyByPond.value[
        point.pondId
      ] || []


    historyByPond.value = {

      ...historyByPond.value,

      [point.pondId]: [
        ...oldHistory.slice(-287),
        nextPoint,
      ],

    }


    appendPointAlerts(
      nextPoint
    )


    applyAutomaticControl(
      nextPoint
    )

    applyAutomaticHeatingControl(
      nextPoint
    )
  }


  /*
  |--------------------------------------------------------------------------
  | 预警
  |--------------------------------------------------------------------------
  */

  function appendPointAlerts(point) {

    const nextAlerts =
      alertService.evaluatePoint(
        point,
        settings.value
      )


    nextAlerts.forEach(
      (nextAlert) => {

        const existing =
          alerts.value.find(
            (item) =>
              item.pondId ===
                nextAlert.pondId &&
              item.metricKey ===
                nextAlert.metricKey &&
              item.status !==
                '已处理' &&
              item.status !==
                '已确认'
          )


        if (
          existing &&
          existing.level ===
            nextAlert.level
        ) {

          alerts.value =
            alerts.value.map(
              (item) =>
                item.id === existing.id
                  ? {
                      ...item,

                      value:
                        nextAlert.value,

                      time:
                        point.time,

                      normalRange:
                        nextAlert.normalRange,
                    }
                  : item
            )

          return
        }


        if (existing) {

          alerts.value =
            alerts.value.map(
              (item) =>
                item.id === existing.id
                  ? {
                      ...item,
                      status: '已处理',
                    }
                  : item
            )
        }


        alerts.value = [

          {
            id:
              `LIVE-${Date.now()}-${nextAlert.metricKey}`,

            time:
              point.time,

            status:
              '未处理',

            ...nextAlert,
          },

          ...alerts.value,
        ]
      }
    )
  }


  /*
  |--------------------------------------------------------------------------
  | 自动控制增氧机
  |--------------------------------------------------------------------------
  */

  function applyAutomaticControl(point) {

    const oxygenRule = DEVICE_CONTROL_CONFIG.aerator

    if (!oxygenRule) {
      return
    }


    devices.value

      .filter(
        (device) =>
          device.online &&
          device.type ===
            'aerator' &&
          device.pondId ===
            point.pondId &&
          device.mode ===
            'auto'
      )

      .forEach(
        (device) => {

          if (
            device.status ===
              'off' &&
            point.dissolvedOxygen <
              oxygenRule.lowThreshold
          ) {

            controlDevice(
              device.id,
              'on',
              '自动',
              '系统检测DO低于启动阈值，自动启动增氧机'
            )

          } else if (
            device.status ===
              'on' &&
            point.dissolvedOxygen >=
              oxygenRule.highThreshold
          ) {

            controlDevice(
              device.id,
              'off',
              '自动',
              'DO恢复正常，自动关闭增氧机'
            )
          }
        }
      )
  }


  /*
  |--------------------------------------------------------------------------
  | 自动控制恒温加热器
  |--------------------------------------------------------------------------
  */

  function applyAutomaticHeatingControl(point) {
    const temperatureRule = DEVICE_CONTROL_CONFIG.heater
    if (!temperatureRule) return

    devices.value
      .filter((device) => device.online && device.type === 'heater' && device.pondId === point.pondId && device.mode === 'auto')
      .forEach((device) => {
        if (device.status === 'off' && point.temperature < temperatureRule.lowThreshold) {
          controlDevice(device.id, 'on', '自动', `水温低于 ${temperatureRule.lowThreshold}℃，自动启动恒温加热器`)
        } else if (device.status === 'on' && point.temperature >= temperatureRule.highThreshold) {
          controlDevice(device.id, 'off', '自动', `水温达到 ${temperatureRule.highThreshold}℃，自动关闭恒温加热器`)
        }
      })
  }


  /*
  |--------------------------------------------------------------------------
  | 控制设备
  |--------------------------------------------------------------------------
  */

  async function controlDevice(
    deviceId,
    status,
    source = '手动',
    detail = '设备状态已更新'
  ) {

    const device =
      devices.value.find(
        (item) =>
          item.id === deviceId
      )


    if (
      !device ||
      device.status === status ||
      pendingDeviceActions.has(
        deviceId
      )
    ) {
      return
    }


    pendingDeviceActions.add(
      deviceId
    )


    await deviceService.control(
      deviceId,
      status
    )


    const time =
      formatDateTime(
        new Date()
      )


    devices.value =
      devices.value.map(
        (item) =>
          item.id === deviceId
            ? {
                ...item,
                status,
                lastRunTime: time,
                lastAction: detail,
              }
            : item
      )


    deviceLogs.value = [

      {
        id:
          `LOG-${Date.now()}`,

        time,

        deviceId,

        deviceName:
          device.name,

        action:
          status === 'on'
            ? '开启'
            : '关闭',

        source,

        detail,
      },

      ...deviceLogs.value,
    ]


    pendingDeviceActions.delete(
      deviceId
    )
  }


  /*
  |--------------------------------------------------------------------------
  | 设置设备模式
  |--------------------------------------------------------------------------
  */

  async function setDeviceMode(
    deviceId,
    mode
  ) {

    await deviceService.setMode(
      deviceId,
      mode
    )


    devices.value =
      devices.value.map(
        (device) =>
          device.id === deviceId
            ? {
                ...device,
                mode,

                lastAction:
                  mode === 'auto'
                    ? '已切换自动模式'
                    : '已切换手动模式',
              }
            : device
      )


    if (mode === 'auto') {

      const device =
        devices.value.find(
          (item) =>
            item.id === deviceId
        )


      const point =
        currentByPond.value[
          device?.pondId
        ]


      if (
        device &&
        point
      ) {

        applyAutomaticControl(
          point
        )
        applyAutomaticHeatingControl(
          point
        )
      }
    }
  }


  /*
  |--------------------------------------------------------------------------
  | 增氧机
  |--------------------------------------------------------------------------
  */

  function setAerator(
    active,
    reason = '手动操作'
  ) {

    return controlDevice(
      'AERATOR-001',
      active ? 'on' : 'off',
      '手动',
      reason
    )
  }


  function setAeratorMode(
    mode
  ) {

    return setDeviceMode(
      'AERATOR-001',
      mode
    )
  }


  /*
  |--------------------------------------------------------------------------
  | 趋势预测
  |--------------------------------------------------------------------------
  */

  async function refreshPrediction() {

    if (
      !selectedCurrent.value
    ) {
      return
    }


    try {

      prediction.value =
        await predictionService
          .predictDissolvedOxygen(

            selectedCurrent.value,

            selectedHistory.value,

            settings.value

          )

    } catch {
      prediction.value = null
    }
  }


  /*
  |--------------------------------------------------------------------------
  | 历史数据
  |--------------------------------------------------------------------------
  |
  | 当前其他页面如果仍依赖原水质 Service，
  | 暂时保持兼容。
  |--------------------------------------------------------------------------
  */

  async function fetchHistoricalData(
    query
  ) {

    return waterQualityService
      .getHistory(query)
  }


  /*
  |--------------------------------------------------------------------------
  | 切换养殖场 / Pond
  |--------------------------------------------------------------------------
  */

  function selectPond(
    pondId
  ) {

    selectedPondId.value =
      pondId


    refreshPrediction()
  }


  /*
  |--------------------------------------------------------------------------
  | 告警处理
  |--------------------------------------------------------------------------
  */

  function markAlertHandled(
    alertId,
    status = '已处理'
  ) {

    alerts.value =
      alerts.value.map(
        (alert) =>
          alert.id === alertId
            ? {
                ...alert,
                status,
              }
            : alert
      )


    alertService.updateStatus(
      alertId,
      status
    )
  }


  /*
  |--------------------------------------------------------------------------
  | 模拟低溶解氧
  |--------------------------------------------------------------------------
  |
  | 这个按钮仍然可以保留，
  | 用于项目答辩演示预警功能。
  |--------------------------------------------------------------------------
  */


  /*
  |--------------------------------------------------------------------------
  | 保存预警设置
  |--------------------------------------------------------------------------
  */

  function saveSettings(nextSettings) {

    const validation = validateThresholdSettings(nextSettings)
    if (!validation.valid) return validation
    const next = validation.settings



    settings.value = next
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage 不可用时仍保留当前会话中的 Pinia 配置。
    }


    const updatedPoints = Object.values(currentByPond.value).map((point) => {
      const updated = {
        ...point,
        quality: getPointQuality(point),
      }
      currentByPond.value = {
        ...currentByPond.value,
        [point.pondId]: updated,
      }
      applyAutomaticControl(updated)
      return updated
    })

    // 重新设置后清除旧的未处理快照，只按同一份 Pinia 阈值重算当前告警。
    alerts.value = alerts.value.filter((alert) => alert.status === '已处理' || alert.status === '已确认')
    updatedPoints.forEach((point) => appendPointAlerts(point))


    refreshPrediction()
    return validation
  }


  /*
  |--------------------------------------------------------------------------
  | 恢复默认设置
  |--------------------------------------------------------------------------
  */

  function resetSettings() {

    saveSettings(
      DEFAULT_WATER_QUALITY_SETTINGS
    )
  }


  /*
  |--------------------------------------------------------------------------
  | 保存养殖设置
  |--------------------------------------------------------------------------
  */

  function saveCulture(
    nextCulture
  ) {

    culture.value = {
      ...culture.value,
      ...nextCulture,
    }
    try {
      window.localStorage.setItem(CULTURE_STORAGE_KEY, JSON.stringify(culture.value))
    } catch {
      // localStorage 不可用时保留当前会话配置。
    }
  }


  /*
  |--------------------------------------------------------------------------
  | 记录已保存的品种/阶段阈值快照
  |--------------------------------------------------------------------------
  */

  function saveThresholdProfile() {
    const species = culture.value.species
    const stage = culture.value.stage
    const profile = {
      id: `${species}::${stage}`,
      species,
      stage,
      settings: clone(settings.value),
      savedAt: formatDateTime(new Date()),
    }
    const existing = Array.isArray(savedThresholdProfiles.value) ? savedThresholdProfiles.value : []
    savedThresholdProfiles.value = [profile, ...existing.filter((item) => item.id !== profile.id)]
    try {
      window.localStorage.setItem(SAVED_THRESHOLD_PROFILES_KEY, JSON.stringify(savedThresholdProfiles.value))
    } catch {
      // localStorage 不可用时仍在当前会话中展示。
    }
    return profile
  }

  function applyThresholdProfile(profile) {
    if (!profile?.settings) return { valid: false, errors: ['保存的阈值配置不存在。'] }
    const validation = saveSettings(profile.settings)
    if (!validation.valid) return validation
    saveCulture({ species: profile.species, stage: profile.stage })
    return validation
  }

  /*
  |--------------------------------------------------------------------------
  | 销毁
  |--------------------------------------------------------------------------
  */

  function destroy() {

    realtimeRunning.value =
      false

    initialized.value =
      false
  }


  /*
  |--------------------------------------------------------------------------
  | 暴露给页面
  |--------------------------------------------------------------------------
  */

  return {

    current,

    currentByPond,

    selectedCurrent,

    history,

    selectedHistory,

    selectedPond,

    selectedPondId,

    aquacultureData,

    farmNames,

    alerts,

    currentAlerts,

    todayAlertCount,

    unhandledAlertCount,

    handledAlertCount,

    severeAlertCount,

    devices,

    deviceLogs,

    deviceStatus,

    aerator,

    prediction,

    settings,

    culture,

    savedThresholdProfiles,

    overallQuality,

    init,

    destroy,

    selectPond,

    fetchHistoricalData,

    refreshPrediction,

    setAerator,

    setAeratorMode,

    setDeviceMode,

    controlDevice,

    markAlertHandled,

    saveSettings,

    saveThresholdProfile,

    applyThresholdProfile,

    resetSettings,

    saveCulture,

  }
})