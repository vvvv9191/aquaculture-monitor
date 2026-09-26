<script setup>
import { computed } from 'vue'
import { useMonitorStore } from '../stores/monitor'
import { ALERT_LEVELS, evaluateMetric } from '../utils/alert'

const props = defineProps({ metric: { type: Object, required: true }, value: { type: Number, default: 0 }, previous: { type: Number, default: 0 }, time: { type: String, default: '' } })
const store = useMonitorStore()
const status = computed(() => evaluateMetric(props.metric.key, props.value, store.settings))
const statusInfo = computed(() => ALERT_LEVELS[status.value])
const direction = computed(() => props.value >= props.previous ? 'up' : 'down')
const change = computed(() => Math.abs(props.value - props.previous).toFixed(props.metric.decimals))
</script>

<template><article class="metric-card" :class="`metric-${status}`" :style="{ '--metric-color': metric.color }"><div class="metric-card-head"><div class="metric-symbol">{{ metric.icon }}</div><span class="metric-status" :class="statusInfo.className"><i></i>{{ statusInfo.label }}</span></div><div class="metric-name">{{ metric.label }} <span v-if="metric.unit">/ {{ metric.unit }}</span></div><div class="metric-value-row"><strong>{{ Number(value).toFixed(metric.decimals) }}</strong><span class="metric-unit">{{ metric.unit || ' ' }}</span></div><div class="metric-footer"><span class="trend-mark" :class="direction">{{ direction === 'up' ? '↗' : '↘' }} {{ change }}</span><span>较上一时刻</span></div><div v-if="time" class="metric-time">更新于 {{ time }}</div><div class="metric-glow"></div></article></template>
