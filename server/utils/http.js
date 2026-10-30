function buildUrl(url, query = {}) {
  const target = new URL(url)

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      target.searchParams.set(key, value)
    }
  }

  return target.toString()
}

function getSessionIdFromSetCookie(headers) {
  const cookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')]
        : []

  for (const item of cookies) {
    // 不用 headers.get('set-cookie') 兜底时多个 cookie 会以逗号拼接，
    // 所以取值时把逗号和空白一起排除，避免把后一个 cookie 的内容也吃进来
    const match = item.match(/sessionid=([^;,\s]+)/)
    if (match) {
      return match[1]
    }
  }

  return ''
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 带重试的 fetch。
 *
 * 抖音/汽水的 CDN（douyin.com 多 IP 轮询）偶发连接被重置，实测同一个分享链接
 * 连续请求会出现 2 成功 1 失败。这里对「网络层错误」和 5xx 做有限重试，
 * 4xx（含业务错误）直接抛出，不浪费请求。
 */
async function fetchWithRetry(url, options = {}, { retries = 2, delayMs = 300 } = {}) {
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options)

      // 5xx 视为上游临时故障，可重试
      if (response.status >= 500 && attempt < retries) {
        // 重试前必须把响应体丢弃，否则连接不会释放，重试几次就会堆积 socket
        await response.body?.cancel().catch(() => {})

        lastError = new Error(`upstream status ${response.status}`)
        await sleep(delayMs * (attempt + 1))
        continue
      }

      return response
    } catch (error) {
      lastError = error

      if (attempt >= retries) {
        break
      }

      await sleep(delayMs * (attempt + 1))
    }
  }

  throw lastError || new Error('fetchWithRetry failed')
}

module.exports = {
  buildUrl,
  getSessionIdFromSetCookie,
  fetchWithRetry,
}
