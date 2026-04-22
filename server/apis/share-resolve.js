function extractFirstUrl(input) {
  if (typeof input !== 'string') {
    return ''
  }

  const match = input.match(/https?:\/\/[^\s]+/i)
  return match ? match[0].trim() : ''
}

function normalizeShareUrl(input) {
  const rawUrl = extractFirstUrl(input) || String(input || '').trim()

  if (!rawUrl) {
    return ''
  }

  try {
    const url = new URL(rawUrl)
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function getIdFromUrl(url, key) {
  if (!url) {
    return ''
  }

  try {
    const target = new URL(url)
    return target.searchParams.get(key) || ''
  } catch {
    return ''
  }
}

function matchFirst(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return ''
}

function resolveTrackId(html, finalUrl) {
  return (
    getIdFromUrl(finalUrl, 'track_id') ||
    matchFirst(html, [
      /"track_id":"?(\d+)"/i,
      /"track_id":(\d+)/i,
      /\btrack_id=(\d+)/i,
      /\/qishui\/song\/(\d+)/i,
      /"trackId":"?(\d+)"/i,
    ])
  )
}

function resolveVideoId(html, finalUrl) {
  return (
    getIdFromUrl(finalUrl, 'video_id') ||
    getIdFromUrl(finalUrl, 'item_id') ||
    getIdFromUrl(finalUrl, 'aweme_id') ||
    matchFirst(html, [
      /"video_id":"?(\d+)"/i,
      /"video_id":(\d+)/i,
      /"videoId":"?(\d+)"/i,
      /"aweme_id":"?(\d+)"/i,
      /\/video\/(\d+)/i,
    ])
  )
}

module.exports = {
  name: 'share-resolve',
  method: 'post',
  path: '/api/share/resolve',
  handler: async (req, res) => {
    const shareText = req.body?.share_text || req.body?.url || ''
    const shareUrl = normalizeShareUrl(shareText)

    if (!shareUrl) {
      res.status(400).json({
        message: '分享链接格式无效，请粘贴完整链接。',
      })
      return
    }

    try {
      const upstream = await fetch(shareUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          referer: 'https://qishui.douyin.com/',
        },
      })

      const html = await upstream.text()
      const finalUrl = upstream.url || shareUrl
      const trackId = resolveTrackId(html, finalUrl)
      const videoId = resolveVideoId(html, finalUrl)

      if (!trackId && !videoId) {
        res.status(422).json({
          message: '未能从分享页中解析出 track_id 或 video_id。',
          final_url: finalUrl,
        })
        return
      }

      res.json({
        share_url: shareUrl,
        final_url: finalUrl,
        resource_type: trackId ? 'track' : 'video',
        track_id: trackId,
        video_id: videoId,
      })
    } catch (error) {
      res.status(500).json({
        message: '解析分享链接失败',
        error: error.message,
      })
    }
  },
}
