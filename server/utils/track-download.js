const { endpoints, fixed } = require('../config/qishui-auth')
const { buildUrl } = require('./http')
const { TrackDecryptor } = require('./track-decryptor')
const { FlacMetadataWriter } = require('./flac-metadata')

function getArtistName(trackPayload) {
  const artists = Array.isArray(trackPayload?.track?.artists) ? trackPayload.track.artists : []
  const firstArtist = artists[0]

  return (
    firstArtist?.simple_display_name ||
    firstArtist?.user_info?.nickname ||
    firstArtist?.name ||
    ''
  )
}

function getArtistNames(trackPayload) {
  const artists = Array.isArray(trackPayload?.track?.artists) ? trackPayload.track.artists : []

  return artists
    .map((artist) => (
      artist?.simple_display_name ||
      artist?.user_info?.nickname ||
      artist?.name ||
      ''
    ))
    .filter(Boolean)
}

function getNames(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list
    .map((item) => item?.name || '')
    .filter(Boolean)
}

function getReleaseDate(trackPayload) {
  const releaseTimestamp = trackPayload?.track?.album?.release_date

  if (typeof releaseTimestamp !== 'number' || Number.isNaN(releaseTimestamp) || releaseTimestamp <= 0) {
    return ''
  }

  return new Date(releaseTimestamp * 1000).toISOString().slice(0, 10)
}

function getGenreNames(trackPayload) {
  const tags = Array.isArray(trackPayload?.track?.tags) ? trackPayload.track.tags : []
  const genreNames = []

  for (const tag of tags) {
    const secondLevel = tag?.second_level_tag?.tag_name
    const firstLevel = tag?.first_level_tag?.tag_name

    if (secondLevel) {
      genreNames.push(secondLevel)
      continue
    }

    if (firstLevel) {
      genreNames.push(firstLevel)
    }
  }

  return [...new Set(genreNames)]
}

function getFirstImageUrl(imageLike) {
  if (!imageLike || !Array.isArray(imageLike.urls) || imageLike.urls.length === 0) {
    return ''
  }

  return imageLike.urls[0]
}

function resolveImageUrl(imageLike) {
  if (!imageLike) {
    return ''
  }

  const firstUrl = getFirstImageUrl(imageLike)
  const uri = imageLike.uri || ''
  const templatePrefix = imageLike.template_prefix || ''

  if (!firstUrl || !uri) {
    return firstUrl
  }

  const templateSuffix = templatePrefix
    ? `~${templatePrefix}-crop-center:800:800.jpg`
    : ''

  if (!firstUrl.includes(uri)) {
    return `${firstUrl}${uri}${templateSuffix}`
  }

  return `${firstUrl}${templateSuffix}`
}

function buildFlacMetadata(trackPayload) {
  const artists = getArtistNames(trackPayload)
  const composers = getNames(trackPayload?.track?.song_maker_team?.composers)
  const lyricists = getNames(trackPayload?.track?.song_maker_team?.lyricists)
  const genres = getGenreNames(trackPayload)
  const releaseDate = getReleaseDate(trackPayload)

  return {
    title: trackPayload?.track?.name || '',
    artist: artists,
    album: trackPayload?.track?.album?.name || '',
    albumArtist: artists,
    date: releaseDate,
    year: releaseDate ? releaseDate.slice(0, 4) : '',
    genre: genres,
    composer: composers,
    lyricist: lyricists,
  }
}

function getTrackV2Payload(reqBody) {
  const {
    aid = fixed.aid,
    sessionid,
    track_id,
  } = reqBody || {}

  return {
    aid,
    sessionid,
    track_id,
    media_type: 'track',
    queue_type: 'search_one_track',
    scene_name: 'search',
  }
}

async function fetchTrackPayload({ aid = fixed.aid, sessionid, track_id }) {
  const trackV2Url = buildUrl(endpoints.trackV2, { aid })
  const trackV2Response = await fetch(trackV2Url, {
    method: 'POST',
    headers: {
      Cookie: `sessionid=${sessionid};`,
      'Content-Type': 'application/json; charset=utf-8',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify({
      track_id,
      media_type: 'track',
      queue_type: 'search_one_track',
      scene_name: 'search',
    }),
  })

  const trackPayload = await trackV2Response.json()

  if (!trackV2Response.ok) {
    const error = new Error(trackPayload?.error || trackPayload?.message || '获取音频信息失败')
    error.status = trackV2Response.status
    error.payload = trackPayload
    throw error
  }

  return trackPayload
}

async function downloadTrackMedia({ sessionid, track_id, quality, aid = fixed.aid }) {
  const flacMetadataWriter = new FlacMetadataWriter()
  const trackPayload = await fetchTrackPayload({ aid, sessionid, track_id })
  const videoModelRaw = trackPayload?.track_player?.video_model

  if (!videoModelRaw) {
    const error = new Error('track video_model not found')
    error.status = 404
    throw error
  }

  let videoModel = null

  try {
    videoModel = JSON.parse(videoModelRaw)
  } catch {
    const error = new Error('track video_model parse failed')
    error.status = 500
    throw error
  }

  const videoList = Array.isArray(videoModel?.video_list) ? videoModel.video_list : []
  const matchedItem = videoList.find((item) => item?.video_meta?.quality === quality)

  if (!matchedItem?.main_url) {
    const error = new Error(`quality ${quality} download url not found`)
    error.status = 404
    throw error
  }

  const mediaResponse = await fetch(matchedItem.main_url, {
    headers: {
      'User-Agent': 'libcurl-agent/1.0',
    },
    redirect: 'follow',
  })

  if (!mediaResponse.ok) {
    const errorText = await mediaResponse.text().catch(() => '')
    const error = new Error(errorText || `upstream status ${mediaResponse.status}`)
    error.status = mediaResponse.status
    throw error
  }

  const encryptedBuffer = Buffer.from(await mediaResponse.arrayBuffer())
  const decryptor = new TrackDecryptor()
  const result = decryptor.decrypt({
    encryptedBuffer,
    spadeA: matchedItem?.encrypt_info?.spade_a || '',
    media: {
      title: trackPayload?.track?.name || '',
      artist: getArtistName(trackPayload),
    },
  })

  let outputBuffer = result.buffer

  if (result.extension === '.flac') {
    const metadata = buildFlacMetadata(trackPayload)
    const coverUrl = resolveImageUrl(trackPayload?.track?.album?.url_cover)
    let coverData = null

    if (coverUrl) {
      try {
        coverData = await flacMetadataWriter.fetchCoverBuffer(coverUrl)
      } catch {
        coverData = null
      }
    }

    outputBuffer = await flacMetadataWriter.writeBufferTags({
      flacBuffer: result.buffer,
      metadata,
      coverBuffer: coverData?.buffer || null,
      coverMime: coverData?.mime || null,
    })
  }

  return {
    buffer: outputBuffer,
    fileName: result.fileName,
    contentType: result.extension === '.flac' ? 'audio/flac' : 'audio/mp4',
    trackPayload,
  }
}

module.exports = {
  getTrackV2Payload,
  downloadTrackMedia,
}
