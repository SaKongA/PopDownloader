const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl } = require('../utils/http')

const request = {
  method: 'post',
  path: '/api/playlist/detail',
  query: {
    aid: fixed.aid,
    region: fixed.region,
    geo_region: fixed.geo_region,
    os_region: fixed.os_region,
    sim_region: fixed.sim_region,
    playlist_id: 'string',
    cursor: '',
    count: 15,
  },
  headers: {
    'content-type': 'application/json',
  },
  body: {
    aid: fixed.aid,
    sessionid: 'string',
    playlist_id: 'string',
    cursor: '',
    count: 15,
  },
}

const response = {
  has_more: true,
  next_cursor: 'string',
  playlist: {
    id: 'string',
    title: 'string',
  },
  media_resources: [],
}

module.exports = {
  name: 'playlist-detail',
  method: request.method,
  path: request.path,
  request,
  response,
  handler: async (req, res) => {
    const {
      aid = fixed.aid,
      sessionid,
      playlist_id,
      cursor = '',
      count = 15,
    } = req.body || {}

    if (!sessionid) {
      res.status(400).json({
        message: 'sessionid is required',
      })
      return
    }

    if (!playlist_id) {
      res.status(400).json({
        message: 'playlist_id is required',
      })
      return
    }

    try {
      const target = buildUrl(endpoints.playlistDetail, {
        aid,
        iid: fixed.iid,
        version_code: fixed.version_code,
        app_version: fixed.app_version,
        device_platform: fixed.device_platform,
        region: fixed.region,
        geo_region: fixed.geo_region,
        os_region: fixed.os_region,
        sim_region: fixed.sim_region,
        playlist_id,
        cursor,
        count,
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
