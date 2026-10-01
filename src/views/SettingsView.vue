<script setup>
import { reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, Refresh, Setting } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'
import LongPressInputNumber from '../components/LongPressInputNumber.vue'
import { CULTURE_OPTIONS, WATER_QUALITY_METRICS } from '../config/waterQualityConfig'
import { useMonitorStore } from '../stores/monitor'

const store = useMonitorStore()
const clone = (value) => JSON.parse(JSON.stringify(value))
const form = reactive(clone(store.settings))
const cultureForm = reactive(clone(store.culture))

const warningDirections = [
  { key: 'lowWarning', label: '偏低预警', icon: '↓', relation: '红色 ← 橙色 ← 黄色 ← 正常' },
  { key: 'highWarning', label: '偏高预警', icon: '↑', relation: '正常 → 黄色 → 橙色 → 红色' },
]

function save() {
  const result = store.saveSettings(form)
  if (!result.valid) {
    ElMessage.error(result.errors[0])
    return
  }
  store.saveCulture(cultureForm)
  const profile = store.saveThresholdProfile()
  ElMessage.success(`${profile.species}，${profile.stage}阈值配置已保存并同步`)
}

function formatBoundary(value, metric) {
  if (value === null || value === undefined) return '关闭'
  return Number(value).toFixed(metric.decimals)
}

function savedProfileTitle(profile) {
  return `${profile.species}，${profile.stage}阈值配置`
}

function applyProfile(profile) {
  const result = store.applyThresholdProfile(profile)
  if (!result.valid) {
    ElMessage.error(result.errors[0])
    return
  }
  WATER_QUALITY_METRICS.forEach(({ key }) => Object.assign(form[key], clone(store.settings[key])))
  cultureForm.species = store.culture.species
  cultureForm.stage = store.culture.stage
  ElMessage.success(`${savedProfileTitle(profile)}已应用`)
}

function reset() {
  store.resetSettings()
  WATER_QUALITY_METRICS.forEach(({ key }) => Object.assign(form[key], clone(store.settings[key])))
  ElMessage.success('已恢复默认阈值')
}

onMounted(() => store.init())
</script>

