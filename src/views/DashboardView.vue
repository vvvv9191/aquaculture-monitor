<script setup>
import { computed, onMounted } from 'vue'
import { ArrowUp, DataLine, MagicStick } from '@element-plus/icons-vue'
import SidebarNav from '../components/SidebarNav.vue'
import TopStatusBar from '../components/TopStatusBar.vue'
import MetricCard from '../components/MetricCard.vue'
import TrendChart from '../components/TrendChart.vue'
import AlertPanel from '../components/AlertPanel.vue'
import DevicePanel from '../components/DevicePanel.vue'
import { WATER_QUALITY_METRICS } from '../config/waterQuality'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const metrics = WATER_QUALITY_METRICS
const previous = computed(() => store.history[store.history.length - 2] || store.current || {})
const current = computed(() => store.current || {})
const forecast = computed(() => store.prediction?.points?.map((point) => ({ label: `${point.hour}小时后`, value: point.value.toFixed(1), level: point.value < 5 ? '关注' : '安全' })) || [])
onMounted(() => store.init())
</script>

<template>
  <div class="app-shell"><SidebarNav /><main class="main-content"><TopStatusBar /><div class="dashboard-content" v-loading="!store.current" element-loading-background="rgba(7, 20, 31, .85)"><section class="metrics-grid"><MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" :value="Number(current[metric.key] || 0)" :previous="Number(previous[metric.key] || current[metric.key] || 0)" /></section><section class="main-grid"><section class="panel chart-panel"><div class="panel-heading"><div><span class="section-kicker">REAL-TIME TREND</span><h2><el-icon><DataLine /></el-icon> 水质趋势</h2></div><div class="chart-meta"><span class="live-dot"></span>每 5 秒更新 <span class="time-range">近 90 分钟</span></div></div><TrendChart :history="store.history" /></section><AlertPanel :alerts="store.currentAlerts" /></section><section class="bottom-grid"><DevicePanel :aerator="store.aerator" :oxygen="Number(current.dissolvedOxygen || 0)" @toggle="store.setAerator" @mode="store.setAeratorMode" /><section class="panel forecast-panel"><div class="panel-heading"><div><span class="section-kicker">SIMULATION FORECAST</span><h2><el-icon><MagicStick /></el-icon> 趋势预测</h2></div><span class="simulation-label">模拟数据</span></div><div class="forecast-tip">当前为模拟预测结果，后续接入实际时间序列预测模型。</div><div class="forecast-list"><div v-for="item in forecast" :key="item.label" class="forecast-item"><span>{{ item.label }}</span><strong>{{ item.value }} <small>mg/L</small></strong><em :class="item.level === '安全' ? 'safe' : 'focus'"><ArrowUp /> {{ item.level }}</em></div></div></section></section><footer class="dashboard-footer"><span><i class="footer-pulse"></i> 数据源：统一模拟传感器集群 TJ-AQ-001</span><span>最后同步：{{ current.time || '等待连接' }}</span><span>系统版本 v1.1.0</span></footer></div></main></div>
</template>
