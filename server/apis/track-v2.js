const { endpoints, fixed, getPcQuery } = require('../config/qishui-auth')
const { buildUrl, fetchWithRetry } = require('../utils/http')

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
      const target = buildUrl(endpoints.trackV2, getPcQuery({ aid }))
      const upstream = await fetchWithRetry(
        target,
        {
          method: 'POST',
          headers: {
            Cookie: `sessionid=${sessionid};`,
            'Content-Type': request.headers['content-type'],
          },
          body: JSON.stringify({
            track_id,
            media_type,
            queue_type,
            scene_name,
          }),
        },
        { retries: 2, delayMs: 300 },
      )

      const raw = await upstream.text()

      // 上游对内容类接口做客户端签名校验，未通过时返回 200 + 空 body。
      // 账号类接口（如 /luna/pc/me）不受影响，所以登录态本身是有效的。
      if (!raw) {
        res.status(502).json({
          message:
            '汽水音乐内容接口返回空响应：上游对该接口做了客户端签名校验，当前无法获取歌曲信息。登录状态本身是有效的。',
          code: 'upstream_empty_response',
        })
        return
      }

      let payload
      try {
        payload = JSON.parse(raw)
      } catch {
        res.status(502).json({
          message: '汽水音乐接口返回了无法解析的内容。',
          code: 'upstream_invalid_json',
          raw: raw.slice(0, 200),
        })
        return
      }

      res.status(upstream.status).json(payload)
    } catch (error) {
      res.status(502).json({
        message: 'failed',
        error: error.message,
      })
    }
  },
}