<template>
  <PageShell title="系统设置">
    <section class="settings-head"><div><span class="section-kicker">SYSTEM CONFIGURATION</span><p>为每项指标分别配置正常范围、偏低预警和偏高预警。</p></div><div class="settings-actions"><button class="secondary-button" @click="reset"><el-icon><Refresh /></el-icon>恢复默认</button><button class="primary-button" @click="save"><el-icon><Setting /></el-icon>保存设置</button></div></section>
    <section class="settings-layout"><div class="settings-main"><section class="panel settings-panel"><div class="panel-heading"><div><span class="section-kicker">WATER QUALITY THRESHOLDS</span><h2>六项水质阈值配置</h2></div><span class="simulation-label">Pinia + localStorage</span></div><div class="threshold-help"><span>正常范围优先判断；越过橙色边界后自动进入红色预警。</span><strong>低值和高值方向可独立启用</strong></div><div class="threshold-card-list"><article v-for="item in WATER_QUALITY_METRICS" :key="item.key" class="threshold-card direction-threshold-card"><div class="threshold-card-title"><span class="metric-symbol" :style="{ color: item.color, borderColor: `${item.color}66` }">{{ item.icon }}</span><div><strong>{{ item.label }}<small v-if="item.unit"> / {{ item.unit }}</small></strong><span>正常范围 + 双方向预警</span></div></div><div class="normal-threshold-block"><div class="threshold-block-title"><span class="threshold-tone normal-tone"></span><strong>正常范围</strong></div><div class="normal-threshold-fields"><label>最低值<LongPressInputNumber v-model="form[item.key].normal.min" :precision="item.decimals" :step="0.1" controls-position="right" /></label><label>最高值<LongPressInputNumber v-model="form[item.key].normal.max" :precision="item.decimals" :step="0.1" controls-position="right" /></label></div></div><div class="warning-direction-grid"><section v-for="direction in warningDirections" :key="direction.key" class="warning-direction" :class="direction.key"><div class="warning-direction-head"><div><strong>{{ direction.icon }} {{ direction.label }}</strong><span>{{ direction.relation }}</span></div><el-switch v-model="form[item.key][direction.key].enabled" inline-prompt active-text="开" inactive-text="关" /></div><div class="warning-boundary-fields"><label>黄色边界<LongPressInputNumber v-model="form[item.key][direction.key].yellow" :precision="item.decimals" :step="0.1" controls-position="right" :disabled="!form[item.key][direction.key].enabled" /></label><label>橙色边界<LongPressInputNumber v-model="form[item.key][direction.key].orange" :precision="item.decimals" :step="0.1" controls-position="right" :disabled="!form[item.key][direction.key].enabled" /></label></div><p class="red-boundary-note">超过橙色边界自动判定为红色预警</p></section></div></article></div></section></div><aside class="settings-side"><section class="panel culture-panel"><div class="panel-heading"><div><span class="section-kicker">CULTURE PROFILE</span><h2>养殖配置</h2></div></div><div class="settings-field"><label>养殖品种</label><el-select v-model="cultureForm.species"><el-option v-for="species in CULTURE_OPTIONS.species" :key="species" :label="species" :value="species" /></el-select></div><div class="settings-field"><label>生长阶段</label><el-select v-model="cultureForm.stage"><el-option v-for="stage in CULTURE_OPTIONS.stages" :key="stage" :label="stage" :value="stage" /></el-select></div><div class="culture-note"><el-icon><Connection /></el-icon><span>关闭某一方向后，该方向数值不会触发黄色、橙色或红色预警。</span></div></section><section v-if="false" class="panel settings-future"><span class="section-kicker">PLANNED CONFIGURATION</span><h2>后续配置预留</h2><p>自动控制规则模板</p><p>设备分组与权限</p><p>传感器校准参数</p></section></aside></section>
  <section class="panel saved-threshold-panel"><div class="panel-heading"><div><span class="section-kicker">SAVED THRESHOLD PROFILES</span><h2>{{ store.culture.species }}，{{ store.culture.stage }}阈值配置</h2></div><span class="simulation-label">已保存配置</span></div><div v-if="store.savedThresholdProfiles.length" class="saved-threshold-list"><article v-for="profile in store.savedThresholdProfiles" :key="profile.id" class="saved-threshold-profile"><div class="saved-profile-head"><div><strong>{{ savedProfileTitle(profile) }}</strong><span>保存于 {{ profile.savedAt }}</span></div><button class="profile-apply-button" @click="applyProfile(profile)">应用此配置</button></div><div class="saved-threshold-grid"><div v-for="metric in WATER_QUALITY_METRICS" :key="metric.key" class="saved-threshold-item"><strong>{{ metric.label }}</strong><span>正常：{{ formatBoundary(profile.settings[metric.key].normal.min, metric) }}～{{ formatBoundary(profile.settings[metric.key].normal.max, metric) }}{{ metric.unit }}</span><span>偏低：{{ profile.settings[metric.key].lowWarning.enabled ? `${formatBoundary(profile.settings[metric.key].lowWarning.yellow, metric)} / ${formatBoundary(profile.settings[metric.key].lowWarning.orange, metric)}` : '关闭' }}</span><span>偏高：{{ profile.settings[metric.key].highWarning.enabled ? `${formatBoundary(profile.settings[metric.key].highWarning.yellow, metric)} / ${formatBoundary(profile.settings[metric.key].highWarning.orange, metric)}` : '关闭' }}</span></div></div></article></div><div v-else class="saved-threshold-empty">点击“保存设置”后，当前品种和阶段的六项阈值配置会显示在这里。</div></section>
   </PageShell>
</template>
