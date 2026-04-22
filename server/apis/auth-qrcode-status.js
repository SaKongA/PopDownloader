const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl, getSessionIdFromSetCookie } = require('../utils/http')

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

      const upstream = await fetch(target, {
        method: 'POST',
        headers: request.headers,
        body,
      })

      const payload = await upstream.json()
      const sessionid = getSessionIdFromSetCookie(upstream.headers)

      res.status(upstream.status).json({
        ...payload,
        auth: {
          aid: fixed.aid,
          sessionid,
        },
      })
    } catch (error) {
      res.status(500).json({
        message: 'failed',
        error: error.message,
      })
    }
  },
}
