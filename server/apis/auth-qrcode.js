const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl } = require('../utils/http')

const request = {
  method: 'get',
  path: '/api/auth/qrcode',
  query: {
    passport_jssdk_version: fixed.passport_jssdk_version,
    passport_jssdk_type: fixed.passport_jssdk_type,
    is_from_ttaccountsdk: fixed.is_from_ttaccountsdk,
    aid: fixed.aid,
    next: fixed.next,
  },
  headers: {},
  body: null,
}

const response = {
  message: 'success',
  data: {
    token: 'string',
    qrcode: 'data:image/png;base64,...',
    expire_time: 0,
    qrcode_index_url: 'string',
  },
}

module.exports = {
  name: 'auth-qrcode',
  method: request.method,
  path: request.path,
  request,
  response,
  handler: async (_req, res) => {
    try {
      const target = buildUrl(endpoints.getQrcode, request.query)
      const upstream = await fetch(target)
      const payload = await upstream.json()

      res.status(upstream.status).json(payload)
    } catch (error) {
      res.status(500).json({
        message: 'failed',
        error: error.message,
      })
    }
  },
}
