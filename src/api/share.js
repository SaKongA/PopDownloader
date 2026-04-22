async function parseApiResponse(response, fallbackMessage) {
  let payload = null

  try {
    payload = await response.json()
  } catch {
    throw new Error(fallbackMessage)
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || fallbackMessage)
  }

  return payload
}

export async function resolveShareResource(shareText) {
  if (!shareText || !String(shareText).trim()) {
    throw new Error('请输入分享链接。')
  }

  const response = await fetch('/api/share/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      share_text: shareText,
    }),
  })

  return parseApiResponse(response, '解析分享链接失败')
}
