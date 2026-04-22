<script setup>
import { h, ref, watch } from 'vue'
import {
  NButton,
  NDataTable,
  NModal,
  NProgress,
  NResult,
  NSpace,
  NTag,
  NText,
  createDiscreteApi,
} from 'naive-ui'
import { fetchPlaylistDetail } from '../api/playlists'
import { downloadEncryptedTrackWithProgress } from '../api/tracks'
import ResourceDetailModal from './ResourceDetailModal.vue'

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

const PAGE_SIZE = 15

const detailLoading = ref(false)
const detailErrorMessage = ref('')
const detailPlaylist = ref(null)
const detailRows = ref([])
const detailHasMore = ref(false)
const detailNextCursor = ref('')
const detailCurrentCursor = ref('')
const detailCursorHistory = ref([])
const detailPage = ref(1)
const downloadingRowKey = ref('')
const downloadProgress = ref(0)
const downloadProgressTotal = ref(0)
const downloadStatusModalVisible = ref(false)
const downloadingRowTitle = ref('')
const downloadingQualityLabel = ref('')

const resourceDetailVisible = ref(false)
const selectedResource = ref(null)
const { message } = createDiscreteApi(['message'])

function getArtistName(artist) {
  return artist?.user_info?.nickname || artist?.nickname || artist?.name || ''
}

function getFirstUrl(imageLike) {
  if (!imageLike || !Array.isArray(imageLike.urls) || imageLike.urls.length === 0) {
    return ''
  }

  return imageLike.urls[0]
}

function resolveImageUrl(imageLike) {
  if (!imageLike) {
    return ''
  }

  const firstUrl = getFirstUrl(imageLike)
  const uri = imageLike.uri || ''
  const templatePrefix = imageLike.template_prefix || ''

  if (!firstUrl || !uri) {
    return firstUrl
  }

  const templateSuffix = templatePrefix
    ? `~${templatePrefix}-crop-center:800:800.jpg`
    : ''

  if (!firstUrl.includes(uri)) {
    return `${firstUrl}${uri}${templateSuffix}`
  }

  return `${firstUrl}${templateSuffix}`
}

