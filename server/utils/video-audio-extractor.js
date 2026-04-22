const fs = require('fs')
const os = require('os')
const path = require('path')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const { downloadVideoToFile } = require('./video-download')

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

function sanitizeFilenamePart(value, fallback = 'video-audio') {
  const normalized = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .trim()

  return normalized || fallback
}

async function safeUnlink(filePath) {
  if (!filePath) {
    return
  }

  try {
    await fs.promises.unlink(filePath)
  } catch {
    // ignore cleanup errors
  }
}

class VideoAudioExtractor {
  extractAudioFromVideo(videoPath, audioPath, kbps = 320) {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(`${kbps}k`)
        .format('mp3')
        .on('end', resolve)
        .on('error', reject)
        .save(audioPath)
    })
  }

  async extractMp3FromVideoUrl(url, options = {}) {
    const baseName = sanitizeFilenamePart(options.baseName || path.basename(new URL(url).pathname, path.extname(new URL(url).pathname)))
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'popmusic-video-audio-'))
    const videoPath = path.join(tempDir, `${baseName}.mp4`)
    const audioPath = path.join(tempDir, `${baseName}.mp3`)

    try {
      await downloadVideoToFile(url, videoPath)
      await this.extractAudioFromVideo(videoPath, audioPath, options.kbps || 320)

      const buffer = await fs.promises.readFile(audioPath)

      return {
        buffer,
        outputExtension: '.mp3',
        contentType: 'audio/mpeg',
      }
    } finally {
      await safeUnlink(videoPath)
      await safeUnlink(audioPath)
      try {
        await fs.promises.rmdir(tempDir)
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

module.exports = {
  VideoAudioExtractor,
}
