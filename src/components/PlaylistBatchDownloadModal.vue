<script setup>
import { computed, h, ref, watch } from 'vue'
import {
  NButton,
  NCheckbox,
  NDataTable,
  NEmpty,
  NModal,
  NProgress,
  NResult,
  NSelect,
  NSpace,
  NTag,
  NText,
  createDiscreteApi,
} from 'naive-ui'
import {
  downloadPlaylistBatchZipWithProgress,
  fetchPlaylistBatchProgress,
  fetchPlaylistDetail,
} from '../api/playlists'
import {
  fetchVideoV2,
} from '../api/videos'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  playlist: {
    type: Object,
    default: null,
  },
  userProfile: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:show'])

const loadingResources = ref(false)
const loadingError = ref('')
const taskRows = ref([])
const downloadVideoMusic = ref(true)
const downloadAudioMusic = ref(true)
const convertVideoToAudio = ref(false)
const audioQualityPreference = ref('highest')
const running = ref(false)
const completedCount = ref(0)
const checkedTaskKeys = ref([])
const batchProgress = ref(0)
const currentBatchId = ref('')
let progressPollTimer = null
const { message } = createDiscreteApi(['message'])

const audioQualityOptions = [
  { label: '最高', value: 'highest' },
  { label: '最低', value: 'lowest' },
]

const taskColumns = [
  {
    title: '#',
    key: 'order',
    width: 64,
  },
  {
    title: '歌曲',
    key: 'title',
    minWidth: 220,
  },
  {
    title: '资源类型',
    key: 'resourceType',
    width: 100,
  },
  {
    title: '下载目标',
    key: 'targetType',
    width: 120,
  },
  {
    title: '质量',
    key: 'qualityLabel',
    width: 120,
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
  },
  {
    title: '说明',
    key: 'message',
    minWidth: 220,
  },
]

const selectedTaskRows = computed(() => taskRows.value.filter((row) => checkedTaskKeys.value.includes(row.key)))
const totalTasks = computed(() => selectedTaskRows.value.length)
const overallProgress = computed(() => (
  running.value
    ? batchProgress.value
    : totalTasks.value > 0
    ? Math.round((completedCount.value / totalTasks.value) * 100)
    : 0
))

const allChecked = computed(() => totalTasks.value > 0 && checkedTaskKeys.value.length === taskRows.value.length)
const indeterminate = computed(() => checkedTaskKeys.value.length > 0 && checkedTaskKeys.value.length < taskRows.value.length)

function getTagVNode(row) {
  if (!row) {
    return '-'
  }

  const labelMap = {
    pending: '待下载',
    running: '下载中',
    completed: '已完成',
    failed: '失败',
  }

  return labelMap[row.status]
}

taskColumns[5].render = (row) => {
  const tag = getTagVNode(row)

  if (!tag) {
    return '-'
  }

  return h(
    NTag,
    {
      type: {
        pending: 'default',
        running: 'info',
        completed: 'success',
        failed: 'error',
      }[row.status],
      round: true,
      size: 'small',
    },
    { default: () => tag },
  )
}

taskColumns.unshift({
  title: () => h(
    'div',
    {
      style: {
        display: 'flex',
        justifyContent: 'center',
      },
    },
    [
      h(
        NCheckbox,
        {
          checked: allChecked.value,
          indeterminate: indeterminate.value,
          disabled: running.value || taskRows.value.length === 0,
          onUpdateChecked(checked) {
            checkedTaskKeys.value = checked ? taskRows.value.map((row) => row.key) : []
          },
        },
      ),
    ],
  ),
  key: 'checked',
  width: 56,
  align: 'center',
  render(row) {
    return h(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'center',
        },
      },
      [
        h(
          NCheckbox,
          {
            checked: checkedTaskKeys.value.includes(row.key),
            disabled: running.value,
            onUpdateChecked(checked) {
              if (checked) {
                checkedTaskKeys.value = [...new Set([...checkedTaskKeys.value, row.key])]
                return
              }

              checkedTaskKeys.value = checkedTaskKeys.value.filter((key) => key !== row.key)
            },
          },
        ),
      ],
    )
  },
})

function triggerDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

function stopProgressPolling() {
  if (progressPollTimer) {
    clearInterval(progressPollTimer)
    progressPollTimer = null
  }
}

