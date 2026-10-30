const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const ffmpeg = require('@ffmpeg-installer/ffmpeg').path

const DEFAULT_KBPS = 320

// ID3v2 的 TXXX/标准帧能承载的字段有限，这里只映射通用标签。
const METADATA_FIELDS = [
  ['title', 'title'],
  ['artist', 'artist'],
  ['album', 'album'],
  ['albumArtist', 'album_artist'],
  ['date', 'date'],
  ['genre', 'genre'],
  ['composer', 'composer'],
]

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join('/')
  }

  return String(value || '').trim()
}

function buildMetadataArgs(metadata = {}) {
  const args = []

  for (const [sourceKey, tagName] of METADATA_FIELDS) {
    const value = normalizeValue(metadata[sourceKey])

    if (value) {
      args.push('-metadata', `${tagName}=${value}`)
    }
  }

  return args
}

function runFfmpeg(args) {
  // 统一用 argv 数组传参：路径里带空格/中文/括号时不会被切碎。
  // （fluent-ffmpeg 的字符串 option 就踩过这个坑，会把带空格的值拆成两个参数。）
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      // 只保留尾部，避免长文件刷爆内存
      stderr = (stderr + chunk.toString()).slice(-4000)
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      const error = new Error(`ffmpeg exited with code ${code}`)
      error.stderr = stderr
      reject(error)
    })
  })
}

class TrackMp3Transcoder {
  /**
   * 把上游下发的音频流转成 MP3。
   *
   * 只做「容器 + 编码」转换：输入必须是已经可解码的音频流，
   * 本模块不涉及解密、不涉及任何签名逻辑。
   */
  async transcode({
    inputBuffer,
    inputExtension = '.m4a',
    metadata = {},
    coverBuffer = null,
    coverMime = null,
    kbps = DEFAULT_KBPS,
  }) {
    if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
      throw new Error('转码输入为空')
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'popd-mp3-'))
    const extension = inputExtension || '.m4a'
    const inputPath = path.join(tempDir, `input${extension}`)
    const outputPath = path.join(tempDir, 'output.mp3')
    const coverPath = coverBuffer ? path.join(tempDir, 'cover.jpg') : null

    try {
      await fs.promises.writeFile(inputPath, inputBuffer)

      if (coverPath) {
        await fs.promises.writeFile(coverPath, coverBuffer)
      }

      const baseArgs = ['-hide_banner', '-y', '-i', inputPath]

      if (coverPath) {
        baseArgs.push('-i', coverPath)
      }

      const encodeArgs = [
        '-map', '0:a:0',
        '-c:a', 'libmp3lame',
        '-b:a', `${kbps}k`,
        '-id3v2_version', '3',
        '-map_metadata', '-1',
        '-write_id3v1', '0',
        ...buildMetadataArgs(metadata),
        outputPath,
      ]

      if (coverPath) {
        // 有封面时尝试把封面作为 attached_pic 嵌入。部分源（例如纯音频 m4a）
        // 没有可拷贝的视频轨，这一步会失败，下面会退化成无封面重转。
        const withCoverArgs = [
          ...baseArgs,
          '-map', '1:v:0',
          '-c:v', 'copy',
          '-disposition:v:0', 'attached_pic',
          ...encodeArgs,
        ]

        try {
          await runFfmpeg(withCoverArgs)
        } catch {
          await fs.promises.rm(outputPath, { force: true })
          await runFfmpeg(['-hide_banner', '-y', '-i', inputPath, ...encodeArgs])
        }
      } else {
        await runFfmpeg([...baseArgs, ...encodeArgs])
      }

      const outputBuffer = await fs.promises.readFile(outputPath)

      if (outputBuffer.length === 0) {
        throw new Error('转码产物为空')
      }

      return {
        buffer: outputBuffer,
        extension: '.mp3',
        contentType: 'audio/mpeg',
        kbps,
      }
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}

module.exports = {
  TrackMp3Transcoder,
  DEFAULT_KBPS,
}
