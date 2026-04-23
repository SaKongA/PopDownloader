const fs = require('fs')
const os = require('os')
const path = require('path')
const { readSessionIdFromCookieDatabase } = require('../utils/sodamusic-cookie')

module.exports = {
  name: 'auth-file-login-support',
  method: 'post',
  path: '/api/auth/file-login-support',
  handler: async (req, res) => {
    const fileName = String(req.body?.file_name || '').trim()
    const fileContentBase64 = String(req.body?.file_content_base64 || '').trim()

    if (!fileContentBase64) {
      res.status(400).json({
        supported: false,
        sessionid: '',
        message: '请先选择 Cookies 文件',
      })
      return
    }

    const tempPath = path.join(
      os.tmpdir(),
      `sodamusic-upload-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
    )

    try {
      const buffer = Buffer.from(fileContentBase64, 'base64')
      fs.writeFileSync(tempPath, buffer)

      const sessionid = readSessionIdFromCookieDatabase(tempPath)

      if (!sessionid) {
        res.json({
          supported: false,
          sessionid: '',
          file_name: fileName,
          message: '汽水音乐登录状态获取失败，请确保账号已正常登录',
        })
        return
      }

      res.json({
        supported: true,
        sessionid,
        file_name: fileName,
        message: 'Cookies 文件解析成功',
      })
    } catch (error) {
      res.status(500).json({
        supported: false,
        sessionid: '',
        file_name: fileName,
        message: 'Cookies 文件解析失败',
        error: error.message,
      })
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { force: true })
      }
    }
  },
}
