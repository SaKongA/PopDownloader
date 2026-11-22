const { fetchWithRetry } = require('./http')

// 免签名的 SEO 曲目数据源。

const SEO_ENDPOINT = 'https://beta-luna.douyin.com/luna/h5/seo_track'
const WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function createError(message, { status = 502, code = 'seo_fallback_failed' } = {}) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

function parseVideoModel(raw) {
  if (!raw) {
    return null
  }

  if (typeof raw === 'object') {
    return raw
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function buildSeoUrl(trackId) {
  const target = new URL(SEO_ENDPOINT)
  target.searchParams.set('track_id', String(trackId))
  target.searchParams.set('device_platform', 'web')
  return target.toString()
}

// 请求 SEO 接口并输出 track_v2 同构 payload 与播放元信息。
async function fetchSeoTrackPayload({ track_id }) {
  if (!track_id) {
    throw createError('缺少 track_id，无法使用 SEO 回退。', { status: 400 })
  }

  let response
  try {
    response = await fetchWithRetry(buildSeoUrl(track_id), {
      method: 'GET',
      headers: {
        'User-Agent': WEB_UA,
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://beta-luna.douyin.com/',
      },
    }, { retries: 2, delayMs: 300 })
  } catch (error) {
    throw createError(`SEO 回退接口请求失败：${error.message}`)
  }

  const rawText = await response.text()

  if (!rawText.trim()) {
    throw createError('SEO 回退接口返回空响应。')
  }

  let payload
  try {
    payload = JSON.parse(rawText)
  } catch {
    throw createError('SEO 回退接口返回了无法解析的内容。', { code: 'seo_invalid_json' })
  }

  // 成功响应不含 status_code。
  if (payload?.status_code != null && payload.status_code !== 0) {
    const rawMessage = payload?.status_info?.status_msg || ''
    const friendly = /SEO|歌曲|track/i.test(rawMessage)
      ? rawMessage
      : `该歌曲无 SEO 页面数据（${rawMessage || `status_code ${payload.status_code}`}）`

    throw createError(friendly, { status: 404, code: 'seo_track_not_found' })
  }

  const track = payload?.seo_track?.track
  const trackPlayer = payload?.track_player
  const videoModel = parseVideoModel(trackPlayer?.video_model)

  if (!track?.id || !Array.isArray(videoModel?.video_list) || videoModel.video_list.length === 0) {
    throw createError('SEO 回退接口未下发可用的音频地址。', { status: 404, code: 'seo_no_playable_media' })
  }

  const fullDurationMs = Number(track?.duration) || 0
  const playableMs = Math.round((Number(videoModel?.video_duration) || 0) * 1000)
  // 按元数据时长判定试听片段，容差 10%。
  const isTrial = fullDurationMs > 0 && playableMs > 0 && playableMs < fullDurationMs * 0.9

  return {
    track,
    track_player: trackPlayer,
    __playback: {
      source: 'seo_track',
      isTrial,
      fullDurationMs,
      playableMs,
    },
  }
}

module.exports = {
  SEO_ENDPOINT,
  fetchSeoTrackPayload,
}
