<script setup>
import { computed, onMounted, ref } from 'vue'
import { DataLine, Refresh, Warning } from '@element-plus/icons-vue'
import SidebarNav from '../components/SidebarNav.vue'
import TopStatusBar from '../components/TopStatusBar.vue'
import MetricCard from '../components/MetricCard.vue'
import TrendChart from '../components/TrendChart.vue'
import { WATER_QUALITY_METRICS } from '../config/waterQuality'
import { FARM_OPTIONS } from '../config/farms'
import { buildRealtimeSeries } from '../data/realtimeData'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const metrics = WATER_QUALITY_METRICS
const selectedFarmId = ref(FARM_OPTIONS[0].id)
const loading = ref(true)

const series = computed(() => buildRealtimeSeries(selectedFarmId.value))
const current = computed(() => series.value.at(-1) || {})
const previous = computed(() => series.value.at(-2) || current.value)

onMounted(async () => {
  loading.value = true
  try {
    await store.init()
  } catch {
    // 错误状态由 store.dataError 展示，避免静默空白页。
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="app-shell">
    <SidebarNav />
    <main class="main-content">
      <TopStatusBar />
      <div class="dashboard-content" v-loading="loading" element-loading-background="rgba(7, 20, 31, .85)">
        <section v-if="store.dataError" class="alert-error panel"><Warning /><span>{{ store.dataError }}</span><button class="secondary-button" @click="store.init(true)"><el-icon><Refresh /></el-icon>重新加载</button></section>

        <section class="dashboard-farm-bar">
          <div class="dashboard-farm-title">
            <span class="section-kicker">FARM SELECTION</span>
            <strong>当前养殖场</strong>
          </div>
          <el-select v-model="selectedFarmId" aria-label="选择养殖场">
            <el-option v-for="farm in FARM_OPTIONS" :key="farm.id" :label="farm.name" :value="farm.id" />
          </el-select>
          <span class="dashboard-farm-note">监测数据与趋势随养殖场实时切换</span>
        </section>

        <section class="metrics-grid">
          <MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" :value="current[metric.key]" :previous="previous[metric.key] ?? current[metric.key]" :time="current.time" />
        </section>

        <section class="panel chart-panel">
          <div class="panel-heading">
            <div>
              <span class="section-kicker">REAL-TIME TREND</span>
              <h2><el-icon><DataLine /></el-icon> 水质趋势</h2>
            </div>
            <div class="chart-meta"><span class="live-dot" :class="{ 'error-dot': store.dataError }"></span>{{ store.deviceStatus.network }}<span v-if="store.lastSyncAt" class="time-sync">同步于 {{ store.lastSyncAt }}</span><span class="time-range">近 90 分钟</span></div>
          </div>
          <TrendChart :history="series" />
        </section>
      </div>
    </main>
  </div>
</template>
