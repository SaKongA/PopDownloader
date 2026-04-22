const baseUrl = 'https://api.qishui.com'

const fixed = {
  aid: '386088',
  passport_jssdk_version: '2.4.13',
  passport_jssdk_type: 'normal',
  is_from_ttaccountsdk: '1',
  next: 'https://api.qishui.com',
  need_logo: 'false',
  need_short_url: 'false',
  is_frontier: 'true',
  is_new_login: '1',
  region: 'cn',
  geo_region: 'cn',
  os_region: 'cn',
  sim_region: '',
  iid: '27960026095955',
  version_code: '30020100',
}

module.exports = {
  baseUrl,
  fixed,
  endpoints: {
    getQrcode: `${baseUrl}/passport/web/get_qrcode/`,
    checkQrConnect: `${baseUrl}/passport/web/check_qrconnect/`,
    me: `${baseUrl}/luna/pc/me`,
    mePlaylists: `${baseUrl}/luna/pc/me/playlist`,
    meCollectionMixed: `${baseUrl}/luna/pc/me/collection/mixed`,
    playlistDetail: `${baseUrl}/luna/pc/playlist/detail`,
    trackV2: `${baseUrl}/luna/pc/track_v2`,
    videoV2: `${baseUrl}/luna/pc/video_v2`,
  },
}