function syncRunningTaskStates(completed) {
  const selectedRows = selectedTaskRows.value
  const completedKeys = new Set(selectedRows.slice(0, completed).map((row) => row.key))
  const currentRunningKey = selectedRows[completed]?.key || ''

  taskRows.value = taskRows.value.map((row) => {
    if (!checkedTaskKeys.value.includes(row.key)) {
      return row
    }

    if (completedKeys.has(row.key)) {
      return {
        ...row,
        status: 'completed',
        message: '已打包进压缩包',
      }
    }

    if (row.key === currentRunningKey) {
      return {
        ...row,
        status: 'running',
        message: '正在下载并打包',
      }
    }

    return {
      ...row,
      status: 'pending',
      message: '等待打包',
    }
  })
}

function startProgressPolling(batchId) {
  stopProgressPolling()

  progressPollTimer = setInterval(async () => {
    try {
      const progress = await fetchPlaylistBatchProgress(batchId)
      const total = Number(progress?.total) || 0
      const completed = Math.min(total, Number(progress?.completed) || 0)

      completedCount.value = completed
      batchProgress.value = total > 0
        ? Math.min(progress?.status === 'completed' ? 100 : 99, Math.round((completed / total) * 100))
        : 0

      syncRunningTaskStates(completed)

      if (progress?.status === 'completed' || progress?.status === 'failed') {
        stopProgressPolling()
      }
    } catch {
      // Ignore transient polling failures while download is still in progress.
    }
  }, 700)
}

function getTrackPermission(track) {
  if (!track?.label_info) {
    return false
  }

  const qualityMap = track.label_info.quality_map || {}

  if (track.label_info.only_vip_playable) {
    return true
  }

  const availableQualities = Array.isArray(track.bit_rates)
    ? track.bit_rates.map((item) => item?.quality).filter(Boolean)
    : []

  if (availableQualities.length === 0) {
    return false
  }

  return availableQualities.every((quality) => Boolean(qualityMap?.[quality]?.play_detail?.need_vip))
}

function isTrackUnavailable(track) {
  if (!track) {
    return false
  }

  if (track.status === 10) {
    return true
  }

  return track?.album?.id === '0' && !track?.album?.name
}

function getQualityRequirement(detail) {
  if (!detail) {
    return '不支持'
  }

  if (detail.need_purchase) {
    return detail.need_vip ? 'VIP + 购买' : '购买'
  }

  return detail.need_vip ? 'VIP' : '免费'
}

function canUseByPlayPermission(requirement) {
  if (requirement === '免费') {
    return true
  }

  if (requirement === 'VIP') {
    return Boolean(props.userProfile?.isVip)
  }

  return false
}

function chooseAudioQuality(resource) {
  const track = resource?.entity?.track_wrapper?.track
  const qualityMap = track?.label_info?.quality_map || {}
  const bitRates = Array.isArray(track?.bit_rates) ? track.bit_rates : []

  const availableList = bitRates.filter((item) => {
    const playRequirement = getQualityRequirement(qualityMap?.[item?.quality]?.play_detail)
    return canUseByPlayPermission(playRequirement)
  })

  if (availableList.length === 0) {
    return null
  }

  const sorted = [...availableList].sort((left, right) => {
    const leftSize = typeof left?.size === 'number' ? left.size : -1
    const rightSize = typeof right?.size === 'number' ? right.size : -1
    return rightSize - leftSize
  })

  return audioQualityPreference.value === 'lowest'
    ? sorted[sorted.length - 1]
    : sorted[0]
}

function parseVideoRowsFromPayload(payload) {
  const playerInfos = Array.isArray(payload?.player_infos) ? payload.player_infos : []
  const videoTitle = payload?.video?.title || payload?.video?.description || 'video'
  const rows = []

  for (const playerInfo of playerInfos) {
    const videoModelRaw = playerInfo?.video_model
    if (!videoModelRaw) {
      continue
    }

    let videoModel = null

    try {
      videoModel = JSON.parse(videoModelRaw)
    } catch {
      continue
    }

    const videoList = Array.isArray(videoModel?.video_list) ? videoModel.video_list : []
    for (const item of videoList) {
      if (!item?.main_url && !item?.backup_url) {
        continue
      }

      rows.push({
        quality: item?.video_meta?.quality || '-',
        definition: item?.video_meta?.definition || '-',
        size: typeof item?.video_meta?.size === 'number' ? item.video_meta.size : -1,
        downloadUrl: item?.main_url || item?.backup_url || '',
        videoFileName: `${videoTitle}-${item?.video_meta?.definition || item?.video_meta?.quality || 'video'}.${item?.video_meta?.vtype || 'mp4'}`,
        audioFileName: `${videoTitle}-${item?.video_meta?.definition || item?.video_meta?.quality || 'audio'}.mp3`,
      })
    }
  }

  return rows
}

