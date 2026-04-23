const healthApi = require('./health')
const authQrcodeApi = require('./auth-qrcode')
const authQrcodeStatusApi = require('./auth-qrcode-status')
const authFileLoginSupportApi = require('./auth-file-login-support')
const authOneClickSupportApi = require('./auth-one-click-support')
const authProfileApi = require('./auth-profile')
const mePlaylistsApi = require('./me-playlists')
const meCollectionMixedApi = require('./me-collection-mixed')
const playlistDetailApi = require('./playlist-detail')
const playlistBatchDownloadApi = require('./playlist-batch-download')
const playlistBatchProgressApi = require('./playlist-batch-progress')
const shareResolveApi = require('./share-resolve')
const trackV2Api = require('./track-v2')
const trackDownloadEncryptedApi = require('./track-download-encrypted')
const videoV2Api = require('./video-v2')
const videoDownloadApi = require('./video-download')
const videoDownloadAudioApi = require('./video-download-audio')

module.exports = [
  healthApi,
  authQrcodeApi,
  authQrcodeStatusApi,
  authFileLoginSupportApi,
  authOneClickSupportApi,
  authProfileApi,
  mePlaylistsApi,
  meCollectionMixedApi,
  playlistDetailApi,
  playlistBatchDownloadApi,
  playlistBatchProgressApi,
  shareResolveApi,
  trackV2Api,
  trackDownloadEncryptedApi,
  videoV2Api,
  videoDownloadApi,
  videoDownloadAudioApi,
]
