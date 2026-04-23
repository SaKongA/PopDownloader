const fs = require('fs')
const os = require('os')
const path = require('path')
const Database = require('better-sqlite3')

const COOKIE_DB_PATH = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'SodaMusic',
  'Network',
  'Cookies',
)

function getCookieDbPath() {
  return COOKIE_DB_PATH
}

function isWindowsPlatform() {
  return process.platform === 'win32'
}

function readSessionIdFromCookieDatabase(databasePath) {
  let database = null

  try {
    database = new Database(databasePath, { readonly: true, fileMustExist: true })

    const row = database.prepare(`
      SELECT name, value, host_key
      FROM cookies
      WHERE host_key IN ('.qishui.com', 'qishui.com')
        AND name = 'sessionid'
      LIMIT 1
    `).get()

    const sessionid = String(row?.value || '').trim()

    return sessionid
  } catch (error) {
    throw error
  } finally {
    if (database) {
      database.close()
    }
  }
}

function getSessionIdFromSodaMusicCookies() {
  if (!isWindowsPlatform()) {
    return {
      supported: false,
      reason: '当前后端非Windows系统，无法使用一键登录',
      cookieDbPath: getCookieDbPath(),
      sessionid: '',
    }
  }

  const cookieDbPath = getCookieDbPath()

  if (!fs.existsSync(cookieDbPath)) {
    return {
      supported: false,
      reason: '请先安装PC端汽水音乐，并完成登录',
      cookieDbPath,
      sessionid: '',
    }
  }

  try {
    const sessionid = readSessionIdFromCookieDatabase(cookieDbPath)

    if (!sessionid) {
      return {
        supported: false,
        reason: '汽水音乐登录状态获取失败，请确保账号已正常登录',
        cookieDbPath,
        sessionid: '',
      }
    }

    return {
      supported: true,
      reason: '',
      cookieDbPath,
      sessionid,
    }
  } catch (error) {
    const message = String(error?.message || '')

    if (
      message.includes('EBUSY') ||
      message.includes('locked') ||
      message.includes('busy') ||
      message.includes('unable to open database file')
    ) {
      return {
        supported: false,
        reason: '汽水音乐正在运行中，请退出后再使用一键登录',
        cookieDbPath,
        sessionid: '',
      }
    }

    throw error
  }
}

module.exports = {
  getCookieDbPath,
  getSessionIdFromSodaMusicCookies,
  isWindowsPlatform,
  readSessionIdFromCookieDatabase,
}
