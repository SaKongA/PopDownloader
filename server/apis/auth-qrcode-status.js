const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl, fetchWithRetry, getSessionIdFromSetCookie } = require('../utils/http')

const request = {
  method: 'post',
  path: '/api/auth/qrcode/status',
  query: {
    passport_jssdk_version: fixed.passport_jssdk_version,
    passport_jssdk_type: fixed.passport_jssdk_type,
    is_from_ttaccountsdk: fixed.is_from_ttaccountsdk,
    aid: fixed.aid,
    iid: fixed.iid,
  },
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
  },
  body: {
    need_logo: fixed.need_logo,
    need_short_url: fixed.need_short_url,
    is_frontier: fixed.is_frontier,
    token: 'string',
    is_new_login: fixed.is_new_login,
    next: fixed.next,
  },
}

const response = {
  message: 'success',
  data: {
    status: 'new | scanned | confirmed',
  },
  auth: {
    aid: fixed.aid,
    sessionid: '',
  },
}

/**
 * sessionid 可能出现在三处，按优先级依次兜底：
 * 1. 响应 Set-Cookie（主路径）
 * 2. 响应体 data.sessionid
 * 3. 响应体 data.redirect_url 的查询参数里
 */
function resolveSessionId(headers, payload) {
  // 主路径：Set-Cookie。实现复用 http.js，避免两处各写一份正则
  const fromCookie = getSessionIdFromSetCookie(headers)

  if (fromCookie) {
    return fromCookie
  }

  const data = payload?.data || {}
  const direct = String(data.sessionid || '').trim()
  if (direct) {
    return direct
  }

  const redirectUrl = String(data.redirect_url || '')
  if (redirectUrl) {
    const queryPart = redirectUrl.split('?')[1] || ''
    for (const pair of queryPart.split('&')) {
      const [key, value = ''] = pair.split('=')
      if (key === 'sessionid' && value) {
        return decodeURIComponent(value)
      }
    }
  }

  return ''
}

module.exports = {
  name: 'auth-qrcode-status',
  method: request.method,
  path: request.path,
  request,
  response,
  handler: async (req, res) => {
    const { token } = req.body || {}

    if (!token) {
      res.status(400).json({
        message: 'token is required',
      })
      return
    }

    try {
      const target = buildUrl(endpoints.checkQrConnect, request.query)
      const body = new URLSearchParams({
        ...request.body,
        token,
      })

      // 扫码轮询每 2 秒一次，上游 CDN 偶发重置连接，必须重试
      const upstream = await fetchWithRetry(
        target,
        {
          method: 'POST',
          headers: request.headers,
          body,
        },
        { retries: 3, delayMs: 200 },
      )

      const raw = await upstream.text()
      let payload = {}

      try {
        payload = raw ? JSON.parse(raw) : {}
      } catch {
        payload = { message: 'upstream returned non-json', raw: raw.slice(0, 200) }
      }

      const sessionid = resolveSessionId(upstream.headers, payload)

      res.status(upstream.status).json({
        ...payload,
        auth: {
          aid: fixed.aid,
          sessionid,
        },
      })
    } catch (error) {
      res.status(502).json({
        message: 'failed',
        error: error.message,
      })
    }
  },
}