function chooseVideoQuality(rows) {
  if (!rows.length) {
    return null
  }

  const sorted = [...rows].sort((left, right) => right.size - left.size)

  return audioQualityPreference.value === 'lowest'
    ? sorted[sorted.length - 1]
    : sorted[0]
}

async function fetchAllPlaylistResources(playlistId) {
  const resources = []
  let cursor = ''
  let hasMore = true

  while (hasMore) {
    const payload = await fetchPlaylistDetail({
      playlistId,
      cursor,
      count: 100,
    })

    const pageResources = Array.isArray(payload?.media_resources) ? payload.media_resources : []
    resources.push(...pageResources)
    hasMore = Boolean(payload?.has_more)
    cursor = payload?.next_cursor || ''

    if (hasMore && !cursor) {
      break
    }
  }

  return resources
}

async function buildTaskList() {
  if (!props.playlist?.id) {
    message.error('当前歌单缺少 ID。')
    return
  }

  if (!downloadVideoMusic.value && !downloadAudioMusic.value && !convertVideoToAudio.value) {
    message.warning('至少选择一种下载类型。')
    return
  }

  loadingResources.value = true
  loadingError.value = ''
  taskRows.value = []
  completedCount.value = 0

  try {
    const resources = await fetchAllPlaylistResources(props.playlist.id)
    const rows = []
    let order = 1

    for (const resource of resources) {
      const track = resource?.entity?.track_wrapper?.track
      const video = resource?.entity?.video
      const title = track?.name || video?.title || '未命名资源'

      if (resource?.type === 'video') {
        const videoId = video?.video_id || video?.vid || ''

        if (!videoId) {
          continue
        }

        const payload = await fetchVideoV2(videoId)
        const selectedVideoQuality = chooseVideoQuality(parseVideoRowsFromPayload(payload))

        if (!selectedVideoQuality) {
          continue
        }

        if (downloadVideoMusic.value) {
          rows.push({
            key: `task-${resource.id}-video`,
            order: order,
            title,
            resourceType: '视频',
            targetType: '下载视频',
            qualityLabel: selectedVideoQuality.definition || selectedVideoQuality.quality,
            status: 'pending',
            message: '等待开始',
            action: 'video',
            downloadUrl: selectedVideoQuality.downloadUrl,
            fileName: selectedVideoQuality.videoFileName,
          })
          order += 1
        }

        if (convertVideoToAudio.value) {
          rows.push({
            key: `task-${resource.id}-video-audio`,
            order: order,
            title,
            resourceType: '视频',
            targetType: '转音频',
            qualityLabel: selectedVideoQuality.definition || selectedVideoQuality.quality,
            status: 'pending',
            message: '等待开始',
            action: 'video-audio',
            downloadUrl: selectedVideoQuality.downloadUrl,
            fileName: selectedVideoQuality.audioFileName,
          })
          order += 1
        }

        continue
      }

      if (!downloadAudioMusic.value || !track || isTrackUnavailable(track)) {
        continue
      }

      const selectedAudioQuality = chooseAudioQuality(resource)

      if (!selectedAudioQuality?.quality) {
        continue
      }

      rows.push({
        key: `task-${resource.id}-audio`,
        order: order,
        title,
        resourceType: '音频',
        targetType: '下载音频',
        qualityLabel: selectedAudioQuality.quality,
        status: 'pending',
        message: getTrackPermission(track) ? '按播放权限筛选' : '等待开始',
        action: 'audio',
        trackId: track.id,
        quality: selectedAudioQuality.quality,
      })
      order += 1
    }

    taskRows.value = rows
    checkedTaskKeys.value = rows.map((row) => row.key)

    if (rows.length === 0) {
      loadingError.value = '当前配置下没有可下载的音乐。'
    }
  } catch (error) {
    taskRows.value = []
    loadingError.value = error?.message || '获取乐曲列表失败'
  } finally {
    loadingResources.value = false
  }
}

function updateTaskRow(key, patch) {
  taskRows.value = taskRows.value.map((row) => (
    row.key === key
      ? { ...row, ...patch }
      : row
  ))
}

function runTask(task) {
  return {
    action: task.action,
    title: task.title,
    trackId: task.trackId || '',
    quality: task.quality || '',
    downloadUrl: task.downloadUrl || '',
    fileName: task.fileName || '',
  }
}

