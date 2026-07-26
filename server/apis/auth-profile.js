const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl } = require('../utils/http')

const request = {
  method: 'post',
  path: '/api/auth/profile',
  query: {},
  headers: {
    'content-type': 'application/json',
  },
  body: {
    aid: fixed.aid,
    sessionid: 'string',
  },
}

const response = {
  status_code: 0,
  my_info: {
    id: 'string',
    nickname: 'string',
    douyin_id: 'string',
    is_vip: false,
    vip_stage: 'string',
  },
}

module.exports = {
  name: 'auth-profile',
  method: request.method,
  path: request.path,
  request,
  response,
  handler: async (req, res) => {
    const { aid = fixed.aid, sessionid } = req.body || {}

    if (!sessionid) {
      res.status(400).json({
        message: 'sessionid is required',
      })
      return
    }

    try {
      const target = buildUrl(endpoints.me, {
        aid,
        iid: fixed.iid,
        version_code: fixed.version_code,
        app_version: fixed.app_version,
        device_platform: fixed.device_platform,
      })
      const upstream = await fetch(target, {
        headers: {
          Cookie: `sessionid=${sessionid};`,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 LunaPC/3.2.1',
        },
      })

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
