<script setup>
import { computed, onMounted, ref } from 'vue'
import { ArrowUp, DataLine, MagicStick } from '@element-plus/icons-vue'
import SidebarNav from '../components/SidebarNav.vue'
import TopStatusBar from '../components/TopStatusBar.vue'
import MetricCard from '../components/MetricCard.vue'
import TrendChart from '../components/TrendChart.vue'
import AlertPanel from '../components/AlertPanel.vue'
import DevicePanel from '../components/DevicePanel.vue'
import { WATER_QUALITY_METRICS } from '../config/waterQuality'
import { FARM_OPTIONS } from '../config/farms'
import { getAlertLevel } from '../utils/alert'
import { buildRealtimeSeries } from '../data/realtimeData'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const metrics = WATER_QUALITY_METRICS
const selectedFarmId = ref(FARM_OPTIONS[0].id)
const forecastData = ref(null)
const loading = ref(true)

const selectedFarm = computed(() => FARM_OPTIONS.find((farm) => farm.id === selectedFarmId.value) || FARM_OPTIONS[0])
const series = computed(() => buildRealtimeSeries(selectedFarmId.value))
const current = computed(() => series.value.at(-1) || {})
const previous = computed(() => series.value.at(-2) || current.value)

const alerts = computed(() => {
  const point = current.value
  if (!point || !point.time) return []
  return WATER_QUALITY_METRICS.map((metric) => {
    const value = Number(point[metric.key])
    if (!Number.isFinite(value)) return null
    const level = getAlertLevel(metric.key, value, store.settings)
    if (level === 'normal') return null
    return {
      id: `dash-${selectedFarmId.value}-${metric.key}`,
      level,
      metricKey: metric.key,
      value,
      time: point.time,
      pondId: selectedFarm.value.shortName,
      status: '未处理',
    }
  }).filter(Boolean)
})

const levelLabelMap = { normal: '正常', yellow: '黄色', orange: '橙色', red: '红色' }
const forecast = computed(() => {
  const farmData = (forecastData.value?.farms || []).find((farm) => farm.farm === selectedFarm.value.name)
  const points = farmData?.predictions || []
  return points.slice(0, 3).map((point) => {
    const value = Number(point.do)
    const level = getAlertLevel('dissolvedOxygen', value, store.settings)
    return {
      label: `${Math.round(Number(point.horizonHours || 0))}小时后`,
      value: Number.isFinite(value) ? value.toFixed(1) : '--',
      level,
      levelLabel: levelLabelMap[level] || '正常',
    }
  })
})

async function loadForecast() {
  try {
    const response = await fetch('/data/future_24h_predictions.json', { cache: 'no-store' })
    if (!response.ok) throw new Error(`预测 JSON 请求失败：HTTP ${response.status}`)
    forecastData.value = await response.json()
  } catch (error) {
    console.error('加载首页趋势预测失败：', error)
    forecastData.value = null
  }
}

onMounted(async () => {
  loading.value = true
  await store.init()
  await loadForecast()
  loading.value = false
})
</script>

<template>
  <div class="app-shell"><SidebarNav /><main class="main-content"><TopStatusBar /><div class="dashboard-content" v-loading="loading" element-loading-background="rgba(7, 20, 31, .85)"><section class="dashboard-farm-bar"><div class="dashboard-farm-title"><span class="section-kicker">FARM SELECTION</span><strong>当前养殖场</strong></div><el-select v-model="selectedFarmId" aria-label="选择养殖场"><el-option v-for="farm in FARM_OPTIONS" :key="farm.id" :label="farm.name" :value="farm.id" /></el-select><span class="dashboard-farm-note">监测数据、趋势与告警随养殖场实时切换</span></section><section class="metrics-grid"><MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" :value="Number(current[metric.key] || 0)" :previous="Number(previous[metric.key] || current[metric.key] || 0)" :time="current.time" /></section><section class="main-grid"><section class="panel chart-panel"><div class="panel-heading"><div><span class="section-kicker">REAL-TIME TREND</span><h2><el-icon><DataLine /></el-icon> 水质趋势</h2></div><div class="chart-meta"><span class="live-dot"></span>数据源已连接 <span class="time-range">近 90 分钟</span></div></div><TrendChart :history="series" /></section><AlertPanel :alerts="alerts" /></section><section class="bottom-grid"><DevicePanel :aerator="store.aerator" :oxygen="Number(current.dissolvedOxygen || 0)" :farm-label="selectedFarm.shortName" @toggle="store.setAerator" @mode="store.setAeratorMode" /><section class="panel forecast-panel"><div class="panel-heading"><div><span class="section-kicker">FORECAST</span><h2><el-icon><MagicStick /></el-icon> 趋势预测</h2></div><span class="simulation-label">Python ML 预测</span></div><div class="forecast-tip">基于未来24小时机器学习预测输出。</div><div class="forecast-list"><div v-for="item in forecast" :key="item.label" class="forecast-item"><span>{{ item.label }}</span><strong>{{ item.value }} <small>mg/L</small></strong><em :class="item.level === 'normal' ? 'safe' : 'focus'"><ArrowUp /> {{ item.levelLabel }}</em></div><div v-if="!forecast.length" class="empty-state">暂无预测数据</div></div></section></section><footer class="dashboard-footer"><span><i class="footer-pulse"></i> 数据源：水质监测数据</span><span>最后同步：{{ current.time || '等待连接' }}</span><span>系统版本 v1.1.0 · AQUA5G</span></footer></div></main></div>
</template>
