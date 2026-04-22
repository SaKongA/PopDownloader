<script setup>
import { ref, watch } from 'vue'
import {
  NAvatar,
  NButton,
  NCard,
  NEmpty,
  NGrid,
  NGridItem,
  NResult,
  NSkeleton,
  NSpace,
  NTabPane,
  NTabs,
  NText,
} from 'naive-ui'
import AuthRequiredResult from '../components/AuthRequiredResult.vue'
import PlaylistBatchDownloadModal from '../components/PlaylistBatchDownloadModal.vue'
import PlaylistDetailModal from '../components/PlaylistDetailModal.vue'
import {
  fetchCollectedPlaylists,
  fetchMyPlaylists,
} from '../api/playlists'

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

const activeTab = ref('created')
const loading = ref(false)
const errorMessage = ref('')
const createdPlaylists = ref([])
const collectedPlaylists = ref([])

const detailVisible = ref(false)
const selectedPlaylist = ref(null)
const batchDownloadVisible = ref(false)
const selectedBatchPlaylist = ref(null)

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

function normalizeCreatedPlaylists(payload) {
  const list = Array.isArray(payload?.playlists) ? payload.playlists : []
  return list.map(normalizePlaylistItem)
}

function normalizeCollectedPlaylists(payload) {
  const list = Array.isArray(payload?.mixed_collections) ? payload.mixed_collections : []

  return list
    .filter((item) => item?.item_type === 'playlist' && item?.playlist)
    .map((item) => normalizePlaylistItem(item.playlist))
}

async function loadPlaylists() {
  if (!props.isAuthenticated) {
    createdPlaylists.value = []
    collectedPlaylists.value = []
    errorMessage.value = ''
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const [createdPayload, collectedPayload] = await Promise.all([
      fetchMyPlaylists(),
      fetchCollectedPlaylists(),
    ])

    createdPlaylists.value = normalizeCreatedPlaylists(createdPayload)
    collectedPlaylists.value = normalizeCollectedPlaylists(collectedPayload)
  } catch (error) {
    createdPlaylists.value = []
    collectedPlaylists.value = []
    errorMessage.value = error?.message || '获取歌单失败'
  } finally {
    loading.value = false
  }
}

function openPlaylistDetail(playlist) {
  selectedPlaylist.value = playlist
  detailVisible.value = true
}

function closePlaylistDetail() {
  detailVisible.value = false
  selectedPlaylist.value = null
}

function openBatchDownload(playlist) {
  selectedBatchPlaylist.value = playlist
  batchDownloadVisible.value = true
}

function closeBatchDownload() {
  batchDownloadVisible.value = false
  selectedBatchPlaylist.value = null
}

watch(
  () => props.isAuthenticated,
  () => {
    loadPlaylists()
  },
  { immediate: true },
)
</script>

