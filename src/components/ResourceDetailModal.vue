<script setup>
import { computed, h, ref, watch } from 'vue'
import {
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NModal,
  NProgress,
  NResult,
  NSpace,
  NTag,
  NText,
  createDiscreteApi,
} from 'naive-ui'
import { downloadEncryptedTrackWithProgress } from '../api/tracks'
import { downloadVideoAudioWithProgress, downloadVideoWithProgress, fetchVideoV2 } from '../api/videos'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  resource: {
    type: Object,
    default: null,
  },
  userProfile: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:show'])
const downloadingQuality = ref('')
const downloadingResourceType = ref('audio')
const downloadingTitle = ref('')
const downloadProgress = ref(0)
const downloadProgressTotal = ref(0)
const downloadStatusModalVisible = ref(false)
const videoQualityLoading = ref(false)
const videoQualityError = ref('')
const videoQualityRows = ref([])
const { message } = createDiscreteApi(['message'])

const detail = computed(() => (
  props.resource
    ? normalizeResourceDetail(props.resource)
    : null
))

const audioQualityColumns = [
  {
    title: '音质',
    key: 'quality',
    width: 140,
  },
  {
    title: '比特率',
    key: 'bitRate',
    width: 120,
  },
  {
    title: '大小',
    key: 'size',
    width: 120,
  },
  {
    title: '播放',
    key: 'play',
    width: 100,
  },
  {
    title: '下载',
    key: 'download',
    width: 100,
  },
]

const videoQualityColumns = [
  {
    title: '质量',
    key: 'quality',
    width: 110,
  },
  {
    title: '清晰度',
    key: 'definition',
    width: 100,
  },
  {
    title: '分辨率',
    key: 'resolution',
    width: 120,
  },
  {
    title: '比特率',
    key: 'bitRate',
    width: 100,
  },
  {
    title: '大小',
    key: 'size',
    width: 120,
  },
  {
    title: '播放',
    key: 'play',
    width: 100,
  },
  {
    title: '下载',
    key: 'download',
    width: 100,
  },
  {
    title: '编码',
    key: 'codec',
    width: 100,
  },
]

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

function formatCount(value) {
  if (typeof value !== 'number') {
    return '-'
  }

  return value.toLocaleString('zh-CN')
}

function formatBitRate(bitRate) {
  if (typeof bitRate !== 'number' || Number.isNaN(bitRate)) {
    return '-'
  }

  return `${Math.round(bitRate / 1000)} kbps`
}

