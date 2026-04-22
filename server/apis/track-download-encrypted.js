const { fixed } = require('../config/qishui-auth')
const { downloadTrackMedia, getTrackV2Payload } = require('../utils/track-download')

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
    const { quality = '' } = req.body || {}
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

    try {
      const result = await downloadTrackMedia({
        aid: trackV2Payload.aid,
        sessionid: trackV2Payload.sessionid,
        track_id: trackV2Payload.track_id,
        quality,
      })

      res.setHeader('Content-Type', result.contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName)}"`)
      res.setHeader('Content-Length', result.buffer.length)

      res.send(result.buffer)
    } catch (error) {
      res.status(error.status || 500).json({
        message: 'failed',
        error: error.message,
      })
    }
  },
}
