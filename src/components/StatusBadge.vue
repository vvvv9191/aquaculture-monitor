<script setup>
import { computed } from 'vue'
import { ALERT_LEVELS } from '../utils/alert'
const props = defineProps({ level: { type: String, default: 'normal' }, text: { type: String, default: '' } })
const info = computed(() => ALERT_LEVELS[props.level] || ALERT_LEVELS.normal)
</script>
<template><span class="status-badge" :class="info.className"><i></i>{{ text || info.label }}</span></template>
