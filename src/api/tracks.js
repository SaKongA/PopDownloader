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

export async function fetchTrackV2(trackId) {
  if (!trackId) {
    throw new Error('缺少乐曲 ID。')
  }

  const response = await fetch('/api/track/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...getSessionPayload(),
      track_id: trackId,
      media_type: 'track',
      queue_type: 'search_one_track',
      scene_name: 'search',
    }),
  })

  return parseApiResponse(response, '获取乐曲信息失败')
}

export async function downloadEncryptedTrack({ trackId, quality }) {
  if (!trackId) {
    throw new Error('缺少乐曲 ID。')
  }

  if (!quality) {
    throw new Error('缺少音质信息。')
  }

  const response = await fetch('/api/track/download-encrypted', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...getSessionPayload(),
      track_id: trackId,
      quality,
    }),
  })

  if (!response.ok) {
    let payload = null

    try {
      payload = await response.json()
    } catch {
      throw new Error('下载加密文件失败')
    }

    throw new Error(payload?.error || payload?.message || '下载加密文件失败')
  }

  const disposition = response.headers.get('content-disposition') || ''
  const fileNameMatch = disposition.match(/filename="?([^"]+)"?/)
  const fileName = fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1]) : ''
  const blob = await response.blob()

  return {
    blob,
    fileName,
  }
}

export function downloadEncryptedTrackWithProgress({ trackId, quality, onProgress }) {
  if (!trackId) {
    return Promise.reject(new Error('缺少乐曲 ID。'))
  }

  if (!quality) {
    return Promise.reject(new Error('缺少音质信息。'))
  }

  const sessionPayload = getSessionPayload()

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/track/download-encrypted', true)
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

    xhr.onload = async () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        const text = typeof xhr.responseText === 'string' ? xhr.responseText : ''

        try {
          const payload = JSON.parse(text)
          reject(new Error(payload?.error || payload?.message || '下载加密文件失败'))
        } catch {
          reject(new Error('下载加密文件失败'))
        }
        return
      }

      const disposition = xhr.getResponseHeader('content-disposition') || ''
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/)
      const fileName = fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1]) : ''

      resolve({
        blob: xhr.response,
        fileName,
      })
    }

    xhr.onerror = () => {
      reject(new Error('下载加密文件失败'))
    }

    xhr.send(JSON.stringify({
      ...sessionPayload,
      track_id: trackId,
      quality,
    }))
  })
}
