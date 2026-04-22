const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl } = require('../utils/http')

const request = {
  method: 'post',
  path: '/api/me/collection/mixed',
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
  status_info: {
    log_id: 'string',
    now: 0,
    now_ts_ms: 0,
  },
  mixed_collections: [
    {
      item_type: 'playlist',
      playlist: {
        id: 'string',
        title: 'string',
        count_tracks: 0,
      },
    },
  ],
  total_num: 0,
}

module.exports = {
  name: 'me-collection-mixed',
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
      const target = buildUrl(endpoints.meCollectionMixed, { aid })
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