<template>
  <auth-required-result v-if="!isAuthenticated" />

  <n-space v-else vertical size="large">
    <playlist-detail-modal
      v-model:show="detailVisible"
      :playlist="selectedPlaylist"
      :user-profile="userProfile"
      @update:show="(value) => { if (!value) closePlaylistDetail() }"
    />

    <playlist-batch-download-modal
      v-model:show="batchDownloadVisible"
      :playlist="selectedBatchPlaylist"
      :user-profile="userProfile"
      @update:show="(value) => { if (!value) closeBatchDownload() }"
    />

    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="created" tab="我创建的歌单">
        <n-space vertical size="large">
          <n-grid v-if="loading" cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
            <n-grid-item v-for="item in [1, 2, 3]" :key="`created-loading-${item}`">
              <n-card embedded :content-style="{ padding: '1px' }">
                <div style="display: flex; width: 100%; align-items: stretch;">
                  <div style="width: 180px; flex-shrink: 0; display: flex;">
                    <n-skeleton height="100%" width="180px" style="min-height: 180px;" />
                  </div>
                  <n-space vertical size="large" style="padding: 20px; flex: 1;">
                    <n-skeleton text :repeat="4" />
                  </n-space>
                </div>
              </n-card>
            </n-grid-item>
          </n-grid>

          <n-result
            v-else-if="errorMessage"
            status="error"
            title="歌单加载失败"
            :description="errorMessage"
          />

          <n-card v-else-if="createdPlaylists.length === 0" embedded>
            <n-empty description="当前没有歌单" />
          </n-card>

          <n-grid v-else cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
            <n-grid-item v-for="item in createdPlaylists" :key="`created-${item.id}`">
              <n-card embedded :content-style="{ padding: '1px' }">
                <div style="display: flex; width: 100%; align-items: stretch;">
                  <div style="width: 180px; flex-shrink: 0; display: flex; min-height: 180px;">
                    <img
                      :src="item.cover"
                      alt="playlist cover"
                      referrerpolicy="no-referrer"
                      style="width: 100%; height: 100%; object-fit: cover; display: block;"
                    />
                  </div>

                  <n-space
                    vertical
                    justify="space-between"
                    size="large"
                    style="padding: 20px; flex: 1; min-width: 0;"
                  >
                    <n-space vertical :size="10">
                      <n-text strong style="font-size: 16px;">
                        {{ item.title }}
                      </n-text>
                      <n-text depth="3">
                        音乐总数：{{ item.trackCount }}
                      </n-text>
                      <n-text depth="3">
                        歌单 ID：{{ item.id }}
                      </n-text>
                    </n-space>

                    <n-space align="center" justify="space-between" :wrap="false">
                      <n-space align="center" :wrap="false">
                        <img
                          v-if="item.ownerAvatar"
                          :src="item.ownerAvatar"
                          alt="owner avatar"
                          referrerpolicy="no-referrer"
                          style="width: 36px; height: 36px; border-radius: 9999px; object-fit: cover; display: block;"
                        />
                        <n-avatar v-else round :size="36">
                          {{ item.ownerName.slice(0, 1) || 'U' }}
                        </n-avatar>
                        <n-text>
                          {{ item.ownerName }}
                        </n-text>
                      </n-space>

                      <n-space :wrap="false">
                        <n-button secondary @click="openBatchDownload(item)">
                          打包下载
                        </n-button>
                        <n-button secondary @click="openPlaylistDetail(item)">
                          歌曲列表
                        </n-button>
                      </n-space>
                    </n-space>
                  </n-space>
                </div>
              </n-card>
            </n-grid-item>
          </n-grid>
        </n-space>
      </n-tab-pane>

      <n-tab-pane name="collected" tab="我收藏的歌单">
        <n-space vertical size="large">
          <n-grid v-if="loading" cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
            <n-grid-item v-for="item in [1, 2, 3]" :key="`collected-loading-${item}`">
              <n-card embedded :content-style="{ padding: '1px' }">
                <div style="display: flex; width: 100%; align-items: stretch;">
                  <div style="width: 180px; flex-shrink: 0; display: flex;">
                    <n-skeleton height="100%" width="180px" style="min-height: 180px;" />
                  </div>
                  <n-space vertical size="large" style="padding: 20px; flex: 1;">
                    <n-skeleton text :repeat="4" />
                  </n-space>
                </div>
              </n-card>
            </n-grid-item>
          </n-grid>

          <n-result
            v-else-if="errorMessage"
            status="error"
            title="歌单加载失败"
            :description="errorMessage"
          />

          <n-card v-else-if="collectedPlaylists.length === 0" embedded>
            <n-empty description="当前没有歌单" />
          </n-card>

          <n-grid v-else cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
            <n-grid-item v-for="item in collectedPlaylists" :key="`collected-${item.id}`">
              <n-card embedded :content-style="{ padding: '1px' }">
                <div style="display: flex; width: 100%; align-items: stretch;">
                  <div style="width: 180px; flex-shrink: 0; display: flex; min-height: 180px;">
                    <img
                      :src="item.cover"
                      alt="playlist cover"
                      referrerpolicy="no-referrer"
                      style="width: 100%; height: 100%; object-fit: cover; display: block;"
                    />
                  </div>

                  <n-space
                    vertical
                    justify="space-between"
                    size="large"
                    style="padding: 20px; flex: 1; min-width: 0;"
                  >
                    <n-space vertical :size="10">
                      <n-text strong style="font-size: 16px;">
                        {{ item.title }}
                      </n-text>
                      <n-text depth="3">
                        音乐总数：{{ item.trackCount }}
                      </n-text>
                      <n-text depth="3">
                        歌单 ID：{{ item.id }}
                      </n-text>
                    </n-space>

                    <n-space align="center" justify="space-between" :wrap="false">
                      <n-space align="center" :wrap="false">
                        <img
                          v-if="item.ownerAvatar"
                          :src="item.ownerAvatar"
                          alt="owner avatar"
                          referrerpolicy="no-referrer"
                          style="width: 36px; height: 36px; border-radius: 9999px; object-fit: cover; display: block;"
                        />
                        <n-avatar v-else round :size="36">
                          {{ item.ownerName.slice(0, 1) || 'U' }}
                        </n-avatar>
                        <n-text>
                          {{ item.ownerName }}
                        </n-text>
                      </n-space>

                      <n-space :wrap="false">
                        <n-button secondary @click="openBatchDownload(item)">
                          打包下载
                        </n-button>
                        <n-button secondary @click="openPlaylistDetail(item)">
                          歌曲列表
                        </n-button>
                      </n-space>
                    </n-space>
                  </n-space>
                </div>
              </n-card>
            </n-grid-item>
          </n-grid>
        </n-space>
      </n-tab-pane>
    </n-tabs>
  </n-space>
</template>