async function startBatchDownload() {
  if (running.value) {
    return
  }

  if (selectedTaskRows.value.length === 0) {
    message.warning('请先获取乐曲列表。')
    return
  }

  const selectedKeys = new Set(checkedTaskKeys.value)
  taskRows.value = taskRows.value.map((row) => ({
    ...row,
    status: selectedKeys.has(row.key) ? 'running' : row.status,
    message: selectedKeys.has(row.key) ? '等待打包' : row.message,
  }))

  running.value = true
  completedCount.value = 0
  batchProgress.value = 0
  currentBatchId.value = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `batch-${Date.now()}-${Math.random().toString(16).slice(2)}`
  startProgressPolling(currentBatchId.value)

  try {
    const { blob, fileName } = await downloadPlaylistBatchZipWithProgress({
      playlistTitle: props.playlist?.title || 'playlist-batch-download',
      batchId: currentBatchId.value,
      tasks: selectedTaskRows.value.map(runTask),
      onProgress(progress) {
        if (progress.total > 0) {
          batchProgress.value = Math.max(batchProgress.value, progress.percent)
        }
      },
    })

    stopProgressPolling()
    triggerDownload(blob, fileName || `${props.playlist?.title || 'playlist-batch-download'}.zip`)
    completedCount.value = selectedTaskRows.value.length
    batchProgress.value = 100
    taskRows.value = taskRows.value.map((row) => (
      selectedKeys.has(row.key)
        ? { ...row, status: 'completed', message: '已打包进压缩包' }
        : row
    ))
    message.success('压缩包已开始下载。')
  } catch (error) {
    stopProgressPolling()
    taskRows.value = taskRows.value.map((row) => (
      selectedKeys.has(row.key)
        ? { ...row, status: 'failed', message: error?.message || '打包下载失败' }
        : row
    ))
    message.error(error?.message || '打包下载失败')
  } finally {
    running.value = false
    currentBatchId.value = ''
  }
}

function resetState() {
  stopProgressPolling()
  loadingResources.value = false
  loadingError.value = ''
  taskRows.value = []
  running.value = false
  completedCount.value = 0
  checkedTaskKeys.value = []
  batchProgress.value = 0
  currentBatchId.value = ''
  downloadVideoMusic.value = true
  downloadAudioMusic.value = true
  convertVideoToAudio.value = false
  audioQualityPreference.value = 'highest'
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      resetState()
    }
  },
)
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    style="width: 1080px;"
    title="打包下载"
    :mask-closable="!running"
    :close-on-esc="!running"
    :closable="!running"
    @update:show="(value) => { if (!running) emit('update:show', value) }"
  >
    <n-space vertical size="large">
      <n-space vertical :size="12">
        <n-text strong>下载设置</n-text>
        <n-space>
          <n-checkbox v-model:checked="downloadVideoMusic">
            下载视频音乐
          </n-checkbox>
          <n-checkbox v-model:checked="downloadAudioMusic">
            下载音频音乐
          </n-checkbox>
          <n-checkbox v-model:checked="convertVideoToAudio">
            将视频音乐转换为音频
          </n-checkbox>
        </n-space>
        <n-space align="center">
          <n-text>音频质量</n-text>
          <n-select
            v-model:value="audioQualityPreference"
            :options="audioQualityOptions"
            style="width: 180px;"
          />
          <n-button secondary :loading="loadingResources" :disabled="running" @click="buildTaskList">
            获取乐曲列表
          </n-button>
        </n-space>
      </n-space>

      <n-result
        v-if="loadingError"
        status="warning"
        title="没有可下载的任务"
        :description="loadingError"
      />

      <template v-else>
        <n-space align="center" justify="space-between" :wrap="false">
          <n-space vertical :size="4">
            <n-text strong>
              共勾选 {{ totalTasks }} 个待处理文件
            </n-text>
            <n-text depth="3">
              {{ props.playlist?.title || '当前歌单' }}
            </n-text>
          </n-space>

          <n-button
            type="primary"
            :disabled="totalTasks === 0 || running"
            :loading="running"
            @click="startBatchDownload"
          >
            开始下载
          </n-button>
        </n-space>

        <n-empty v-if="!loadingResources && taskRows.length === 0" description="先设置条件并获取乐曲列表" />

        <n-data-table
          v-else
          :columns="taskColumns"
          :data="taskRows"
          :pagination="false"
          :single-line="false"
          size="small"
          max-height="360"
        />
      </template>

      <n-space v-if="taskRows.length > 0" vertical size="small">
        <n-text strong>整体进度</n-text>
        <n-progress
          type="line"
          :percentage="overallProgress"
          :indicator-placement="'inside'"
          :processing="running"
        />
        <n-text depth="3">
          <span v-if="running">已完成 {{ completedCount }} / {{ totalTasks }} 个文件，正在继续打包...</span>
          <span v-else>已完成 {{ completedCount }} / {{ totalTasks }} 个文件</span>
        </n-text>
      </n-space>
    </n-space>
  </n-modal>
</template>
