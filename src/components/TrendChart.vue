<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { WATER_QUALITY_METRICS } from '../config/waterQuality'

const props = defineProps({ history: { type: Array, default: () => [] } })
const chartRef = ref(null)
let chart

// 三条曲线共用同一个数值坐标轴。
const seriesConfig = ['temperature', 'ph', 'dissolvedOxygen']
const metricOf = (key) => WATER_QUALITY_METRICS.find((item) => item.key === key)
const seriesName = (key) => {
  const metric = metricOf(key)
  return metric.unit ? `${metric.label} (${metric.unit})` : metric.label
}

function renderChart() {
  if (!chartRef.value || !props.history.length) return
  chart ||= echarts.init(chartRef.value)
  chart.setOption({
    animationDuration: 500,
    color: seriesConfig.map((key) => metricOf(key).color),
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#102b3d',
      borderColor: '#25516b',
      textStyle: { color: '#eafaff' },
      formatter: (params) => {
        const lines = params.map((param) => {
          const metric = metricOf(seriesConfig[param.seriesIndex])
          return `${param.marker}${param.seriesName}：${param.value} ${metric.unit}`
        })
        return [params[0]?.axisValue, ...lines].join('<br/>')
      },
    },
    legend: { top: 2, left: 'center', itemWidth: 14, itemHeight: 8, itemGap: 20, textStyle: { color: '#9dbdca', fontSize: 12 }, data: seriesConfig.map(seriesName) },
    grid: { top: 52, right: 28, bottom: 32, left: 58, containLabel: false },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.history.map((point) => point.time.slice(11, 16)),
      axisLine: { lineStyle: { color: '#294759' } },
      axisLabel: { color: '#718d9f', fontSize: 10, margin: 12 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitNumber: 5,
      axisLabel: { color: '#8ea9ba', fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#1b3544', type: 'dashed' } },
    },
    series: seriesConfig.map((key) => ({
      name: seriesName(key),
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.05 },
      data: props.history.map((point) => point[key]),
    })),
  })
}
function resize() { chart?.resize() }
watch(() => props.history, () => nextTick(renderChart), { deep: true })
onMounted(() => { nextTick(renderChart); window.addEventListener('resize', resize) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); chart?.dispose() })
</script>

<template><div ref="chartRef" class="trend-chart"></div></template>