function formatDuration(durationMs = 0) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizePlaylistItem(item) {
  return {
    id: item.id || '',
    title: item.title || '未命名歌单',
    trackCount: item.count_tracks || 0,
    cover: resolveImageUrl(item.url_cover),
    ownerName: item.owner?.nickname || '未知用户',
    ownerAvatar: getFirstUrl(item.owner?.thumb_avatar_url) || getFirstUrl(item.owner?.medium_avatar_url),
  }
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

  return availableQualities.every((quality) => {
    const playDetail = qualityMap?.[quality]?.play_detail
    return Boolean(playDetail?.need_vip)
  })
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

function getTrackTags(resource, track) {
  const tags = []

  if (resource?.type === 'video') {
    tags.push({
      key: 'video',
      label: '视频音乐',
      type: 'info',
    })
  }

  if (isTrackUnavailable(track)) {
    tags.push({
      key: 'offline',
      label: '已下架',
      type: 'error',
    })
  }

  if (getTrackPermission(track)) {
    tags.push({
      key: 'vip',
      label: 'VIP',
      type: 'warning',
    })
  }

  return tags
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

function getTrackId(resource) {
  return resource?.entity?.track_wrapper?.track?.id || ''
}

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

function pickLargestPlayableQuality(resource) {
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

  return availableList.reduce((best, current) => {
    const bestSize = typeof best?.size === 'number' ? best.size : -1
    const currentSize = typeof current?.size === 'number' ? current.size : -1
    return currentSize > bestSize ? current : best
  }, null)
}

async function handleDirectDownload(row) {
  const trackId = getTrackId(row.raw)

  if (!trackId) {
    message.error('当前资源缺少乐曲 ID。')
    return
  }

  const selectedQuality = pickLargestPlayableQuality(row.raw)

  if (!selectedQuality?.quality) {
    message.warning('当前没有可直接下载的可播放音质。')
    return
  }

  downloadingRowKey.value = row.key
  downloadProgress.value = 0
  downloadProgressTotal.value = 0
  downloadingRowTitle.value = row.title || '未命名资源'
  downloadingQualityLabel.value = selectedQuality.quality
  downloadStatusModalVisible.value = true

  try {
    const { blob, fileName } = await downloadEncryptedTrackWithProgress({
      trackId,
      quality: selectedQuality.quality,
      onProgress(progress) {
        downloadProgress.value = progress.percent
        downloadProgressTotal.value = progress.total
      },
    })
    triggerDownload(blob, fileName || `${row.title || 'track'}-${selectedQuality.quality}.bin`)
    message.success(`已开始下载 ${selectedQuality.quality} 音质。`)
  } catch (error) {
    message.error(error?.message || '下载音频失败')
  } finally {
    downloadStatusModalVisible.value = false
    downloadingRowKey.value = ''
    downloadProgress.value = 0
    downloadProgressTotal.value = 0
    downloadingRowTitle.value = ''
    downloadingQualityLabel.value = ''
  }
}

function normalizeDetailRows(payload, page) {
  const list = Array.isArray(payload?.media_resources) ? payload.media_resources : []

  return list.map((resource, index) => {
    const track = resource?.entity?.track_wrapper?.track
    const video = resource?.entity?.video
    const source = track || video || {}
    const artists = Array.isArray(source?.artists) ? source.artists : []

    return {
      key: `${resource?.type || 'unknown'}-${resource?.id || index}`,
      order: (page - 1) * PAGE_SIZE + index + 1,
      title: track?.name || video?.title || '未命名资源',
      artists: artists.map(getArtistName).filter(Boolean).join(' / '),
      album: track?.album?.name || '-',
      duration: formatDuration(track?.duration || video?.duration || 0),
      isVideo: resource?.type === 'video',
      isUnavailable: isTrackUnavailable(track),
      canDirectDownload: !(
        isTrackUnavailable(track) ||
        resource?.type === 'video' ||
        !pickLargestPlayableQuality(resource)
      ),
      tags: getTrackTags(resource, track),
      raw: resource,
    }
  })
}

function openResourceDetail(resource) {
  selectedResource.value = resource
  resourceDetailVisible.value = true
}

function closeResourceDetail() {
  resourceDetailVisible.value = false
  selectedResource.value = null
}

const detailColumns = [
  {
    title: '#',
    key: 'order',
    width: 64,
  },
  {
    title: '歌曲',
    key: 'title',
    minWidth: 220,
    render(row) {
      return h('span', {
        style: {
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
        title: row.title,
      }, row.title)
    },
  },
  {
    title: '歌手',
    key: 'artists',
    minWidth: 180,
    ellipsis: true,
  },
  {
    title: '专辑',
    key: 'album',
    minWidth: 180,
    ellipsis: true,
  },
  {
    title: '时长',
    key: 'duration',
    width: 88,
  },
  {
    title: 'Tag',
    key: 'tags',
    width: 160,
    render(row) {
      if (!row.tags.length) {
        return '-'
      }

      return h(NSpace, { align: 'center', wrap: true, size: 8 }, {
        default: () => row.tags.map((tag) => h(
          NTag,
          {
            key: `${row.key}-${tag.key}`,
            type: tag.type,
            round: true,
            size: 'small',
          },
          { default: () => tag.label },
        )),
      })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 188,
    render(row) {
      if (row.isUnavailable) {
        return '-'
      }

      return h(NSpace, { align: 'center', size: 8 }, {
        default: () => [
          row.canDirectDownload
            ? h(
              NButton,
              {
                secondary: true,
                size: 'small',
                loading: downloadingRowKey.value === row.key,
                onClick: () => handleDirectDownload(row),
              },
              { default: () => '下载音频' },
            )
            : null,
          h(
            NButton,
            {
              secondary: true,
              size: 'small',
              onClick: () => openResourceDetail(row.raw),
            },
            { default: () => '详情' },
          ),
        ],
      })
    },
  },
]

async function loadPlaylistDetailPage({ playlistId, cursor = '', page = 1, saveHistory = false }) {
  detailLoading.value = true
  detailErrorMessage.value = ''

  try {
    const payload = await fetchPlaylistDetail({
      playlistId,
      cursor,
      count: PAGE_SIZE,
    })

    detailPlaylist.value = normalizePlaylistItem(payload?.playlist || props.playlist || {})
    detailRows.value = normalizeDetailRows(payload, page)
    detailHasMore.value = Boolean(payload?.has_more)
    detailNextCursor.value = payload?.next_cursor || ''
    detailCurrentCursor.value = cursor
    detailPage.value = page

    if (saveHistory) {
      detailCursorHistory.value.push(cursor)
    }
  } catch (error) {
    detailRows.value = []
    detailErrorMessage.value = error?.message || '获取歌单详情失败'
  } finally {
    detailLoading.value = false
  }
}

async function loadNextDetailPage() {
  if (!detailPlaylist.value?.id || !detailHasMore.value || !detailNextCursor.value) {
    return
  }

  await loadPlaylistDetailPage({
    playlistId: detailPlaylist.value.id,
    cursor: detailNextCursor.value,
    page: detailPage.value + 1,
    saveHistory: true,
  })
}

async function loadPreviousDetailPage() {
  if (!detailPlaylist.value?.id || detailPage.value <= 1) {
    return
  }

  const previousPage = detailPage.value - 1
  const previousCursor = detailCursorHistory.value[previousPage - 1] || ''
  detailCursorHistory.value = detailCursorHistory.value.slice(0, previousPage)

  await loadPlaylistDetailPage({
    playlistId: detailPlaylist.value.id,
    cursor: previousCursor,
    page: previousPage,
    saveHistory: false,
  })
}

function resetDetailState() {
  detailPlaylist.value = props.playlist
  detailRows.value = []
  detailHasMore.value = false
  detailNextCursor.value = ''
  detailCurrentCursor.value = ''
  detailCursorHistory.value = ['']
  detailPage.value = 1
  detailErrorMessage.value = ''
  closeResourceDetail()
}

function handleClose() {
  emit('update:show', false)
  resetDetailState()
}

watch(
  () => [props.show, props.playlist?.id],
  async ([show, playlistId]) => {
    if (!show || !playlistId) {
      return
    }

    resetDetailState()
    await loadPlaylistDetailPage({
      playlistId,
      cursor: '',
      page: 1,
      saveHistory: false,
    })
  },
  { immediate: true },
)
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    style="width: 1200px;"
    title="歌单歌曲列表"
    @update:show="(value) => { if (!value) handleClose() }"
  >
    <n-space vertical size="large">
      <n-space align="center" justify="space-between" :wrap="false">
        <n-space vertical :size="6">
          <n-text strong style="font-size: 18px;">
            {{ detailPlaylist?.title || '歌单详情' }}
          </n-text>
          <n-text depth="3">
            第 {{ detailPage }} 页
          </n-text>
        </n-space>

        <n-space>
          <n-button secondary :disabled="detailPage <= 1 || detailLoading" @click="loadPreviousDetailPage">
            上一页
          </n-button>
          <n-button secondary :disabled="!detailHasMore || detailLoading" @click="loadNextDetailPage">
            下一页
          </n-button>
        </n-space>
      </n-space>

      <n-result
        v-if="detailErrorMessage"
        status="error"
        title="歌单详情加载失败"
        :description="detailErrorMessage"
      />

      <n-data-table
        v-else
        :columns="detailColumns"
        :data="detailRows"
        :loading="detailLoading"
        :pagination="false"
        :single-line="false"
        striped
      />
    </n-space>
  </n-modal>

  <resource-detail-modal
    v-model:show="resourceDetailVisible"
    :resource="selectedResource"
    :user-profile="userProfile"
  />

  <n-modal
    :show="downloadStatusModalVisible"
    preset="card"
    title="正在下载音频"
    style="width: 420px;"
    :mask-closable="false"
    :close-on-esc="false"
    :closable="false"
  >
    <n-space vertical size="large">
      <n-text>
        正在下载《{{ downloadingRowTitle }}》的 {{ downloadingQualityLabel }} 音质，请稍候。
      </n-text>
      <n-text depth="3">
        已自动选择当前可播放音质里体积最大的一档，下载与解密过程不可取消。
      </n-text>
      <n-progress
        type="line"
        :percentage="downloadProgress"
        :indicator-placement="'inside'"
        :processing="downloadProgress < 100"
      />
      <n-text depth="3">
        <span v-if="downloadProgressTotal">已完成 {{ downloadProgress }}%</span>
        <span v-else>正在等待下载进度信息...</span>
      </n-text>
    </n-space>
  </n-modal>
</template>
