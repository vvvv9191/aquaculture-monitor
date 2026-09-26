<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { WATER_QUALITY_METRICS } from '../config/waterQuality'

const props = defineProps({ history: { type: Array, default: () => [] } })
const chartRef = ref(null)
let chart

function renderChart() {
  if (!chartRef.value || !props.history.length) return
  chart ||= echarts.init(chartRef.value)
  const xAxis = props.history.map((point) => point.time.slice(11, 16))
  const selectedKeys = ['temperature', 'ph', 'dissolvedOxygen']
  chart.setOption({
    animationDuration: 500,
    color: selectedKeys.map((key) => WATER_QUALITY_METRICS.find((item) => item.key === key).color),
    tooltip: { trigger: 'axis', backgroundColor: '#102b3d', borderColor: '#25516b', textStyle: { color: '#eafaff' } },
    legend: { top: 0, right: 0, textStyle: { color: '#8ea9ba', fontSize: 12 }, data: selectedKeys.map((key) => WATER_QUALITY_METRICS.find((item) => item.key === key).label) },
    grid: { top: 38, right: 12, bottom: 24, left: 42 },
    xAxis: { type: 'category', boundaryGap: false, data: xAxis, axisLine: { lineStyle: { color: '#294759' } }, axisLabel: { color: '#718d9f', fontSize: 11 }, axisTick: { show: false } },
    yAxis: { type: 'value', splitNumber: 4, axisLabel: { color: '#718d9f', fontSize: 11 }, splitLine: { lineStyle: { color: '#1b3544', type: 'dashed' } }, axisLine: { show: false } },
    series: selectedKeys.map((key) => { const metric = WATER_QUALITY_METRICS.find((item) => item.key === key); return { name: metric.label, type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2 }, areaStyle: { opacity: 0.05 }, data: props.history.map((point) => point[key]) } }),
  })
}
function resize() { chart?.resize() }
watch(() => props.history, () => nextTick(renderChart), { deep: true })
onMounted(() => { nextTick(renderChart); window.addEventListener('resize', resize) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); chart?.dispose() })
</script>

<template><div ref="chartRef" class="trend-chart"></div></template>
