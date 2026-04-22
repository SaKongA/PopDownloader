const path = require('path')
const { fetchVideoStream } = require('../utils/video-download')

const request = {
  method: 'post',
  path: '/api/video/download',
  headers: {
    'content-type': 'application/json; charset=utf-8',
  },
  body: {
    url: 'string',
    file_name: 'string?',
  },
}

function sanitizeFilename(fileName) {
  const baseName = String(fileName || 'video.mp4')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .trim()

  if (!baseName) {
    return 'video.mp4'
  }

  return baseName
}

module.exports = {
  name: 'video-download',
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
      const upstream = await fetchVideoStream(url)
      const upstreamType = upstream.headers.get('content-type') || 'application/octet-stream'
      const upstreamLength = upstream.headers.get('content-length')
      const fallbackExtension = path.extname(new URL(url).pathname) || '.mp4'
      const safeName = sanitizeFilename(file_name || `video${fallbackExtension}`)

      res.setHeader('Content-Type', upstreamType)
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`)

      if (upstreamLength) {
        res.setHeader('Content-Length', upstreamLength)
      }

      const reader = upstream.body.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        res.write(Buffer.from(value))
      }

      res.end()
    } catch (error) {
      res.status(error.status || 500).json({
        message: 'failed to download video',
        error: error.message,
      })
    }
  },
}
