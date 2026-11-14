const { fixed } = require('../config/qishui-auth')
const { downloadTrackMedia, getTrackV2Payload } = require('../utils/track-download')
const { DEFAULT_KBPS } = require('../utils/track-mp3-transcoder')

const SUPPORTED_FORMATS = ['original', 'mp3']

const request = {
  method: 'post',
  path: '/api/track/download-encrypted',
  query: {},
  headers: {
    'content-type': 'application/json',
  },
  body: {
    aid: fixed.aid,
    sessionid: 'string',
    track_id: 'string',
    quality: 'string',
    format: 'original | mp3',
    kbps: DEFAULT_KBPS,
  },
}

const response = {
  contentType: 'audio/mp4',
  fileName: '[track] - artist.m4a',
}

module.exports = {
  name: 'track-download-encrypted',
  method: request.method,
  path: request.path,
  request,
  response,
  handler: async (req, res) => {
    const { quality = '', format = 'original', kbps } = req.body || {}
    const trackV2Payload = getTrackV2Payload(req.body)

    if (!trackV2Payload.sessionid) {
      res.status(400).json({
        message: 'sessionid is required',
      })
      return
    }

    if (!trackV2Payload.track_id) {
      res.status(400).json({
        message: 'track_id is required',
      })
      return
    }

    if (!quality) {
      res.status(400).json({
        message: 'quality is required',
      })
      return
    }

    if (!SUPPORTED_FORMATS.includes(format)) {
      res.status(400).json({
        message: `format must be one of: ${SUPPORTED_FORMATS.join(', ')}`,
      })
      return
    }

    try {
      const result = await downloadTrackMedia({
        aid: trackV2Payload.aid,
        sessionid: trackV2Payload.sessionid,
        track_id: trackV2Payload.track_id,
        quality,
        format,
        kbps: Number(kbps) || DEFAULT_KBPS,
      })

      res.setHeader('Content-Type', result.contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`)
      res.setHeader('Content-Length', result.buffer.length)
      // 输出播放来源与试听状态响应头。
      res.setHeader('X-Download-Source', result.source || 'track_v2')
      res.setHeader('X-Track-Trial', result.isTrial ? '1' : '0')

      if (result.upgradeError) {
        // 输出升级失败原因。
        res.setHeader('X-Playback-Upgrade-Error', encodeURIComponent(result.upgradeError))
      }

      if (result.durationInfo) {
        res.setHeader('X-Track-Full-Duration-Ms', String(result.durationInfo.fullDurationMs))
        res.setHeader('X-Track-Playable-Ms', String(result.durationInfo.playableMs))
      }

      res.send(result.buffer)
    } catch (error) {
      res.status(error.status || 500).json({
        message: 'failed',
        error: error.message,
      })
    }
  },
}
