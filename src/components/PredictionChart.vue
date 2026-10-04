<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
const props = defineProps({ history: { type: Array, default: () => [] }, prediction: { type: Object, default: null } })
const chartRef = ref(null)
let chart
let resizeObserver
function renderChart() {
  if (!chartRef.value) return
  if (!props.prediction) {
    chart?.clear()
    return
  }
  chart ||= echarts.init(chartRef.value)
  const history = props.history.slice(-18)
  const pastLabels = history.map((point) => point.time.slice(11, 16))
  const future = props.prediction.points || []
  const labels = [...pastLabels, ...future.map((point) => `+${point.hour}h`)]
  chart.setOption({ color: ['#6de2ff', '#f6c453'], tooltip: { trigger: 'axis', backgroundColor: '#102b3d', borderColor: '#25516b', textStyle: { color: '#eafaff' } }, legend: { top: 0, right: 0, textStyle: { color: '#8ea9ba', fontSize: 11 }, data: ['已监测数据', '模拟预测数据'] }, grid: { top: 34, right: 16, bottom: 28, left: 45 }, xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: '#294759' } }, axisLabel: { color: '#718d9f', fontSize: 10 } }, yAxis: { type: 'value', name: 'mg/L', nameTextStyle: { color: '#718d9f', fontSize: 10 }, axisLabel: { color: '#718d9f', fontSize: 10 }, splitLine: { lineStyle: { color: '#1b3544', type: 'dashed' } } }, series: [{ name: '已监测数据', type: 'line', smooth: true, symbol: 'none', data: [...history.map((point) => point.dissolvedOxygen), ...future.map(() => null)] }, { name: '模拟预测数据', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { type: 'dashed', width: 2 }, data: [...history.map((_, index) => index === history.length - 1 ? props.prediction.current : null), ...future.map((point) => point.value)] }], })
}
function resize() { chart?.resize() }
watch(() => [props.history, props.prediction], () => nextTick(renderChart), { deep: true })
onMounted(() => {
  nextTick(renderChart)
  window.addEventListener('resize', resize)
  if (typeof ResizeObserver !== 'undefined' && chartRef.value) {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(chartRef.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>
<template><div ref="chartRef" class="prediction-chart"></div></template>
