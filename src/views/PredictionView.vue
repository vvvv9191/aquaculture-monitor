<script setup>
import { computed, onMounted } from 'vue'
import { MagicStick, Warning } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'
import PredictionChart from '../components/PredictionChart.vue'
import { PONDS } from '../config/waterQualityConfig'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const prediction = computed(() => store.prediction)
const current = computed(() => store.selectedCurrent || {})
onMounted(() => store.init())
</script>

<template>
  <PageShell title="趋势预测"><section class="prediction-notice"><div class="notice-icon"><MagicStick /></div><div><strong>当前为模拟预测结果</strong><p>后续接入实际水质时间序列预测模型后，将由 Python/FastAPI 返回预测结果。</p></div><span class="simulation-label">演示模拟数据</span></section><section class="prediction-toolbar panel"><div><span class="section-kicker">PREDICTION TARGET</span><strong>溶解氧（DO）趋势</strong></div><div class="filter-item inline-filter"><label>养殖池</label><el-select :model-value="store.selectedPondId" @change="store.selectPond"><el-option v-for="pond in PONDS" :key="pond.id" :label="pond.name" :value="pond.id" /></el-select></div></section><template v-if="prediction"><section class="prediction-value-grid"><div class="prediction-value-card current-value"><span>当前 DO</span><strong>{{ current.dissolvedOxygen }} <small>mg/L</small></strong><em>实时监测值</em></div><div v-for="point in prediction.points" :key="point.hour" class="prediction-value-card"><span>未来{{ point.hour }}小时预测</span><strong>{{ point.value }} <small>mg/L</small></strong><em>模拟预测</em></div></section><section class="panel prediction-chart-panel"><div class="panel-heading"><div><span class="section-kicker">TIME SERIES FORECAST</span><h2><MagicStick />历史数据 + 未来预测</h2></div><span class="chart-legend-note"><i class="history-dot"></i>已监测 <i class="forecast-dot"></i>模拟预测</span></div><PredictionChart :history="store.selectedHistory" :prediction="prediction" /></section><section class="prediction-risk-grid"><div class="risk-card" :class="prediction.riskLevel === '高风险' ? 'risk-high' : prediction.riskLevel === '中风险' ? 'risk-medium' : 'risk-low'"><Warning /><div><span>当前风险等级</span><strong>{{ prediction.riskLevel }}</strong></div></div><div class="risk-card"><MagicStick /><div><span>预计达到预警阈值时间</span><strong>{{ prediction.warningTime }}</strong></div></div><div class="risk-card"><span class="trend-arrow">↘</span><div><span>未来趋势</span><strong>{{ prediction.trend }}</strong></div></div></section></template><div v-else class="page-loading">正在生成模拟预测数据…</div></PageShell>
</template>
