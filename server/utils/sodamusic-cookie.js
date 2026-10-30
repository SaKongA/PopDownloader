const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

// 延迟加载：better-sqlite3 是原生模块，需要 node-gyp 编译。
// 这里仅作为兜底方案，优先使用系统自带 sqlite3 命令行，
// 避免 macOS/Linux 上因缺少编译工具链导致整个服务启动失败。
function loadDatabase() {
  try {
    return require('better-sqlite3')
  } catch (error) {
    throw new Error(
      `better-sqlite3 原生模块不可用（仅作兜底方案）：${error.message}`,
    )
  }
}

const WINDOWS_COOKIE_DB = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'SodaMusic',
  'Network',
  'Cookies',
)

// macOS 版汽水音乐是 Electron 应用，cookie 库在容器根目录，不在 Network/ 下
const MAC_COOKIE_DB = path.join(
  os.homedir(),
  'Library',
  'Containers',
  'com.soda.music',
  'Data',
  'Library',
  'Application Support',
  'SodaMusic',
  'Cookies',
)

const SESSION_SQL =
  "SELECT value FROM cookies WHERE host_key IN ('.qishui.com','qishui.com') AND name='sessionid' LIMIT 1;"

function getCookieDbPath() {
  if (process.platform === 'darwin') {
    return MAC_COOKIE_DB
  }

  return WINDOWS_COOKIE_DB
}

function isWindowsPlatform() {
  return process.platform === 'win32'
}

function isSupportedPlatform() {
  return process.platform === 'win32' || process.platform === 'darwin'
}

function platformName() {
  if (process.platform === 'darwin') {
    return 'macOS'
  }

  if (process.platform === 'win32') {
    return 'Windows'
  }

  return process.platform
}

/**
 * 用系统 sqlite3 命令行读取。macOS 自带，Windows 若装了 sqlite3 也可用。
 * 不存在 sqlite3 时抛 ENOENT，由上层回退到 better-sqlite3。
 */
function readValueWithCli(databasePath, sql) {
  const output = execFileSync('sqlite3', ['-readonly', databasePath, sql], {
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return String(output || '').trim()
}

function readSessionIdFromCookieDatabase(databasePath) {
  if (!fs.existsSync(databasePath)) {
    throw new Error(`cookie 数据库不存在：${databasePath}`)
  }

  const errors = []

  // 策略 1：直接读。Electron 默认 WAL 模式，通常允许并发只读。
  try {
    const value = readValueWithCli(databasePath, SESSION_SQL)
    if (value) {
      return value
    }
  } catch (error) {
    errors.push(error)
  }

  // 策略 2：复制副本再读，绕开应用独占锁
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'popd-cookie-'))
    const tmpDb = path.join(tmpDir, 'Cookies')

    try {
      fs.copyFileSync(databasePath, tmpDb)

      // WAL 模式下部分数据在 -wal 文件里，一并复制
      for (const suffix of ['-wal', '-shm']) {
        if (fs.existsSync(databasePath + suffix)) {
          try {
            fs.copyFileSync(databasePath + suffix, tmpDb + suffix)
          } catch {
            /* 忽略副本复制失败 */
          }
        }
      }

      const value = readValueWithCli(tmpDb, SESSION_SQL)
      if (value) {
        return value
      }
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        /* 清理失败不影响结果 */
      }
    }
  } catch (error) {
    errors.push(error)
  }

  // 策略 3：回退 better-sqlite3（Windows 常见，macOS 通常没编译）
  try {
    const Database = loadDatabase()
    const database = new Database(databasePath, { readonly: true, fileMustExist: true })

    try {
      const row = database.prepare(SESSION_SQL).get()
      return String(row?.value || '').trim()
    } finally {
      database.close()
    }
  } catch (error) {
    errors.push(error)
  }

  const first = errors[0]
  if (first) {
    throw first
  }

  return ''
}

function getSessionIdFromSodaMusicCookies() {
  if (!isSupportedPlatform()) {
    return {
      supported: false,
      reason: `当前后端运行在 ${platformName()}，暂不支持一键登录`,
      cookieDbPath: getCookieDbPath(),
      sessionid: '',
    }
  }

  const cookieDbPath = getCookieDbPath()

  if (!fs.existsSync(cookieDbPath)) {
    return {
      supported: false,
      reason: `未找到汽水音乐 ${platformName()} 客户端数据，请先安装并完成登录`,
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
      message.includes('unable to open database file') ||
      message.includes('database is locked')
    ) {
      return {
        supported: false,
        reason: '汽水音乐正在运行中并锁定 cookie 库，请退出应用后重试',
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
  isSupportedPlatform,
  platformName,
  readSessionIdFromCookieDatabase,
}
