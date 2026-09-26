<script setup>
import { computed } from 'vue'
import { SetUp, SwitchButton } from '@element-plus/icons-vue'
import { DEVICE_CONTROL_CONFIG } from '../config/waterQuality'
const props = defineProps({ aerator: { type: Object, required: true }, oxygen: { type: Number, default: 0 } })
const emit = defineEmits(['toggle', 'mode'])
const modeLabel = computed(() => props.aerator.mode === 'auto' ? '自动模式' : '手动模式')
</script>

<template>
  <section class="panel device-panel"><div class="panel-heading"><div><span class="section-kicker">DEVICE CONTROL</span><h2><el-icon><SetUp /></el-icon> 设备控制状态</h2></div><span class="demo-badge">模拟设备</span></div><div class="device-card"><div class="device-visual" :class="{ active: aerator.active }"><div class="fan-ring"><span>✦</span></div><i></i><i></i><i></i></div><div class="device-info"><div class="device-title"><strong>{{ DEVICE_CONTROL_CONFIG.aerator.label }}</strong><span class="online-label"><i></i>在线</span></div><div class="device-status" :class="{ active: aerator.active }">{{ aerator.active ? '运行中' : '待机中' }}</div><div class="device-meta">{{ aerator.lastAction }}</div></div><div class="device-actions"><div class="mode-switch"><button :class="{ selected: aerator.mode === 'auto' }" @click="emit('mode', 'auto')">自动</button><button :class="{ selected: aerator.mode === 'manual' }" @click="emit('mode', 'manual')">手动</button></div><button class="power-button" :class="{ active: aerator.active }" :disabled="aerator.mode === 'auto'" @click="emit('toggle', !aerator.active)"><el-icon><SwitchButton /></el-icon>{{ aerator.active ? '关闭' : '开启' }}</button></div></div><div class="control-rule"><span>自动控制规则</span><span>溶解氧 &lt; {{ DEVICE_CONTROL_CONFIG.aerator.lowThreshold }} mg/L 启动</span><span>≥ {{ DEVICE_CONTROL_CONFIG.aerator.highThreshold }} mg/L 关闭</span><span class="oxygen-live">当前 {{ oxygen.toFixed(1) }} mg/L</span></div></section>
</template>
