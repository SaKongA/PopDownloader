const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl, fetchWithRetry } = require('../utils/http')

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
      const target = buildUrl(endpoints.videoV2, { aid })
      const upstream = await fetchWithRetry(target, {
        method: 'POST',
        headers: {
          Cookie: `sessionid=${sessionid};`,
          'Content-Type': request.headers['content-type'],
        },
        body: JSON.stringify({
          video_id,
          type,
          scene_name,
          queue_type,
        }),
      })

      const raw = await upstream.text()

      // 上游偶尔会返回 2xx + 空 body。直接 upstream.json() 会抛
      // "Unexpected end of JSON input"，被 catch 成 500，前端只能看到笼统的
      // 「获取视频信息失败」，无从判断是网络问题、参数问题还是上游故障。
      if (!raw) {
        res.status(502).json({
          message: '汽水音乐视频接口返回空响应，请确认视频 ID 后重试。登录状态本身是有效的。',
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
