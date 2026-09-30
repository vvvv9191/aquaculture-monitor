<script setup>
import { RouterLink } from 'vue-router'
import { Monitor, DataLine, Bell, TrendCharts, SetUp, Connection } from '@element-plus/icons-vue'

const navItems = [
  { label: '综合监控大屏', path: '/', icon: Monitor },
  { label: '实时监测', path: '/monitor', icon: Connection },
  { label: '历史数据分析', path: '/history', icon: DataLine },
  { label: '智能预警', path: '/alerts', icon: Bell },
  { label: '趋势预测', path: '/prediction', icon: TrendCharts },
  { label: '设备控制', path: '/devices', icon: SetUp },
  { label: '系统设置', path: '/settings', icon: SetUp },
]
</script>

<template>
  <aside class="sidebar"><div class="brand-block">
      <div class="brand-row">
        <img src="/TJ5G.png" alt="logo" class="brand-icon">
        <div class="brand-title">
          TJ<span>5G</span>
        </div>
      </div>
      <div class="brand-subtitle">
        水产养殖智能监测系统
      </div>
    </div><div class="nav-caption">功能导航</div><nav class="main-nav"><RouterLink v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item"><el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span><i class="nav-active-dot"></i></RouterLink></nav><div class="sidebar-footer"><div class="system-version"><span class="status-dot"></span>系统运行中</div><div>v1.1.0 · AQUA5G</div></div></aside>
</template>
