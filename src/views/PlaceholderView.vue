<script setup>
defineProps({ title: { type: String, required: true }, description: { type: String, default: '该模块将在下一阶段接入。' } })
</script>
<template><div class="placeholder-page"><div class="placeholder-icon">⌁</div><span class="section-kicker">MODULE PREVIEW</span><h1>{{ title }}</h1><p>{{ description }}</p><span class="demo-badge">页面正在升级</span></div></template>
