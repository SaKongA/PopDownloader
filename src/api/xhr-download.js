/**
 * 带进度、可中断的 blob 下载请求。
 *
 * 三个下载入口（原始音频 / 视频 / 从视频提取音频）原本各写了一份几乎相同的 XHR 逻辑，
 * 也都踩了同一个坑，所以统一收到这里。
 *
 * 两种失败模式必须一起处理：
 *
 * 1. `responseType` 为 'blob' 时访问 `xhr.responseText` 会抛 `InvalidStateError`。
 *    如果这个异常发生在 `onload` 里，Promise 既不会 resolve 也不会 reject，
 *    界面就会永远停在「下载中」且关不掉。所以错误响应体必须从 `xhr.response`
 *    （Blob）里读。
 * 2. 同一个 `onload` 里被触发多次（例如 abort 后仍收到 load 事件）会重复 settle，
 *    这里用 `settled` 保证只结算一次。
 *
 * 返回的 Promise 上挂了 `abort()`，中断后以 `error.aborted = true` 拒绝，
 * 调用方据此区分「用户取消」和「真的失败」。
 */

function readBlobText(blob) {
  if (!blob || typeof blob.text !== 'function') {
    return Promise.resolve('')
  }

  return blob.text().catch(() => '')
}

function parseFileName(disposition) {
  if (!disposition) {
    return ''
  }

  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/)
  const raw = match?.[1] || match?.[2]

  if (!raw) {
    return ''
  }

  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function requestBlobWithProgress({ url, body, fallbackMessage, onProgress }) {
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
      const error = new Error('已取消')
      error.aborted = true
      return error
    }

    xhr.open('POST', url, true)
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
              settleReject(new Error(payload?.error || payload?.message || fallbackMessage))
              return
            } catch {
              // 非 JSON 错误体，落回通用文案
            }
          }

          settleReject(new Error(fallbackMessage))
        })
        return
      }

      settleResolve({
        blob: xhr.response,
        fileName: parseFileName(xhr.getResponseHeader('content-disposition')),
      })
    }

    xhr.onerror = () => {
      settleReject(new Error(fallbackMessage))
    }

    xhr.send(JSON.stringify(body))
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
