const { getSessionIdFromSodaMusicCookies, isWindowsPlatform } = require('../utils/sodamusic-cookie')

module.exports = {
  name: 'auth-one-click-support',
  method: 'get',
  path: '/api/auth/one-click-support',
  handler: async (_req, res) => {
    try {
      const result = getSessionIdFromSodaMusicCookies()

      res.json({
        supported: result.supported,
        is_windows: isWindowsPlatform(),
        cookie_db_path: result.cookieDbPath,
        sessionid: result.sessionid,
        message: result.reason || (result.supported ? '支持一键登录' : '当前环境不支持一键登录'),
      })
    } catch (error) {
      res.status(500).json({
        supported: false,
        is_windows: isWindowsPlatform(),
        sessionid: '',
        message: '检测一键登录支持失败',
        error: error.message,
      })
    }
  },
}
