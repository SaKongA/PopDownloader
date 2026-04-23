<script setup>
import { computed, ref, watch } from 'vue'
import {
  NAvatar,
  NButton,
  NCountdown,
  NInput,
  NModal,
  NRadioButton,
  NRadioGroup,
  NResult,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NText,
  createDiscreteApi,
} from 'naive-ui'
import {
  fetchLoginQrcode,
  fetchOneClickLoginSupport,
  fetchQrcodeStatus,
  fetchUserProfile,
} from '../api/auth'
import { setStoredProfile, setStoredSession } from '../utils/authStorage'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:show', 'success'])

const DEFAULT_AID = '386088'
const QR_POLL_INTERVAL = 2500
const platformAidMap = {
  android: '234123',
  pc: '386088',
}

const { message } = createDiscreteApi(['message'])

const loginMode = ref('one-click')
const loginStep = ref('idle')
const loginHint = ref('')
const qrcodeImage = ref('')
const qrToken = ref('')
const qrExpireAt = ref(0)
const scannedAvatar = ref('')
const manualPlatform = ref('pc')
const manualAid = ref(platformAidMap.pc)
const manualSessionId = ref('')
const oneClickStep = ref('idle')
const oneClickHint = ref('')
const oneClickSessionId = ref('')
const oneClickProfile = ref(null)

let pollingRound = 0

const modalClosable = computed(() => loginStep.value !== 'profile-loading')

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getFirstImageUrl(imageLike) {
  if (!imageLike || !Array.isArray(imageLike.urls) || imageLike.urls.length === 0) {
    return ''
  }

  return imageLike.urls[0]
}

function normalizeUserProfile(payload) {
  const myInfo = payload?.my_info

  if (!myInfo?.id || !myInfo?.nickname) {
    throw new Error('个人信息返回结构不符合预期。')
  }

  return {
    id: myInfo.id,
    nickname: myInfo.nickname,
    douyinId: myInfo.douyin_id || '',
    avatar: getFirstImageUrl(myInfo.medium_avatar_url),
    isVip: Boolean(myInfo.is_vip),
    vipStage: myInfo.vip_stage || '',
  }
}

function resetLoginState() {
  loginMode.value = 'one-click'
  loginStep.value = 'idle'
  loginHint.value = ''
  qrcodeImage.value = ''
  qrToken.value = ''
  qrExpireAt.value = 0
  scannedAvatar.value = ''
  manualPlatform.value = 'pc'
  manualAid.value = platformAidMap.pc
  manualSessionId.value = ''
  oneClickStep.value = 'idle'
  oneClickHint.value = ''
  oneClickSessionId.value = ''
  oneClickProfile.value = null
}

function closeModal() {
  if (!modalClosable.value) {
    return
  }

  pollingRound++
  emit('update:show', false)
  resetLoginState()
}

function handleManualPlatformChange(value) {
  manualPlatform.value = value

  if (value === 'custom') {
    manualAid.value = ''
    return
  }

  manualAid.value = platformAidMap[value] || ''
}

async function finishLogin(session) {
  const payload = await fetchUserProfile(session)
  const profile = normalizeUserProfile(payload)

  setStoredSession(session)
  setStoredProfile(profile)

  emit('success', {
    session,
    profile,
  })

  emit('update:show', false)
  resetLoginState()
}

async function openQrcodeLogin() {
  pollingRound++
  resetLoginState()
  loginStep.value = 'loading'
  loginHint.value = '正在获取登录二维码...'

  try {
    const payload = await fetchLoginQrcode()

    qrToken.value = payload?.data?.token || ''
    qrcodeImage.value = payload?.data?.qrcode || ''
    qrExpireAt.value = (payload?.data?.expire_time || 0) * 1000

    if (!qrToken.value || !qrcodeImage.value) {
      throw new Error('二维码数据不完整，请重新获取。')
    }

    loginStep.value = 'qrcode'
    loginHint.value = '打开【汽水音乐 APP】右上角搜索，点击搜索框右侧扫一扫'
    startPolling()
  } catch (error) {
    loginStep.value = 'error'
    loginHint.value = error?.message || '登录二维码获取失败，请稍后重试。'
    message.error(loginHint.value)
  }
}