function formatFileSize(size) {
  if (typeof size !== 'number' || Number.isNaN(size) || size <= 0) {
    return '-'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let current = size
  let unitIndex = 0

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024
    unitIndex += 1
  }

  return `${current.toFixed(current >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
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

function getAuthorInfo(resource) {
  const track = resource?.entity?.track_wrapper?.track
  const video = resource?.entity?.video
  const source = track || video || {}
  const firstArtist = Array.isArray(source?.artists) ? source.artists[0] : null
  const userInfo = firstArtist?.user_info

  return {
    name: firstArtist?.simple_display_name || userInfo?.nickname || firstArtist?.name || '',
    id: userInfo?.id || firstArtist?.id || '',
    avatar: getFirstUrl(userInfo?.thumb_avatar_url) || getFirstUrl(userInfo?.medium_avatar_url),
  }
}

function getCoverUrl(resource) {
  const track = resource?.entity?.track_wrapper?.track
  const video = resource?.entity?.video

  return (
    resolveImageUrl(track?.album?.url_cover) ||
    getFirstUrl(video?.cover_url) ||
    getFirstUrl(video?.share_cover_url) ||
    getFirstUrl(video?.image_url) ||
    ''
  )
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

function getVideoId(resource) {
  return resource?.entity?.video?.video_id || resource?.entity?.video?.vid || ''
}

function getTrackId(resource) {
  return resource?.entity?.track_wrapper?.track?.id || ''
}

function triggerEncryptedDownload(blob, filename) {
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

async function handleDownloadQuality(row) {
  const trackId = getTrackId(props.resource)

  if (!trackId) {
    message.error('当前资源缺少乐曲 ID。')
    return
  }

  downloadingQuality.value = row.key
  downloadingResourceType.value = 'audio'
  downloadingTitle.value = detail.value?.name || '未命名资源'
  downloadProgress.value = 0
  downloadProgressTotal.value = 0
  downloadStatusModalVisible.value = true

  try {
    const { blob, fileName } = await downloadEncryptedTrackWithProgress({
      trackId,
      quality: row.quality,
      onProgress(progress) {
        downloadProgress.value = progress.percent
        downloadProgressTotal.value = progress.total
      },
    })
    triggerEncryptedDownload(blob, fileName || `${detail.value?.name || 'track'}-${row.quality}-encrypted.bin`)
    message.success(`已开始下载 ${row.quality} 加密文件。`)
  } catch (error) {
    message.error(error?.message || '下载加密文件失败')
  } finally {
    downloadStatusModalVisible.value = false
    downloadingQuality.value = ''
    downloadingResourceType.value = 'audio'
    downloadingTitle.value = ''
    downloadProgress.value = 0
    downloadProgressTotal.value = 0
  }
}

async function handleDownloadVideo(row) {
  if (!row?.downloadUrl) {
    message.error('当前清晰度缺少下载地址。')
    return
  }

  downloadingQuality.value = row.key
  downloadingResourceType.value = 'video'
  downloadingTitle.value = detail.value?.name || '未命名资源'
  downloadProgress.value = 0
  downloadProgressTotal.value = 0
  downloadStatusModalVisible.value = true

  try {
    const { blob, fileName } = await downloadVideoWithProgress({
      url: row.downloadUrl,
      fileName: row.videoFileName,
      onProgress(progress) {
        downloadProgress.value = progress.percent
        downloadProgressTotal.value = progress.total
      },
    })
    triggerEncryptedDownload(blob, fileName || row.videoFileName || `${detail.value?.name || 'video'}.mp4`)
    message.success(`已开始下载 ${row.definition || row.quality} 视频。`)
  } catch (error) {
    message.error(error?.message || '下载视频失败')
  } finally {
    downloadStatusModalVisible.value = false
    downloadingQuality.value = ''
    downloadingResourceType.value = 'audio'
    downloadingTitle.value = ''
    downloadProgress.value = 0
    downloadProgressTotal.value = 0
  }
}

async function handleDownloadVideoAudio(row) {
  if (!row?.downloadUrl) {
    message.error('当前清晰度缺少下载地址。')
    return
  }

  downloadingQuality.value = row.key
  downloadingResourceType.value = 'video-audio'
  downloadingTitle.value = detail.value?.name || '未命名资源'
  downloadProgress.value = 0
  downloadProgressTotal.value = 0
  downloadStatusModalVisible.value = true

  try {
    const { blob, fileName } = await downloadVideoAudioWithProgress({
      url: row.downloadUrl,
      fileName: row.audioFileName,
      onProgress(progress) {
        downloadProgress.value = progress.percent
        downloadProgressTotal.value = progress.total
      },
    })
    triggerEncryptedDownload(blob, fileName || row.audioFileName || `${detail.value?.name || 'video'}.mp3`)
    message.success(`已开始提取 ${row.definition || row.quality} 视频音频。`)
  } catch (error) {
    message.error(error?.message || '提取视频音频失败')
  } finally {
    downloadStatusModalVisible.value = false
    downloadingQuality.value = ''
    downloadingResourceType.value = 'audio'
    downloadingTitle.value = ''
    downloadProgress.value = 0
    downloadProgressTotal.value = 0
  }
}

function canDownloadQuality(requirement) {
  if (requirement === '免费') {
    return true
  }

  if (requirement === 'VIP') {
    return Boolean(props.userProfile?.isVip)
  }

  return false
}

function getVideoQualityRowsFromPayload(payload) {
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
      rows.push({
        key: `${item?.video_meta?.definition || 'video'}-${item?.video_meta?.quality || rows.length}`,
        quality: item?.video_meta?.quality || '-',
        definition: item?.video_meta?.definition || '-',
        resolution: item?.video_meta?.vwidth && item?.video_meta?.vheight
          ? `${item.video_meta.vwidth}x${item.video_meta.vheight}`
          : '-',
        bitRate: formatBitRate(item?.video_meta?.bitrate),
        size: formatFileSize(item?.video_meta?.size),
        codec: item?.video_meta?.codec_type || '-',
        play: '免费',
        download: item?.main_url ? '可用' : '不支持',
        isDownloadable: false,
        isVideoDownloadAvailable: Boolean(item?.main_url),
        downloadUrl: item?.main_url || item?.backup_url || '',
        videoFileName: `${videoTitle}-${item?.video_meta?.definition || item?.video_meta?.quality || 'video'}.${item?.video_meta?.vtype || 'mp4'}`,
        audioFileName: `${videoTitle}-${item?.video_meta?.definition || item?.video_meta?.quality || 'audio'}.mp3`,
      })
    }
  }

  return rows
}

function getQualityRows(resource) {
  const track = resource?.entity?.track_wrapper?.track
  const video = resource?.entity?.video

  if (track) {
    const qualityMap = track?.label_info?.quality_map || {}
    const bitRates = Array.isArray(track?.bit_rates) ? track.bit_rates : []

    return bitRates.map((item, index) => ({
      key: `${track.id || 'track'}-${item?.quality || index}`,
      quality: item?.quality || '-',
      bitRate: formatBitRate(item?.br),
      size: formatFileSize(item?.size),
      play: getQualityRequirement(qualityMap?.[item?.quality]?.play_detail),
      download: getQualityRequirement(qualityMap?.[item?.quality]?.download_detail),
      isDownloadable: canDownloadQuality(getQualityRequirement(qualityMap?.[item?.quality]?.play_detail)),
    }))
  }

  if (resource?.type === 'video') {
    return videoQualityRows.value
  }

  return []
}

function normalizeResourceDetail(resource) {
  const track = resource?.entity?.track_wrapper?.track
  const video = resource?.entity?.video
  const source = track || video || {}
  const stats = source?.stats || {}
  const author = getAuthorInfo(resource)

  return {
    key: resource?.id || source?.id || '',
    cover: getCoverUrl(resource),
    name: track?.name || video?.title || '未命名资源',
    id: track?.id || video?.video_id || resource?.id || '',
    type: resource?.type === 'video' ? '视频' : '音频',
    authorName: author.name,
    authorId: author.id,
    authorAvatar: author.avatar,
    countCollected: stats?.count_collected,
    countComment: stats?.count_comment,
    countShared: stats?.count_shared,
    tags: getTrackTags(resource, track),
    qualityRows: getQualityRows(resource),
  }
}

const qualityActionColumn = {
    title: '操作',
    key: 'actions',
    width: 220,
    render(row) {
      if (row.isVideoDownloadAvailable) {
        return h(NSpace, { size: 8 }, {
          default: () => [
            h(
              NButton,
              {
                secondary: true,
                size: 'small',
                loading: downloadingQuality.value === row.key && downloadingResourceType.value === 'video',
                onClick: () => handleDownloadVideo(row),
              },
              { default: () => '下载视频' },
            ),
            h(
              NButton,
              {
                secondary: true,
                size: 'small',
                loading: downloadingQuality.value === row.key && downloadingResourceType.value === 'video-audio',
                onClick: () => handleDownloadVideoAudio(row),
              },
              { default: () => '下载音频' },
            ),
          ],
        })
      }

      if (!row.isDownloadable) {
        return '-'
      }

      return h(
        NButton,
        {
          secondary: true,
          size: 'small',
          loading: downloadingQuality.value === row.key,
          onClick: () => handleDownloadQuality(row),
        },
        { default: () => '下载音频' },
      )
    },
  }

const qualityColumns = computed(() => {
  const baseColumns = detail.value?.type === '视频'
    ? videoQualityColumns
    : audioQualityColumns

  return [...baseColumns, qualityActionColumn]
})

watch(
  () => [props.show, props.resource?.type, getVideoId(props.resource)],
  async ([show, resourceType, videoId]) => {
    if (!show || resourceType !== 'video') {
      videoQualityRows.value = []
      videoQualityError.value = ''
      videoQualityLoading.value = false
      return
    }

    if (!videoId) {
      videoQualityRows.value = []
      videoQualityError.value = '当前视频缺少 video_id。'
      return
    }

    videoQualityLoading.value = true
    videoQualityError.value = ''

    try {
      const payload = await fetchVideoV2(videoId)
      videoQualityRows.value = getVideoQualityRowsFromPayload(payload)

      if (videoQualityRows.value.length === 0) {
        videoQualityError.value = '当前视频没有可用的视频质量信息。'
      }
    } catch (error) {
      videoQualityRows.value = []
      videoQualityError.value = error?.message || '获取视频质量信息失败'
    } finally {
      videoQualityLoading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    style="width: 920px;"
    title="资源详情"
    @update:show="(value) => emit('update:show', value)"
  >
    <n-space v-if="detail" vertical size="large">
        <div style="display: flex; gap: 16px; align-items: stretch;">
          <div style="width: 196px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px;">
            <n-space vertical size="large" align="start">
              <img
                v-if="detail.cover"
                :src="detail.cover"
                alt="resource cover"
                referrerpolicy="no-referrer"
                style="width: 180px; height: 180px; object-fit: cover; border-radius: 12px; display: block;"
              />
              <n-empty v-else description="暂无封面" />

              <n-space
                v-if="detail.authorName || detail.authorAvatar"
                align="center"
                :wrap="false"
              >
                <img
                  v-if="detail.authorAvatar"
                  :src="detail.authorAvatar"
                  alt="author avatar"
                  referrerpolicy="no-referrer"
                  style="width: 44px; height: 44px; border-radius: 9999px; object-fit: cover; display: block;"
                />
                <div
                  v-else
                  style="width: 44px; height: 44px; border-radius: 9999px; background: rgba(255,255,255,0.08);"
                />
                <n-space vertical :size="2">
                  <n-text strong>{{ detail.authorName || '-' }}</n-text>
                  <n-text depth="3">{{ detail.authorId || '-' }}</n-text>
                </n-space>
              </n-space>
            </n-space>
          </div>

          <div style="flex: 1; min-width: 0;">
            <n-descriptions label-placement="left" :column="1" bordered>
              <n-descriptions-item label="音乐名称">
                {{ detail.name }}
              </n-descriptions-item>
              <n-descriptions-item label="音乐 ID">
                {{ detail.id || '-' }}
              </n-descriptions-item>
              <n-descriptions-item label="音乐类型">
                {{ detail.type }}
              </n-descriptions-item>
              <n-descriptions-item v-if="detail.authorName" label="作者">
                {{ detail.authorName }}
              </n-descriptions-item>
              <n-descriptions-item v-if="detail.authorId" label="作者 ID">
                {{ detail.authorId }}
              </n-descriptions-item>
            </n-descriptions>
          </div>
        </div>

        <n-space>
          <n-tag type="success" round>收藏 {{ formatCount(detail.countCollected) }}</n-tag>
          <n-tag type="info" round>评论 {{ formatCount(detail.countComment) }}</n-tag>
          <n-tag type="warning" round>分享 {{ formatCount(detail.countShared) }}</n-tag>
          <n-tag
            v-for="tag in detail.tags"
            :key="`detail-tag-${tag.key}`"
            :type="tag.type"
            round
          >
            {{ tag.label }}
          </n-tag>
        </n-space>

        <n-result
          v-if="detail.type === '视频' && videoQualityError"
          status="warning"
          title="视频质量信息不可用"
          :description="videoQualityError"
        />

        <n-data-table
          v-else
          :columns="qualityColumns"
          :data="detail.qualityRows"
          :loading="videoQualityLoading"
          :pagination="false"
          :single-line="false"
          size="small"
        />
    </n-space>
  </n-modal>

  <n-modal
    :show="downloadStatusModalVisible"
    preset="card"
    :title="downloadingResourceType === 'video' ? '正在下载视频' : downloadingResourceType === 'video-audio' ? '正在提取音频' : '正在下载音频'"
    style="width: 420px;"
    :mask-closable="false"
    :close-on-esc="false"
    :closable="false"
  >
    <n-space vertical size="large">
      <n-text>
        正在下载《{{ downloadingTitle || detail?.name || '未命名资源' }}》的
        {{ detail?.qualityRows.find((item) => item.key === downloadingQuality)?.definition || detail?.qualityRows.find((item) => item.key === downloadingQuality)?.quality || '' }}
        {{ downloadingResourceType === 'video' ? '视频' : '音频' }}，请稍候。
      </n-text>
      <n-text depth="3">
        <span v-if="downloadingResourceType === 'video'">
          视频文件将通过本地服务代理下载，当前过程不可取消。
        </span>
        <span v-else-if="downloadingResourceType === 'video-audio'">
          正在用纯 JS 从视频中提取音频并转为 MP3，准备阶段可能会暂时看不到进度。
        </span>
        <span v-else>
          下载由本地服务代理完成，当前过程不可取消。
        </span>
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
