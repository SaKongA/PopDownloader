function getApiErrorMessage(payload, fallbackMessage) {
  return (
    payload?.data?.description ||
    payload?.error ||
    payload?.message ||
    fallbackMessage
  )
}

async function parseApiResponse(response, fallbackMessage) {
  let payload = null

  try {
    payload = await response.json()
  } catch {
    throw new Error(fallbackMessage)
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, fallbackMessage))
  }

  if (payload?.message && payload.message !== 'success') {
    throw new Error(getApiErrorMessage(payload, fallbackMessage))
  }

  if (payload?.data?.error_code && payload.data.error_code !== 0) {
    throw new Error(getApiErrorMessage(payload, fallbackMessage))
  }

  return payload
}

export async function fetchLoginQrcode() {
  const response = await fetch('/api/auth/qrcode')
  return parseApiResponse(response, '获取登录二维码失败')
}

export async function fetchQrcodeStatus(token) {
  const response = await fetch('/api/auth/qrcode/status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })

  return parseApiResponse(response, '检查二维码状态失败')
}

export async function fetchUserProfile(session) {
  const response = await fetch('/api/auth/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(session),
  })

  return parseApiResponse(response, '获取个人信息失败')
}

export async function fetchOneClickLoginSupport() {
  const response = await fetch('/api/auth/one-click-support')
  let payload = null

  try {
    payload = await response.json()
  } catch {
    throw new Error('检测一键登录支持失败')
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || '检测一键登录支持失败')
  }

  return payload
}

export async function fetchFileLoginSupport({ fileName, fileContentBase64 }) {
  const response = await fetch('/api/auth/file-login-support', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_name: fileName,
      file_content_base64: fileContentBase64,
    }),
  })

  let payload = null

  try {
    payload = await response.json()
  } catch {
    throw new Error('解析 Cookies 文件失败')
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || '解析 Cookies 文件失败')
  }

  return payload
}