async function detectOneClickLogin() {
  oneClickStep.value = 'loading'
  oneClickHint.value = '正在检测本地 SodaMusic 登录态...'
  oneClickSessionId.value = ''
  oneClickProfile.value = null

  try {
    const supportPayload = await fetchOneClickLoginSupport()

    if (!supportPayload?.supported) {
      oneClickStep.value = 'unsupported'
      oneClickHint.value = supportPayload?.message || '当前环境不支持一键登录。'
      return
    }

    const sessionid = String(supportPayload?.sessionid || '').trim()

    if (!sessionid) {
      oneClickStep.value = 'unsupported'
      oneClickHint.value = '检测到支持一键登录，但未读取到 sessionid。'
      return
    }

    oneClickSessionId.value = sessionid
    oneClickHint.value = '已检测到本地登录态，正在获取用户信息...'

    const session = {
      aid: platformAidMap.pc,
      sessionid,
    }

    const profilePayload = await fetchUserProfile(session)
    oneClickProfile.value = normalizeUserProfile(profilePayload)
    oneClickStep.value = 'ready'
    oneClickHint.value = '已检测到汽水音乐PC端已登录，可直接一键登录'
  } catch (error) {
    oneClickStep.value = 'unsupported'
    oneClickHint.value = error?.message || '检测一键登录支持失败。'
  }
}

async function submitOneClickLogin() {
  if (!oneClickSessionId.value) {
    message.error('当前没有可用的 sessionid。')
    return
  }

  loginStep.value = 'profile-loading'
  loginHint.value = '正在完成一键登录，请稍候...'

  try {
    await finishLogin({
      aid: platformAidMap.pc,
      sessionid: oneClickSessionId.value,
    })
  } catch (error) {
    loginStep.value = 'error'
    loginHint.value = error?.message || '一键登录失败，请改用二维码登录。'
    message.error(loginHint.value)
  }
}

async function submitManualLogin() {
  const aid = manualAid.value.trim()
  const sessionid = manualSessionId.value.trim()

  if (!aid || !sessionid) {
    message.error('请输入 aid 和 sessionid。')
    return
  }

  pollingRound++
  loginStep.value = 'profile-loading'
  loginHint.value = '正在获取个人用户信息，请稍候...'

  try {
    await finishLogin({ aid, sessionid })
  } catch (error) {
    loginStep.value = 'error'
    loginHint.value = error?.message || '个人信息获取失败，请重新登录。'
    message.error(loginHint.value)
  }
}

