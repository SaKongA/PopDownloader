import { getStoredSession } from '../utils/authStorage'
import { requestBlobWithProgress } from './xhr-download'

async function parseApiResponse(response, fallbackMessage) {
  let payload = null

  try {
    payload = await response.json()
  } catch {
    throw new Error(fallbackMessage)
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || fallbackMessage)
  }

  return payload
}

function getSessionPayload() {
  const session = getStoredSession()

  if (!session?.sessionid) {
    throw new Error('当前未登录。')
  }

  return session
}

export async function fetchVideoV2(videoId) {
  if (!videoId) {
    throw new Error('缺少视频 ID。')
  }

  const response = await fetch('/api/video/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...getSessionPayload(),
      video_id: videoId,
      type: 'ugc_video',
      scene_name: 'library',
      queue_type: 'favorite_track_playlist',
    }),
  })

  return parseApiResponse(response, '获取视频信息失败')
}

export function downloadVideoWithProgress({ url, fileName, onProgress }) {
  if (!url) {
    return Promise.reject(new Error('缺少视频下载地址。'))
  }

  return requestBlobWithProgress({
    url: '/api/video/download',
    body: { url, file_name: fileName },
    fallbackMessage: '下载视频失败',
    onProgress,
  })
}

export function downloadVideoAudioWithProgress({ url, fileName, onProgress }) {
  if (!url) {
    return Promise.reject(new Error('缺少视频下载地址。'))
  }

  return requestBlobWithProgress({
    url: '/api/video/download-audio',
    body: { url, file_name: fileName },
    fallbackMessage: '提取音频失败',
    onProgress,
  })
}
