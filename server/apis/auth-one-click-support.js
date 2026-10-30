const {
  getSessionIdFromSodaMusicCookies,
  isWindowsPlatform,
  platformName,
} = require('../utils/sodamusic-cookie')
const { fixed } = require('../config/qishui-auth')

module.exports = {
  name: 'auth-one-click-support',
  method: 'get',
  path: '/api/auth/one-click-support',
  handler: async (_req, res) => {
    try {
      const result = getSessionIdFromSodaMusicCookies()

      res.json({
        supported: result.supported,
        aid: fixed.aid,
        is_windows: isWindowsPlatform(),
        platform: platformName(),
        cookie_db_path: result.cookieDbPath,
        sessionid: result.sessionid,
        message: result.reason || (result.supported ? '支持一键登录' : '当前环境不支持一键登录'),
      })
    } catch (error) {
      res.status(500).json({
        supported: false,
        aid: fixed.aid,
        is_windows: isWindowsPlatform(),
        platform: platformName(),
        sessionid: '',
        message: '检测一键登录支持失败',
        error: error.message,
      })
    }
  },
}
