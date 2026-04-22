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
      const target = buildUrl(endpoints.me, { aid })
      const upstream = await fetch(target, {
        headers: {
          Cookie: `sessionid=${sessionid};`,
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
