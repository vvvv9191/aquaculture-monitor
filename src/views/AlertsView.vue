<script setup>
import { computed, onMounted, ref } from 'vue'
import { Bell, CircleCheck, Warning, VideoPlay } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'
import AlertTable from '../components/AlertTable.vue'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const filter = ref('all')
const filterOptions = [{ label: '全部', value: 'all' }, { label: '未处理', value: 'pending' }, { label: '已处理', value: 'handled' }]
const filteredAlerts = computed(() => store.alerts.filter((alert) => filter.value === 'all' || (filter.value === 'pending' ? alert.status !== '已处理' && alert.status !== '已确认' : alert.status === '已处理' || alert.status === '已确认')))
onMounted(() => store.init())
</script>

<template>
  <PageShell title="智能预警"><section class="alert-page-head"><div><span class="section-kicker">RULE-BASED ALERT CENTER</span><p>基于统一水质阈值的实时规则预警</p></div><button class="demo-action-button" :class="{ running: store.demoActive }" :disabled="store.demoActive" @click="store.simulateLowOxygen"><el-icon><VideoPlay /></el-icon>{{ store.demoActive ? '模拟异常进行中...' : '演示模式 · 模拟缺氧' }}</button></section><section class="alert-stats-grid"><div class="alert-stat-card"><span class="alert-stat-icon blue"><Bell /></span><div><small>今日告警数量</small><strong>{{ store.todayAlertCount }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon yellow"><Warning /></span><div><small>未处理告警</small><strong>{{ store.unhandledAlertCount }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon green"><CircleCheck /></span><div><small>已处理告警</small><strong>{{ store.handledAlertCount }}</strong></div></div><div class="alert-stat-card"><span class="alert-stat-icon red"><Warning /></span><div><small>严重告警</small><strong>{{ store.severeAlertCount }}</strong></div></div></section><section class="panel alert-table-panel"><div class="panel-heading"><div><span class="section-kicker">ALERT RECORDS</span><h2><el-icon><Bell /></el-icon> 告警记录</h2></div><div class="alert-filter-tabs"><button v-for="option in filterOptions" :key="option.value" :class="{ active: filter === option.value }" @click="filter = option.value">{{ option.label }}</button></div></div><div class="alert-advice"><strong>演示提示：</strong>点击“模拟缺氧”后，1号养殖池 DO 将按 5.8 → 5.2 → 4.7 → 4.2 → 3.8 mg/L 逐步下降，触发分级告警和自动增氧。</div><AlertTable :alerts="filteredAlerts" @handle="store.markAlertHandled" /></section></PageShell>
</template>
