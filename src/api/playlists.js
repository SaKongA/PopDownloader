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

function readBlobText(blob) {
  if (!blob || typeof blob.text !== 'function') {
    return Promise.resolve('')
  }

  return blob.text().catch(() => '')
}

/**
 * 批量打包下载。
 *
 * 返回的 Promise 上挂了 `abort()`，调用它可以中断正在进行的请求（用户点「取消下载」）。
 * 中断后 Promise 以 `error.aborted = true` 拒绝，界面据此区分「已取消」和「失败」。
 *
 * 注意：`responseType` 为 'blob' 时访问 `xhr.responseText` 会抛 InvalidStateError，
 * 一旦这个异常发生在 onload 里，Promise 既不会 resolve 也不会 reject，界面就一直停在
 * 「下载中」。所以错误响应体必须从 `xhr.response`（Blob）里读。
 */
export function downloadPlaylistBatchZipWithProgress({ playlistTitle, tasks, batchId, onProgress }) {
  const sessionPayload = getSessionPayload()

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return Promise.reject(new Error('缺少批量下载任务。'))
  }

  if (!batchId) {
    return Promise.reject(new Error('缺少批量任务 ID。'))
  }

  let xhrRef = null
  let abortRequested = false

  const promise = new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhrRef = xhr

    let settled = false

    const settleResolve = (value) => {
      if (settled) {
        return
      }

      settled = true
      resolve(value)
    }

    const settleReject = (error) => {
      if (settled) {
        return
      }

      settled = true
      reject(error)
    }

    const createAbortError = () => {
      const error = new Error('已取消下载')
      error.aborted = true
      return error
    }

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

    xhr.onabort = () => {
      settleReject(createAbortError())
    }

    xhr.onload = () => {
      if (abortRequested) {
        settleReject(createAbortError())
        return
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        readBlobText(xhr.response).then((text) => {
          if (text) {
            try {
              const payload = JSON.parse(text)
              settleReject(new Error(payload?.error || payload?.message || '下载压缩包失败'))
              return
            } catch {
              // 非 JSON 错误体，落回通用文案
            }
          }

          settleReject(new Error('下载压缩包失败'))
        })
        return
      }

      const disposition = xhr.getResponseHeader('content-disposition') || ''
      const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)
      const fileName = fileNameMatch?.[1] || fileNameMatch?.[2]

      settleResolve({
        blob: xhr.response,
        fileName: fileName ? decodeURIComponent(fileName) : '',
      })
    }

    xhr.onerror = () => {
      settleReject(new Error('下载压缩包失败'))
    }

    xhr.send(JSON.stringify({
      ...sessionPayload,
      playlist_title: playlistTitle,
      batch_id: batchId,
      tasks,
    }))
  })

  promise.abort = () => {
    if (abortRequested) {
      return
    }

    abortRequested = true

    try {
      xhrRef?.abort()
    } catch {
      // 请求已结束时 abort 会抛，忽略
    }
  }

  return promise
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
