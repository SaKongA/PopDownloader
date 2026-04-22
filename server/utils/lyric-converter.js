function formatLrcTimestamp(startMs) {
  const totalSeconds = Math.floor(startMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((startMs % 1000) / 10)

  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}]`
}

function krcToLrc(krcContent, title = '', artist = '') {
  if (!krcContent || typeof krcContent !== 'string') {
    return ''
  }

  const lines = []

  if (title || artist) {
    const header = [title, artist].filter(Boolean).join(' - ')
    if (header) {
      lines.push(`[00:00.00]${header}`)
    }
  }

  const lineRegex = /\[(\d+),\d+\](.*)/g
  let lineMatch = lineRegex.exec(krcContent)

  while (lineMatch) {
    const startMs = Number(lineMatch[1] || 0)
    const wordsPart = lineMatch[2] || ''
    const wordRegex = /<\d+,\d+,\d+>([^<]+)/g
    const fragments = []
    let wordMatch = wordRegex.exec(wordsPart)

    while (wordMatch) {
      fragments.push(wordMatch[1])
      wordMatch = wordRegex.exec(wordsPart)
    }

    const lineText = fragments.join('')
    lines.push(`${formatLrcTimestamp(startMs)}${lineText}`)
    lineMatch = lineRegex.exec(krcContent)
  }

  return lines.join('\n')
}

module.exports = {
  krcToLrc,
}
