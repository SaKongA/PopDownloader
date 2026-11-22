const { Readable } = require('stream')
const archiver = require('archiver')
const { downloadTrackMedia } = require('../utils/track-download')
const { fetchVideoStream } = require('../utils/video-download')
const { VideoAudioExtractor } = require('../utils/video-audio-extractor')
const {
  createBatchProgress,
  deleteBatchProgress,
  updateBatchProgress,
} = require('../utils/batch-progress-store')

const request = {
  method: 'post',
  path: '/api/playlist/batch-download',
  headers: {
    'content-type': 'application/json; charset=utf-8',
  },
  body: {
    sessionid: 'string',
    playlist_title: 'string?',
    batch_id: 'string?',
    tasks: 'array',
  },
}

function sanitizeFilename(fileName, fallback = 'file') {
  const baseName = String(fileName || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .trim()

  return baseName || fallback
}

function appendToArchive(archive, input, name) {
  return new Promise((resolve, reject) => {
    const handleEntry = (entry) => {
      if (entry?.name !== name) {
        return
      }

      cleanup()
      resolve()
    }

    const handleError = (error) => {
      cleanup()
      reject(error)
    }

    const cleanup = () => {
      archive.off('entry', handleEntry)
      archive.off('error', handleError)
    }

    archive.on('entry', handleEntry)
    archive.on('error', handleError)
    archive.append(input, { name })
  })
}

module.exports = {
  name: 'playlist-batch-download',
  method: request.method,
  path: request.path,
  request,
  response: {},
  handler: async (req, res) => {
    const { sessionid, playlist_title, tasks, batch_id } = req.body || {}

    if (!sessionid) {
      res.status(400).json({
        message: 'sessionid is required',
      })
      return
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      res.status(400).json({
        message: 'tasks is required',
      })
      return
    }

    const zipName = `${sanitizeFilename(playlist_title || 'playlist-batch-download')}.zip`
    const archive = archiver('zip', { zlib: { level: 9 } })
    const batchId = String(batch_id || '').trim()

    // 客户端中途关闭/取消（前端 abort）时，res 会触发 close 且未正常结束。
    // 这里置标记让循环尽快退出，不再为已经没人要的 ZIP 继续抓取后续曲目。
    let clientAborted = false

    res.on('close', () => {
      if (res.writableEnded) {
        return
      }

      clientAborted = true

      try {
        archive.destroy()
      } catch {
        // 归档器可能已结束，忽略
      }

      if (batchId) {
        updateBatchProgress(batchId, {
          status: 'cancelled',
          error: '客户端已取消',
        })
        setTimeout(() => {
          deleteBatchProgress(batchId)
        }, 60 * 1000)
      }
    })

    archive.on('error', (error) => {
      if (clientAborted) {
        return
      }

      if (batchId) {
        updateBatchProgress(batchId, {
          status: 'failed',
          error: error.message,
        })
      }

      if (!res.headersSent) {
        res.status(500).json({
          message: 'failed',
          error: error.message,
        })
        return
      }

      res.destroy(error)
    })

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`)

    archive.pipe(res)

    if (batchId) {
      createBatchProgress(batchId, tasks.length)
    }

    try {
      const failures = []
      const trials = []
      const upgraded = []

      for (let index = 0; index < tasks.length; index += 1) {
        if (clientAborted) {
          return
        }

        const task = tasks[index]
        const fallbackPrefix = `${String(index + 1).padStart(3, '0')}-${sanitizeFilename(task?.title || 'file')}`
        const taskLabel = task?.title || task?.trackId || `第 ${index + 1} 项`

        try {
          if (task?.action === 'audio') {
            const result = await downloadTrackMedia({
              sessionid,
              track_id: task.trackId,
              quality: task.quality,
            })
            const entryName = sanitizeFilename(task.fileName || result.fileName || `${fallbackPrefix}.bin`)
            await appendToArchive(archive, result.buffer, entryName)

            // 记录全曲升级与试听状态。
            if (result.isTrial) {
              const seconds = result.durationInfo
                ? Math.round(result.durationInfo.playableMs / 1000)
                : 60
              const reason = result.upgradeError ? `（${result.upgradeError}）` : ''
              trials.push(`${taskLabel}：仅 ${seconds} 秒试听片段${reason}`)
            } else if (result.source === 'media_player') {
              const seconds = result.durationInfo
                ? Math.round(result.durationInfo.playableMs / 1000)
                : 0
              upgraded.push(`${taskLabel}：已按登录账号权益取到完整音频${seconds ? `（${seconds} 秒）` : ''}`)
            }
          } else if (task?.action === 'video') {
            const upstream = await fetchVideoStream(task.downloadUrl)
            const entryName = sanitizeFilename(task.fileName || `${fallbackPrefix}.mp4`)
            await appendToArchive(archive, Readable.fromWeb(upstream.body), entryName)
          } else if (task?.action === 'video-audio') {
            const extractor = new VideoAudioExtractor()
            const result = await extractor.extractMp3FromVideoUrl(task.downloadUrl, {
              baseName: sanitizeFilename(task.title || fallbackPrefix),
            })
            const entryName = sanitizeFilename(task.fileName || `${fallbackPrefix}.mp3`)
            await appendToArchive(archive, result.buffer, entryName)
          }
        } catch (error) {
          // 单首失败不影响其余曲目。
          failures.push(`${taskLabel}：${error.message || '未知错误'}`)
        }

        if (batchId) {
          updateBatchProgress(batchId, {
            completed: index + 1,
          })
        }
      }

      if (failures.length || trials.length || upgraded.length) {
        const lines = ['PopDownloader 批量下载说明', '']

        if (upgraded.length) {
          lines.push('【按账号权益取到全曲】以下 VIP 曲目已通过登录态获取完整音频：')
          lines.push(...upgraded.map((line) => `  - ${line}`))
          lines.push('')
        }

        if (trials.length) {
          lines.push('【仅试听片段】以下曲目上游只下发了试听音频，并非完整歌曲：')
          lines.push(...trials.map((line) => `  - ${line}`))
          lines.push('')
        }

        if (failures.length) {
          lines.push('【下载失败】以下曲目未能写入压缩包：')
          lines.push(...failures.map((line) => `  - ${line}`))
          lines.push('')
        }

        lines.push(`成功 ${tasks.length - failures.length} / ${tasks.length}`)
        await appendToArchive(archive, Buffer.from(lines.join('\n'), 'utf8'), '下载说明.txt')
      }

      await archive.finalize()
      if (batchId) {
        updateBatchProgress(batchId, {
          completed: tasks.length,
          status: 'completed',
          failedCount: failures.length,
          trialCount: trials.length,
          upgradedCount: upgraded.length,
        })
        setTimeout(() => {
          deleteBatchProgress(batchId)
        }, 5 * 60 * 1000)
      }
    } catch (error) {
      archive.destroy()

      if (clientAborted) {
        return
      }

      if (batchId) {
        updateBatchProgress(batchId, {
          status: 'failed',
          error: error.message,
        })
        setTimeout(() => {
          deleteBatchProgress(batchId)
        }, 5 * 60 * 1000)
      }

      if (!res.headersSent) {
        // 这里已经预设了 application/zip，报错时必须改回来，
        // 否则客户端会按压缩包去解析一段 JSON，排查时非常容易误判
        res.removeHeader('Content-Disposition')
        res.type('application/json')
        res.status(error.status || 500).json({
          message: 'failed',
          error: error.message,
        })
        return
      }

      res.destroy(error)
    }
  },
}
