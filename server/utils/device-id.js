const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * 设备号（iid）。
 *
 * iid 是上游用来区分客户端的标识。绝对不能把任何人的真实设备号写进代码：
 * 一是属于个人信息，二是多人共用同一个 iid 反而更容易触发风控。
 *
 * 这里的策略是「每台机器各自生成、本地持久化」：
 *   1. 优先使用环境变量 QISHUI_IID（便于排查问题时临时指定）
 *   2. 其次读取本地已保存的值
 *   3. 都没有就随机生成一个 14 位纯数字串并落盘
 *
 * 落盘位置放在用户目录下而不是项目目录，避免误提交进版本库。
 */
const STORE_DIR = path.join(os.homedir(), '.popdownloader')
const STORE_FILE = path.join(STORE_DIR, 'device-id')

// 上游 iid 均为纯数字串，长度在不同端上并不统一，这里放宽到 10~20 位
const IID_PATTERN = /^\d{10,20}$/
const IID_LENGTH = 14

let cachedIid = ''

function generateIid() {
  // 首位取 1~9，避免出现以 0 开头的数字串
  const digits = [String(crypto.randomInt(1, 10))]

  for (let index = 1; index < IID_LENGTH; index += 1) {
    digits.push(String(crypto.randomInt(0, 10)))
  }

  return digits.join('')
}

function readStoredIid() {
  try {
    const value = fs.readFileSync(STORE_FILE, 'utf8').trim()
    return IID_PATTERN.test(value) ? value : ''
  } catch {
    return ''
  }
}

function persistIid(iid) {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 })
    fs.writeFileSync(STORE_FILE, iid, { mode: 0o600 })
  } catch {
    // 落盘失败（只读文件系统等）不阻断启动，本次进程内继续使用内存里的随机值
  }
}

function resolveDeviceId() {
  if (cachedIid) {
    return cachedIid
  }

  const fromEnv = String(process.env.QISHUI_IID || '').trim()

  if (IID_PATTERN.test(fromEnv)) {
    cachedIid = fromEnv
    return cachedIid
  }

  const stored = readStoredIid()

  if (stored) {
    cachedIid = stored
    return cachedIid
  }

  const generated = generateIid()
  persistIid(generated)
  cachedIid = generated

  return cachedIid
}

module.exports = {
  resolveDeviceId,
  generateIid,
  STORE_FILE,
}
