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

  if (typeof payload?.status_code === 'number' && payload.status_code !== 0) {
    throw new Error(payload?.message || fallbackMessage)
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

export async function fetchPlaylistBatchProgress(batchId) {
  if (!batchId) {
    throw new Error('缺少批量任务 ID。')
  }

  const response = await fetch(`/api/playlist/batch-progress?batch_id=${encodeURIComponent(batchId)}`)
  return parseApiResponse(response, '获取打包进度失败')
}

export function downloadPlaylistBatchZipWithProgress({ playlistTitle, tasks, batchId, onProgress }) {
  const sessionPayload = getSessionPayload()

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return Promise.reject(new Error('缺少批量下载任务。'))
  }

  if (!batchId) {
    return Promise.reject(new Error('缺少批量任务 ID。'))
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/playlist/batch-download', true)
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
          reject(new Error(payload?.error || payload?.message || '下载压缩包失败'))
        } catch {
          reject(new Error('下载压缩包失败'))
        }
        return
      }

      const disposition = xhr.getResponseHeader('content-disposition') || ''
      const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)
      const fileName = fileNameMatch?.[1] || fileNameMatch?.[2]

      resolve({
        blob: xhr.response,
        fileName: fileName ? decodeURIComponent(fileName) : '',
      })
    }

    xhr.onerror = () => {
      reject(new Error('下载压缩包失败'))
    }

    xhr.send(JSON.stringify({
      ...sessionPayload,
      playlist_title: playlistTitle,
      batch_id: batchId,
      tasks,
    }))
  })
}

export async function fetchMyPlaylists() {
  const response = await fetch('/api/me/playlists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(getSessionPayload()),
  })

  return parseApiResponse(response, '获取我创建的歌单失败')
}

export async function fetchCollectedPlaylists() {
  const response = await fetch('/api/me/collection/mixed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(getSessionPayload()),
  })

  return parseApiResponse(response, '获取我收藏的歌单失败')
}

export async function fetchPlaylistDetail({ playlistId, cursor = '', count = 15 }) {
  const response = await fetch('/api/playlist/detail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...getSessionPayload(),
      playlist_id: playlistId,
      cursor,
      count,
    }),
  })

  return parseApiResponse(response, '获取歌单详情失败')
}
