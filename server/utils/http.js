function buildUrl(url, query = {}) {
  const target = new URL(url)

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      target.searchParams.set(key, value)
    }
  }

  return target.toString()
}

function getSessionIdFromSetCookie(headers) {
  const cookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')]
        : []

  for (const item of cookies) {
    const match = item.match(/sessionid=([^;]+)/)
    if (match) {
      return match[1]
    }
  }

  return ''
}

module.exports = {
  buildUrl,
  getSessionIdFromSetCookie,
}
