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

    archive.on('error', (error) => {
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
      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index]
        const fallbackPrefix = `${String(index + 1).padStart(3, '0')}-${sanitizeFilename(task?.title || 'file')}`

        if (task?.action === 'audio') {
          const result = await downloadTrackMedia({
            sessionid,
            track_id: task.trackId,
            quality: task.quality,
          })
          const entryName = sanitizeFilename(task.fileName || result.fileName || `${fallbackPrefix}.bin`)
          await appendToArchive(archive, result.buffer, entryName)
          if (batchId) {
            updateBatchProgress(batchId, {
              completed: index + 1,
            })
          }
          continue
        }

        if (task?.action === 'video') {
          const upstream = await fetchVideoStream(task.downloadUrl)
          const entryName = sanitizeFilename(task.fileName || `${fallbackPrefix}.mp4`)
          await appendToArchive(archive, Readable.fromWeb(upstream.body), entryName)
          if (batchId) {
            updateBatchProgress(batchId, {
              completed: index + 1,
            })
          }
          continue
        }

        if (task?.action === 'video-audio') {
          const extractor = new VideoAudioExtractor()
          const result = await extractor.extractMp3FromVideoUrl(task.downloadUrl, {
            baseName: sanitizeFilename(task.title || fallbackPrefix),
          })
          const entryName = sanitizeFilename(task.fileName || `${fallbackPrefix}.mp3`)
          await appendToArchive(archive, result.buffer, entryName)
          if (batchId) {
            updateBatchProgress(batchId, {
              completed: index + 1,
            })
          }
        }
      }

      await archive.finalize()
      if (batchId) {
        updateBatchProgress(batchId, {
          completed: tasks.length,
          status: 'completed',
        })
        setTimeout(() => {
          deleteBatchProgress(batchId)
        }, 5 * 60 * 1000)
      }
    } catch (error) {
      archive.destroy()

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