async function startPolling() {
  const currentRound = ++pollingRound

  while (
    currentRound === pollingRound &&
    props.show &&
    qrToken.value &&
    loginStep.value !== 'profile-loading'
  ) {
    const startedAt = Date.now()

    try {
      const payload = await fetchQrcodeStatus(qrToken.value)

      if (currentRound !== pollingRound || !props.show) {
        return
      }

      const status = payload?.data?.status

      if (status === 'scanned') {
        loginStep.value = 'scanned'
        scannedAvatar.value = payload?.data?.scan_user_info?.avatar_url || ''
        loginHint.value = '需在手机上进行确认'
      }

      if (status === 'confirmed') {
        pollingRound++

        const session = {
          aid: payload?.auth?.aid || DEFAULT_AID,
          sessionid: payload?.auth?.sessionid || '',
        }

        if (!session.sessionid) {
          loginStep.value = 'error'
          loginHint.value = '登录已确认，但未获取到 sessionid。请重新登录。'
          message.error(loginHint.value)
          return
        }

        loginStep.value = 'profile-loading'
        loginHint.value = '正在获取个人用户信息，请稍候...'
        await finishLogin(session)
        return
      }
    } catch (error) {
      if (currentRound !== pollingRound) {
        return
      }

      loginStep.value = 'error'
      loginHint.value = error?.message || '检查二维码状态失败，请重新获取二维码。'
      message.error(loginHint.value)
      return
    }

    if (qrExpireAt.value && Date.now() >= qrExpireAt.value) {
      loginStep.value = 'expired'
      loginHint.value = '二维码已过期，请重新获取。'
      message.warning(loginHint.value)
      return
    }

    const elapsed = Date.now() - startedAt
    await sleep(Math.max(0, QR_POLL_INTERVAL - elapsed))
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      openQrcodeLogin()
      detectOneClickLogin()
      return
    }

    pollingRound++
    resetLoginState()
  },
)
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="modalClosable"
    :close-on-esc="modalClosable"
    :closable="modalClosable"
    preset="card"
    title="账号登录"
    style="width: 420px;"
    @update:show="(value) => { if (!value) closeModal() }"
  >
    <n-tabs v-model:value="loginMode" type="line" animated>
      <n-tab-pane name="one-click" tab="一键登录">
        <n-space vertical align="center" justify="center" size="large">
          <n-spin v-if="oneClickStep === 'loading'" size="large">
            <div style="height: 160px; width: 160px;"></div>
          </n-spin>

          <template v-else-if="oneClickStep === 'ready' && oneClickProfile">
            <img
              v-if="oneClickProfile.avatar"
              :src="oneClickProfile.avatar"
              alt="one click profile avatar"
              referrerpolicy="no-referrer"
              style="width: 160px; height: 160px; border-radius: 9999px; object-fit: cover; display: block;"
            />
            <n-avatar v-else round :size="160">
              {{ oneClickProfile.nickname?.slice(0, 1) || 'U' }}
            </n-avatar>

            <n-space vertical align="center" :size="6">
              <n-text strong style="font-size: 18px;">
                {{ oneClickProfile.nickname }}
              </n-text>
              <n-text depth="3">
                {{ oneClickHint }}
              </n-text>
            </n-space>

            <n-button
              type="primary"
              block
              :loading="loginStep === 'profile-loading'"
              @click="submitOneClickLogin"
            >
              一键登录
            </n-button>
          </template>

          <n-result
            v-else
            status="warning"
            title="当前不支持一键登录"
            :description="oneClickHint || '未检测到可用的本地登录态。'"
          />
        </n-space>
      </n-tab-pane>

      <n-tab-pane name="qrcode" tab="二维码登录">
        <n-space vertical align="center" justify="center" size="large">
          <n-spin v-if="loginStep === 'loading' || loginStep === 'profile-loading'" size="large">
            <div style="height: 160px; width: 160px;"></div>
          </n-spin>

          <n-avatar
            v-else-if="loginStep === 'scanned' && scannedAvatar"
            round
            :size="160"
            :src="scannedAvatar"
            :img-props="{ referrerpolicy: 'no-referrer' }"
          />

          <img
            v-else-if="qrcodeImage"
            :src="qrcodeImage"
            alt="login qrcode"
            style="width: 220px; height: 220px; object-fit: contain;"
          />

          <n-text depth="2">
            {{ loginHint }}
          </n-text>

          <n-countdown
            v-if="qrExpireAt && loginStep !== 'profile-loading'"
            :duration="Math.max(qrExpireAt - Date.now(), 0)"
            :active="loginStep !== 'expired'"
          />

          <n-button
            v-if="loginStep === 'expired' || loginStep === 'error'"
            type="primary"
            @click="openQrcodeLogin"
          >
            重新获取二维码
          </n-button>
        </n-space>
      </n-tab-pane>

      <n-tab-pane name="manual" tab="参数登录">
        <n-space vertical size="large">
          <n-radio-group :value="manualPlatform" @update:value="handleManualPlatformChange">
            <n-radio-button value="android">
              Android 端
            </n-radio-button>
            <n-radio-button value="pc">
              PC 端
            </n-radio-button>
            <n-radio-button value="custom">
              自定义
            </n-radio-button>
          </n-radio-group>

          <n-input
            v-model:value="manualAid"
            placeholder="请输入 aid"
            :disabled="manualPlatform !== 'custom' || loginStep === 'profile-loading'"
          />

          <n-input
            v-model:value="manualSessionId"
            placeholder="请输入 sessionid"
            :disabled="loginStep === 'profile-loading'"
          />

          <n-button
            type="primary"
            block
            :loading="loginStep === 'profile-loading'"
            @click="submitManualLogin"
          >
            开始登录
          </n-button>
        </n-space>
      </n-tab-pane>
    </n-tabs>
  </n-modal>
</template>
