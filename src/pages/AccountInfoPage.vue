<script setup>
import { NAvatar, NCard, NDescriptions, NDescriptionsItem, NSpace, NTag } from 'naive-ui'
import AuthRequiredResult from '../components/AuthRequiredResult.vue'

defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  userProfile: {
    type: Object,
    default: null,
  },
})
</script>

<template>
  <auth-required-result v-if="!isAuthenticated" />
  <n-card v-else embedded>
    <n-space vertical size="large">
      <img
        v-if="userProfile?.avatar"
        :key="userProfile?.avatar || userProfile?.id || 'guest'"
        :src="userProfile.avatar"
        alt="user avatar"
        referrerpolicy="no-referrer"
        style="width: 72px; height: 72px; border-radius: 9999px; object-fit: cover; display: block;"
      />
      <n-avatar v-else round :size="72">
        {{ userProfile?.nickname?.slice(0, 1) || 'U' }}
      </n-avatar>

      <n-descriptions bordered label-placement="left" :column="1">
        <n-descriptions-item label="昵称">
          {{ userProfile?.nickname || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="抖音号">
          {{ userProfile?.douyinId || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="用户 ID">
          {{ userProfile?.id || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="VIP">
          <n-tag :type="userProfile?.isVip ? 'success' : 'default'">
            {{ userProfile?.isVip ? `是 (${userProfile?.vipStage || 'vip'})` : '否' }}
          </n-tag>
        </n-descriptions-item>
      </n-descriptions>
    </n-space>
  </n-card>
</template>
