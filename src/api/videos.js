import { getStoredSession } from '../utils/authStorage'

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

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/video/download', true)
    xhr.responseType = 'blob'
    xhr.setRequestHeader('Content-Type', 'application/json')

    xhr.onprogress = (event) => {
      if (typeof onProgress === 'function') {
        onProgress({
          loaded: event.loaded,
          total: event.lengthComputable ? event.total : 0,
          percent: event.lengthComputable && event.total > 0
            ? Math.min(100, Math.round((event.loaded / event.total) * 100))
            : 0,
        })
      }
    }

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const text = typeof xhr.responseText === 'string' ? xhr.responseText : ''

        try {
          const payload = JSON.parse(text)
          reject(new Error(payload?.error || payload?.message || '下载视频失败'))
        } catch {
          reject(new Error('下载视频失败'))
        }
        return
      }

      const disposition = xhr.getResponseHeader('content-disposition') || ''
      const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)
      const resolvedFileName = fileNameMatch?.[1] || fileNameMatch?.[2]

      resolve({
        blob: xhr.response,
        fileName: resolvedFileName ? decodeURIComponent(resolvedFileName) : '',
      })
    }

    xhr.onerror = () => {
      reject(new Error('下载视频失败'))
    }

    xhr.send(JSON.stringify({
      url,
      file_name: fileName,
    }))
  })
}

export function downloadVideoAudioWithProgress({ url, fileName, onProgress }) {
  if (!url) {
    return Promise.reject(new Error('缺少视频下载地址。'))
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/video/download-audio', true)
    xhr.responseType = 'blob'
    xhr.setRequestHeader('Content-Type', 'application/json')

    xhr.onprogress = (event) => {
      if (typeof onProgress === 'function') {
        onProgress({
          loaded: event.loaded,
          total: event.lengthComputable ? event.total : 0,
          percent: event.lengthComputable && event.total > 0
            ? Math.min(100, Math.round((event.loaded / event.total) * 100))
            : 0,
        })
      }
    }

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const text = typeof xhr.responseText === 'string' ? xhr.responseText : ''

        try {
          const payload = JSON.parse(text)
          reject(new Error(payload?.error || payload?.message || '提取音频失败'))
        } catch {
          reject(new Error('提取音频失败'))
        }
        return
      }

      const disposition = xhr.getResponseHeader('content-disposition') || ''
      const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)
      const resolvedFileName = fileNameMatch?.[1] || fileNameMatch?.[2]

      resolve({
        blob: xhr.response,
        fileName: resolvedFileName ? decodeURIComponent(resolvedFileName) : '',
      })
    }

    xhr.onerror = () => {
      reject(new Error('提取音频失败'))
    }

    xhr.send(JSON.stringify({
      url,
      file_name: fileName,
    }))
  })
}
