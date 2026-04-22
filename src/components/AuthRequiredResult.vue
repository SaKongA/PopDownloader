<template>
  <n-card embedded>
    <n-result
      status="warning"
      title="需要先登录"
      description="请先完成登录后再访问当前页面内容。"
    />
  </n-card>
</template>

<script setup>
import { NCard, NResult } from 'naive-ui'
</script>
