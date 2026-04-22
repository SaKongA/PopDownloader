const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

class FlacMetadataWriter {
  async getModule() {
    const module = await import('flac-tagger')
    return module
  }

  createTempFilePath() {
    const fileName = `pop-downloader-${crypto.randomUUID()}.flac`
    return path.join(os.tmpdir(), fileName)
  }

  toTagValue(value) {
    if (Array.isArray(value)) {
      const list = value
        .map((item) => String(item || '').trim())
        .filter(Boolean)

      return list.length > 0 ? list : null
    }

    const normalized = String(value || '').trim()
    return normalized ? normalized : null
  }

  buildTagMap(metadata = {}) {
    const tagMap = {}

    const entries = {
      TITLE: metadata.title,
      ARTIST: metadata.artist,
      ALBUM: metadata.album,
      ALBUMARTIST: metadata.albumArtist,
      DATE: metadata.date,
      YEAR: metadata.year,
      GENRE: metadata.genre,
      COMPOSER: metadata.composer,
      LYRICIST: metadata.lyricist,
      COMMENT: metadata.comment,
      TRACKNUMBER: metadata.trackNumber,
      DISCNUMBER: metadata.discNumber,
    }

    for (const [key, value] of Object.entries(entries)) {
      const normalizedValue = this.toTagValue(value)

      if (normalizedValue) {
        tagMap[key] = normalizedValue
      }
    }

    return tagMap
  }

  async writeBufferTags({ flacBuffer, metadata = {}, coverBuffer = null, coverMime = null }) {
    if (!Buffer.isBuffer(flacBuffer) || flacBuffer.length === 0) {
      throw new Error('flacBuffer must be a non-empty Buffer.')
    }

    const { writeFlacTags } = await this.getModule()
    const filePath = this.createTempFilePath()

    try {
      await fs.writeFile(filePath, flacBuffer)

      const tagMap = this.buildTagMap(metadata)
      const tags = { tagMap }

      if (Buffer.isBuffer(coverBuffer) && coverBuffer.length > 0) {
        tags.picture = {
          buffer: coverBuffer,
          mime: coverMime || undefined,
        }
      }

      await writeFlacTags(tags, filePath)
      return await fs.readFile(filePath)
    } finally {
      await fs.rm(filePath, { force: true }).catch(() => {})
    }
  }

  async fetchCoverBuffer(imageUrl) {
    if (!imageUrl) {
      return null
    }

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch FLAC cover: ${response.status}`)
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mime: response.headers.get('content-type') || undefined,
    }
  }
}

module.exports = {
  FlacMetadataWriter,
}
