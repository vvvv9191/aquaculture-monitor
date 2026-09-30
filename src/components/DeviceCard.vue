<script setup>
import { computed } from 'vue'
import { SwitchButton, SetUp } from '@element-plus/icons-vue'
const props = defineProps({ device: { type: Object, required: true } })
const emit = defineEmits(['toggle', 'mode'])
const isOn = computed(() => props.device.status === 'on')
const activeLabel = computed(() => props.device.type === 'heater' ? '加热中' : '运行中')
</script>
<template><article class="device-control-card"><div class="device-card-top"><div class="device-visual" :class="{ active: isOn }"><div class="fan-ring"><span>{{ device.type === 'heater' ? '♨' : '✦' }}</span></div><i></i><i></i><i></i></div><div class="device-card-info"><div class="device-title"><strong>{{ device.name }}</strong><span class="online-label" :class="{ offline: !device.online }"><i></i>{{ device.online ? '在线' : '离线' }}</span></div><p>{{ device.pondName }}</p><span class="device-status" :class="{ active: isOn }">{{ isOn ? activeLabel : '已关闭' }}</span></div></div><div class="device-card-line"><span>控制模式</span><div class="mode-switch"><button :class="{ selected: device.mode === 'auto' }" @click="emit('mode', 'auto')">自动</button><button :class="{ selected: device.mode === 'manual' }" @click="emit('mode', 'manual')">手动</button></div></div><div class="device-card-line"><span>最后运行</span><span class="device-time">{{ device.lastRunTime }}</span></div><button class="device-power-button" :class="{ active: isOn }" :disabled="device.mode === 'auto' || !device.online" @click="emit('toggle', !isOn)"><el-icon><SwitchButton /></el-icon>{{ isOn ? '关闭设备' : '开启设备' }}<small v-if="device.mode === 'auto'">自动模式控制中</small></button></article></template>
