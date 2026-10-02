<script setup>
import { ref } from 'vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({ alerts: { type: Array, default: () => [] }, compact: { type: Boolean, default: false } })
const emit = defineEmits(['handle', 'observe', 'processing', 'trend'])
const expandedId = ref('')

function toggleDetails(id) {
  expandedId.value = expandedId.value === id ? '' : id
}

function displayValue(row) {
  const value = row.source === 'forecast' ? row.predictedValue : row.value
  return value === null || value === undefined ? '--' : `${value}${row.unit ? ` ${row.unit}` : ''}`
}

function displayTime(row) {
  return row.source === 'forecast' ? row.forecastTime : row.time
}

function statusClass(status) {
  if (status === '未处理' || status === '待观察') return 'pending'
  if (status === '处理中') return 'processing'
  return 'done'
}
</script>

<template>
  <div class="data-table-wrap alert-table-scroll"><table class="data-table alert-data-table"><colgroup v-if="!compact"><col class="alert-col-time" /><col class="alert-col-farm" /><col class="alert-col-source" /><col class="alert-col-metric" /><col class="alert-col-value" /><col class="alert-col-range" /><col class="alert-col-level" /><col class="alert-col-reason" /><col class="alert-col-status" /><col class="alert-col-action" /></colgroup><colgroup v-else><col class="alert-col-time" /><col class="alert-col-farm" /><col class="alert-col-source" /><col class="alert-col-metric" /><col class="alert-col-value" /><col class="alert-col-level" /><col class="alert-col-status" /></colgroup><thead><tr><th>告警时间 / 预计时间</th><th>养殖场</th><th>类型</th><th>指标</th><th>数值</th><th v-if="!compact">正常范围</th><th>告警等级</th><th v-if="!compact">告警原因</th><th>状态</th><th v-if="!compact">操作</th></tr></thead><tbody><template v-for="row in props.alerts" :key="row.id"><tr class="alert-table-row" :class="{ expanded: expandedId === row.id }" tabindex="0" role="button" :aria-expanded="expandedId === row.id" @click="toggleDetails(row.id)" @keydown.enter="toggleDetails(row.id)" @keydown.space.prevent="toggleDetails(row.id)"><td>{{ displayTime(row) }}</td><td :title="row.farm">{{ row.farm }}</td><td><span class="alert-source-tag" :class="row.source">{{ row.source === 'forecast' ? '预测' : row.source === 'history' ? '历史' : '实时' }}</span></td><td>{{ row.metricLabel }}</td><td class="value-highlight">{{ displayValue(row) }}</td><td v-if="!compact">{{ row.normalRange || '--' }}</td><td><StatusBadge :level="row.level" /></td><td v-if="!compact"><div>{{ row.reason || '指标超出安全范围' }}</div><small v-if="row.source === 'forecast'" class="table-tip">模型：{{ row.model }}</small></td><td><span class="table-status" :class="statusClass(row.status)">{{ row.status }}</span></td><td v-if="!compact" class="alert-actions"><button v-if="row.source !== 'forecast' && row.status === '未处理'" class="table-action" @click.stop="emit('processing', row.id)">标记处理中</button><button v-if="row.status !== '已处理' && row.status !== '已解除'" class="table-action" @click.stop="emit(row.source === 'forecast' ? 'observe' : 'handle', row.id)">{{ row.source === 'forecast' ? '标记已观察' : '标记已处理' }}</button><button v-if="row.source === 'forecast'" class="table-action trend-action" @click.stop="emit('trend', row)">查看趋势</button><span v-if="row.status === '已处理' || row.status === '已解除'" class="muted-text">—</span></td></tr><tr v-if="expandedId === row.id" class="alert-detail-row"><td :colspan="compact ? 7 : 10"><div class="alert-detail-grid"><div><span>养殖场</span><strong>{{ row.farm }}</strong></div><div><span>指标</span><strong>{{ row.metricLabel }} / {{ row.directionLabel }}</strong></div><div><span>数据来源</span><strong>{{ row.source === 'realtime' ? '最新真实监测数据' : row.source === 'history' ? '历史监测数据' : '未来24小时机器学习预测' }}</strong></div><div><span>{{ row.source === 'forecast' ? '预测值' : '当前值' }}</span><strong>{{ displayValue(row) }}</strong></div><div><span>正常范围</span><strong>{{ row.normalRange }}</strong></div><div><span>黄色边界</span><strong>{{ row.yellowBoundary ?? '未启用' }}</strong></div><div><span>橙色边界</span><strong>{{ row.orangeBoundary ?? '未启用' }}</strong></div><div><span>风险等级</span><strong><StatusBadge :level="row.level" /></strong></div><div><span>{{ row.source === 'forecast' ? '预计发生时间' : '监测时间' }}</span><strong>{{ displayTime(row) }}</strong></div><div v-if="row.source === 'forecast'"><span>提前时间</span><strong>约 {{ row.horizonHours }} 小时</strong></div><div v-if="row.source === 'forecast'"><span>模型</span><strong>{{ row.model }}</strong></div><div><span>客观原因</span><strong>{{ row.reason }}</strong></div></div><div v-if="row.source === 'forecast' && (row.escalationTimes?.yellow || row.escalationTimes?.orange || row.escalationTimes?.red)" class="alert-escalation"><span>风险进入时间：</span><b v-if="row.escalationTimes.yellow">黄色 {{ row.escalationTimes.yellow }}</b><b v-if="row.escalationTimes.orange">橙色 {{ row.escalationTimes.orange }}</b><b v-if="row.escalationTimes.red">红色 {{ row.escalationTimes.red }}</b></div></td></tr></template><tr v-if="!props.alerts.length"><td :colspan="compact ? 7 : 10" class="table-empty">暂无告警记录</td></tr></tbody></table></div>
</template>
