const fs = require('fs')
const { pipeline } = require('stream/promises')
const { Readable } = require('stream')

async function fetchVideoStream(url) {
  const upstream = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: 'https://music.douyin.com',
    },
  })

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '')
    const error = new Error(text || upstream.statusText || `下载视频失败: ${upstream.status}`)
    error.status = upstream.status || 502
    throw error
  }

  return upstream
}

async function downloadVideoToFile(url, outputPath) {
  const upstream = await fetchVideoStream(url)

  await pipeline(
    Readable.fromWeb(upstream.body),
    fs.createWriteStream(outputPath),
  )

  return {
    contentType: upstream.headers.get('content-type') || 'application/octet-stream',
    contentLength: upstream.headers.get('content-length') || '',
  }
}

module.exports = {
  fetchVideoStream,
  downloadVideoToFile,
}
