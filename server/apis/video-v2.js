const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl } = require('../utils/http')

const request = {
  method: 'post',
  path: '/api/video/v2',
  query: {
    aid: fixed.aid,
  },
  headers: {
    'content-type': 'application/json; charset=utf-8',
  },
  body: {
    aid: fixed.aid,
    sessionid: 'string',
    video_id: 'string',
    type: 'ugc_video',
    scene_name: 'library',
    queue_type: 'favorite_track_playlist',
  },
}

const response = {
  video: {
    video_id: 'string',
    title: 'string',
  },
}

module.exports = {
  name: 'video-v2',
  method: request.method,
  path: request.path,
  request,
  response,
  handler: async (req, res) => {
    const {
      aid = fixed.aid,
      sessionid,
      video_id,
      type = 'ugc_video',
      scene_name = 'library',
      queue_type = 'favorite_track_playlist',
    } = req.body || {}

    if (!sessionid) {
      res.status(400).json({
        message: 'sessionid is required',
      })
      return
    }

    if (!video_id) {
      res.status(400).json({
        message: 'video_id is required',
      })
      return
    }

    try {
      const target = buildUrl(endpoints.videoV2, {
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
          video_id,
          type,
          scene_name,
          queue_type,
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
