<script setup>
import SidebarNav from './SidebarNav.vue'
defineProps({ title: { type: String, required: true }, eyebrow: { type: String, default: '天津沿海 · 智慧水产物联网平台' } })
</script>

<template>
  <div class="app-shell"><SidebarNav /><main class="main-content"><header class="feature-topbar"><div><div class="eyebrow">{{ eyebrow }}</div><h1>{{ title }}</h1></div><div class="feature-topbar-right"><span class="live-dot"></span><span>模拟数据在线</span><span class="feature-clock">5G专网稳定</span></div></header><div class="feature-content"><slot /></div></main></div>
</template>
