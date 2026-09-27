<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { getMetricConfig } from '../config/waterQualityConfig'

const props = defineProps({ history: { type: Array, default: () => [] }, metricKey: { type: String, default: 'dissolvedOxygen' }, height: { type: String, default: '280px' }, timeFormat: { type: String, default: 'time' } })
const chartRef = ref(null)
let chart

function formatPointTime(point) {
  const value = String(point?.time || '')
  return props.timeFormat === 'datetime' ? value.slice(5, 16) : value.slice(11, 16)
}

function renderChart() {
  if (!chartRef.value || !props.history.length) return
  chart ||= echarts.init(chartRef.value)
  const metric = getMetricConfig(props.metricKey)
  chart.setOption({
    animationDuration: 450,
    color: [metric?.color || '#35d5c5'],
    tooltip: { trigger: 'axis', backgroundColor: '#102b3d', borderColor: '#25516b', textStyle: { color: '#eafaff' }, formatter: (params) => `${params[0].axisValue}<br/>${metric?.label || props.metricKey}：${params[0].value} ${metric?.unit || ''}` },
    grid: { top: 26, right: 18, bottom: 30, left: 46 },
    xAxis: { type: 'category', boundaryGap: false, data: props.history.map(formatPointTime), axisLine: { lineStyle: { color: '#294759' } }, axisLabel: { color: '#718d9f', fontSize: 10 }, axisTick: { show: false } },
    yAxis: { type: 'value', splitNumber: 4, axisLabel: { color: '#718d9f', fontSize: 10 }, splitLine: { lineStyle: { color: '#1b3544', type: 'dashed' } }, axisLine: { show: false } },
    series: [{ name: metric?.label, type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2 }, areaStyle: { opacity: 0.09 }, data: props.history.map((point) => point[props.metricKey]) }],
  })
}
function resize() { chart?.resize() }
watch(() => [props.history, props.metricKey, props.timeFormat], () => nextTick(renderChart), { deep: true })
onMounted(() => { nextTick(renderChart); window.addEventListener('resize', resize) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); chart?.dispose() })
</script>
<template><div ref="chartRef" class="realtime-chart" :style="{ height }"></div></template>
