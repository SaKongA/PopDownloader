const path = require('path')
const { VideoAudioExtractor } = require('../utils/video-audio-extractor')

const request = {
  method: 'post',
  path: '/api/video/download-audio',
  headers: {
    'content-type': 'application/json; charset=utf-8',
  },
  body: {
    url: 'string',
    file_name: 'string?',
  },
}

function sanitizeFilename(fileName) {
  const baseName = String(fileName || 'video-audio.mp3')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .trim()

  if (!baseName) {
    return 'video-audio.mp3'
  }

  return baseName
}

module.exports = {
  name: 'video-download-audio',
  method: request.method,
  path: request.path,
  request,
  response: {},
  handler: async (req, res) => {
    const { url, file_name } = req.body || {}

    if (!url) {
      res.status(400).json({
        message: 'url is required',
      })
      return
    }

    try {
      const extractor = new VideoAudioExtractor()
      const result = await extractor.extractMp3FromVideoUrl(url)
      const defaultBaseName = path.basename(new URL(url).pathname, path.extname(new URL(url).pathname)) || 'video-audio'
      const safeName = sanitizeFilename(file_name || `${defaultBaseName}${result.outputExtension}`)

      res.setHeader('Content-Type', result.contentType)
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`)
      res.setHeader('Content-Length', result.buffer.length)

      res.send(result.buffer)
    } catch (error) {
      res.status(500).json({
        message: 'failed',
        error: error.message,
      })
    }
  },
}
