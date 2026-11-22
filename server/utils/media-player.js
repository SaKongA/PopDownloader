const { getPcQuery, fixed } = require('../config/qishui-auth')
const { buildUrl, fetchWithRetry } = require('./http')
const { fetchSeoTrackPayload } = require('./seo-track')

// 按账号权益向官方播放接口请求完整音频。

const MEDIA_PLAYER_ENDPOINT = 'https://api.qishui.com/luna/media-player'
const WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

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

function createError(message, { status = 502, code = 'media_player_failed' } = {}) {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

// 请求 media-player 并选取时长最长的播放信息。
async function fetchMediaPlayerInfo({ track_id, sessionid, aid = fixed.aid }) {
  if (!track_id) {
    throw createError('缺少 track_id。', { status: 400 })
  }

  if (!sessionid) {
    throw createError('缺少登录态，无法按账号权益获取完整音频。', {
      status: 401,
      code: 'media_player_requires_login',
    })
  }

  const target = buildUrl(MEDIA_PLAYER_ENDPOINT, {
    ...getPcQuery({ aid }),
    // 该参数须为 web。
    device_platform: 'web',
    media_type: 'track',
    media_id: track_id,
    queue_type: 'search_one_track',
  })

  let response
  try {
    response = await fetchWithRetry(target, {
      method: 'GET',
      headers: {
        Cookie: `sessionid=${sessionid};`,
        'User-Agent': WEB_UA,
        Accept: 'application/json, text/plain, */*',
      },
    }, { retries: 2, delayMs: 300 })
  } catch (error) {
    throw createError(`media-player 请求失败：${error.message}`)
  }

  const rawText = await response.text()
  if (!rawText.trim()) {
    throw createError('media-player 返回空响应。')
  }

  let payload
  try {
    payload = JSON.parse(rawText)
  } catch {
    throw createError('media-player 返回了无法解析的内容。', { code: 'media_player_invalid_json' })
  }

  if (payload?.status_code != null && payload.status_code !== 0) {
    throw createError(
      `media-player 业务错误：${payload?.status_info?.status_msg || `status_code ${payload.status_code}`}`,
      { status: 404, code: 'media_player_business_error' },
    )
  }

  const infos = Array.isArray(payload?.player_infos)
    ? payload.player_infos
    : payload?.player_info
      ? [payload.player_info]
      : []

  let best = null
  for (const info of infos) {
    const vm = parseVideoModel(info?.video_model)
    if (!Array.isArray(vm?.video_list) || vm.video_list.length === 0) {
      continue
    }
    if (!best || (Number(vm.video_duration) || 0) > (Number(best.videoModel.video_duration) || 0)) {
      best = { playerInfo: info, videoModel: vm }
    }
  }

  if (!best) {
    throw createError('media-player 未下发可用的音频地址。', {
      status: 404,
      code: 'media_player_no_playable_media',
    })
  }

  return best
}

// 回退解析入口：SEO 取元数据，试听时按登录态升级为全曲。
async function resolveFallbackPayload({ track_id, sessionid, aid = fixed.aid }) {
  const seoPayload = await fetchSeoTrackPayload({ track_id })
  const seoPlayback = seoPayload.__playback || {}

  if (!seoPlayback.isTrial) {
    return seoPayload
  }

  if (!sessionid) {
    return {
      ...seoPayload,
      __playback: {
        ...seoPlayback,
        upgradeError: '未提供登录态，无法尝试按账号权益获取完整音频',
      },
    }
  }

  try {
    const { playerInfo, videoModel } = await fetchMediaPlayerInfo({ track_id, sessionid, aid })
    const playableMs = Math.round((Number(videoModel.video_duration) || 0) * 1000)
    const fullDurationMs = Number(seoPlayback.fullDurationMs) || 0
    const isFull = playableMs > 0 && (fullDurationMs === 0 || playableMs >= fullDurationMs * 0.9)

    if (!isFull) {
      // 权益不足时保留 SEO 结果。
      return {
        ...seoPayload,
        __playback: {
          ...seoPlayback,
          upgradeError: '账号权益不足，上游仍只下发试听片段',
        },
      }
    }

    const trackPlayer = {
      ...playerInfo,
      // 统一 video_model 为字符串。
      video_model: typeof playerInfo.video_model === 'string'
        ? playerInfo.video_model
        : JSON.stringify(videoModel),
    }

    return {
      ...seoPayload,
      track_player: trackPlayer,
      __playback: {
        source: 'media_player',
        isTrial: false,
        fullDurationMs,
        playableMs,
      },
    }
  } catch (error) {
    return {
      ...seoPayload,
      __playback: {
        ...seoPlayback,
        upgradeError: error.message,
      },
    }
  }
}

module.exports = {
  MEDIA_PLAYER_ENDPOINT,
  fetchMediaPlayerInfo,
  resolveFallbackPayload,
}
