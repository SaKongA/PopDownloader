const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl } = require('../utils/http')

const request = {
  method: 'post',
  path: '/api/track/v2',
  query: {
    aid: fixed.aid,
  },
  headers: {
    'content-type': 'application/json; charset=utf-8',
  },
  body: {
    aid: fixed.aid,
    sessionid: 'string',
    track_id: 'string',
    media_type: 'track',
    queue_type: 'search_one_track',
    scene_name: 'search',
  },
}

const response = {
  track: {
    id: 'string',
    name: 'string',
  },
  track_player: {
    video_model: 'string',
  },
}

module.exports = {
  name: 'track-v2',
  method: request.method,
  path: request.path,
  request,
  response,
  handler: async (req, res) => {
    const {
      aid = fixed.aid,
      sessionid,
      track_id,
      media_type = 'track',
      queue_type = 'search_one_track',
      scene_name = 'search',
    } = req.body || {}

    if (!sessionid) {
      res.status(400).json({
        message: 'sessionid is required',
      })
      return
    }

    if (!track_id) {
      res.status(400).json({
        message: 'track_id is required',
      })
      return
    }

    try {
      const target = buildUrl(endpoints.trackV2, {
        aid,
        iid: fixed.iid,
        version_code: fixed.version_code,
        app_version: fixed.app_version,
        device_platform: fixed.device_platform,
      })
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          Cookie: `sessionid=${sessionid};`,
          'Content-Type': request.headers['content-type'],
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 LunaPC/3.2.1',
        },
        body: JSON.stringify({
          track_id,
          media_type,
          queue_type,
          scene_name,
        }),
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
