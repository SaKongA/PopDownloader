<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  NButton,
  NEmpty,
  NInput,
  NResult,
  NSpace,
  NSpin,
  NTag,
  NText,
  createDiscreteApi,
} from 'naive-ui'
import lottie from 'lottie-web'
import ResourceDetailModal from '../components/ResourceDetailModal.vue'
import animationData from '../assets/animation.json'
import { resolveShareResource } from '../api/share'
import { fetchTrackV2 } from '../api/tracks'
import { fetchVideoV2 } from '../api/videos'

const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  userProfile: {
    type: Object,
    default: null,
  },
})

const exampleShareText = '《Shots - Broiler Remix》@汽水音乐 https://qishui.douyin.com/s/ix4QxW9H/'
const shareText = ref('')
const resolving = ref(false)
const errorMessage = ref('')
const lastResolvedMeta = ref(null)
const detailVisible = ref(false)
const selectedResource = ref(null)
const animationContainer = ref(null)
const lottieInstance = shallowRef(null)
const { message } = createDiscreteApi(['message'])

const canSubmit = computed(() => Boolean(shareText.value.trim()) && !resolving.value)

function destroyAnimation() {
  lottieInstance.value?.destroy()
  lottieInstance.value = null
}

function initAnimation() {
  if (!animationContainer.value) {
    return
  }

  destroyAnimation()
  lottieInstance.value = lottie.loadAnimation({
    container: animationContainer.value,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    animationData,
  })
}

function normalizeTrackResource(payload) {
  const track = payload?.track

  if (!track?.id) {
    throw new Error('track_v2 返回结构不符合预期。')
  }

  return {
    id: track.id,
    type: 'track',
    entity: {
      track_wrapper: {
        track,
      },
    },
  }
}

function normalizeVideoResource(payload) {
  const video = payload?.video

  if (!video?.video_id && !video?.vid) {
    throw new Error('video_v2 返回结构不符合预期。')
  }

  return {
    id: video.video_id || video.vid,
    type: 'video',
    entity: {
      video,
    },
  }
}

async function loadTrackDetail(trackId) {
  const payload = await fetchTrackV2(trackId)
  return normalizeTrackResource(payload)
}

async function loadVideoDetail(videoId) {
  const payload = await fetchVideoV2(videoId)
  return normalizeVideoResource(payload)
}

async function handleResolve() {
  if (!canSubmit.value) {
    return
  }

  if (!props.isAuthenticated) {
    message.warning('请先登录，再调用 track_v2 或 video_v2 获取详情。')
    return
  }

  resolving.value = true
  errorMessage.value = ''

  try {
    const resolved = await resolveShareResource(shareText.value)
    lastResolvedMeta.value = resolved

    let resource = null

    if (resolved.track_id) {
      resource = await loadTrackDetail(resolved.track_id)
    } else if (resolved.video_id) {
      resource = await loadVideoDetail(resolved.video_id)
    } else {
      throw new Error('解析成功，但没有拿到 track_id 或 video_id。')
    }

    selectedResource.value = resource
    detailVisible.value = true
    message.success('资源信息获取成功。')
  } catch (error) {
    selectedResource.value = null
    detailVisible.value = false
    errorMessage.value = error?.message || '解析分享链接失败'
  } finally {
    resolving.value = false
  }
}

function applyExample() {
  shareText.value = exampleShareText
}

function handleCloseDetail() {
  detailVisible.value = false
}

watch(
  () => detailVisible.value,
  (show) => {
    if (!show) {
      selectedResource.value = null
    }
  },
)

onMounted(async () => {
  await nextTick()
  initAnimation()
})

onBeforeUnmount(() => {
  destroyAnimation()
})
</script>

<template>
  <n-space vertical size="large">
    <resource-detail-modal
      v-model:show="detailVisible"
      :resource="selectedResource"
      :user-profile="userProfile"
      @update:show="(value) => { if (!value) handleCloseDetail() }"
    />

    <div
      style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 520px; gap: 28px; padding: 24px 0;"
    >
      <div
        style="width: min(100%, 360px); display: flex; align-items: center; justify-content: center;"
      >
        <div
          ref="animationContainer"
          style="width: min(100%, 320px); aspect-ratio: 1 / 1;"
        />
      </div>

      <n-space vertical size="large" style="width: min(100%, 720px);">
        <n-space vertical :size="10">
          <n-text strong style="font-size: 18px;">
            粘贴汽水音乐分享链接
          </n-text>
          <n-text depth="3">
            支持直接粘贴完整分享文案，程序会自动提取链接并解析 track_id 或 video_id。
          </n-text>
        </n-space>

        <n-input
          v-model:value="shareText"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 5 }"
          placeholder="例如：《Shots - Broiler Remix》@汽水音乐 https://qishui.douyin.com/s/ix4QxW9H/"
        />

        <n-space justify="space-between" align="center">
          <n-space>
            <n-button secondary @click="applyExample">
              填入示例
            </n-button>
            <n-button
              type="primary"
              :loading="resolving"
              :disabled="!canSubmit"
              @click="handleResolve"
            >
              获取信息
            </n-button>
          </n-space>

          <n-tag :type="isAuthenticated ? 'success' : 'warning'" round>
            {{ isAuthenticated ? '已登录，可获取详情' : '未登录，需登录后调用详情接口' }}
          </n-tag>
        </n-space>
      </n-space>
    </div>
  </n-space>
</template>
