<script setup>
import { computed, h, markRaw, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  NAvatar,
  NButton,
  NConfigProvider,
  NDropdown,
  NFlex,
  NGradientText,
  NGlobalStyle,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutSider,
  NMenu,
  NScrollbar,
  NSpace,
  NTag,
  NText,
  darkTheme,
  useThemeVars,
} from 'naive-ui'
import {
  CloudDownloadOutline,
  DiscOutline,
  InformationCircleOutline,
  ListOutline,
  LogInOutline,
  MoonOutline,
  PersonCircleOutline,
  SunnyOutline,
} from '@vicons/ionicons5'
import SingleTrackPage from './pages/SingleTrackPage.vue'
import MyPlaylistsPage from './pages/MyPlaylistsPage.vue'
import AccountInfoPage from './pages/AccountInfoPage.vue'
import AboutAppPage from './pages/AboutAppPage.vue'
import LoginModal from './components/LoginModal.vue'
import { fetchUserProfile } from './api/auth'
import {
  clearStoredAuth,
  getStoredProfile,
  getStoredSession,
  setStoredProfile,
} from './utils/authStorage'

const THEME_MODE_KEY = 'popDownloader.theme.mode'

const activeKey = ref('single')
const collapsed = ref(false)
const themeMode = ref('system')
const systemPrefersDark = ref(false)
const apiReady = ref(false)
const loginModalVisible = ref(false)
const authSession = ref(getStoredSession())
const userProfile = ref(getStoredProfile())
const themeVars = useThemeVars()
let removeThemeListener = null

function renderMenuIcon(icon) {
  return () =>
    h(NIcon, null, {
      default: () => h(icon),
    })
}

const menuOptions = [
  { label: '单曲解析', key: 'single', icon: renderMenuIcon(DiscOutline) },
  { label: '我的歌单', key: 'playlists', icon: renderMenuIcon(ListOutline) },
  { label: '账号信息', key: 'account', icon: renderMenuIcon(PersonCircleOutline) },
  { label: '关于应用', key: 'about', icon: renderMenuIcon(InformationCircleOutline) },
]

const pageComponents = {
  single: markRaw(SingleTrackPage),
  playlists: markRaw(MyPlaylistsPage),
  account: markRaw(AccountInfoPage),
  about: markRaw(AboutAppPage),
}

const isAuthenticated = computed(() => Boolean(userProfile.value?.id && authSession.value?.sessionid))
const currentTitle = computed(() => {
  const currentItem = menuOptions.find((option) => option.key === activeKey.value)
  return currentItem?.label || 'popDownloader'
})
const currentPageComponent = computed(() => pageComponents[activeKey.value] || SingleTrackPage)
const apiStatusType = computed(() => (apiReady.value ? 'success' : 'warning'))
const userAvatarKey = computed(() => userProfile.value?.avatar || userProfile.value?.id || 'guest')
const isDark = computed(() => {
  if (themeMode.value === 'dark') {
    return true
  }

  if (themeMode.value === 'light') {
    return false
  }

  return systemPrefersDark.value
})
const contentStyle = computed(() => ({
  height: '100%',
  overflow: 'hidden',
}))
const userDropdownOptions = computed(() => [
  {
    label: userProfile.value?.nickname || '未登录',
    key: 'nickname',
    disabled: true,
  },
  {
    type: 'divider',
    key: 'divider',
  },
  {
    label: '退出登录',
    key: 'logout',
  },
])

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

async function checkBackend() {
  try {
    const response = await fetch('/api/health')
    apiReady.value = response.ok
  } catch {
    apiReady.value = false
  }
}

function loadThemeMode() {
  const storedMode = localStorage.getItem(THEME_MODE_KEY)

  if (storedMode === 'dark' || storedMode === 'light') {
    themeMode.value = storedMode
    return
  }

  themeMode.value = 'system'
}

function syncSystemThemePreference() {
  systemPrefersDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
}

function toggleTheme() {
  themeMode.value = isDark.value ? 'light' : 'dark'
  localStorage.setItem(THEME_MODE_KEY, themeMode.value)
}

function openLoginModal() {
  loginModalVisible.value = true
}

function handleLoginSuccess({ session, profile }) {
  authSession.value = session
  userProfile.value = { ...profile }
  activeKey.value = 'account'
}

async function refreshStoredProfile() {
  if (!authSession.value?.sessionid) {
    return
  }

  try {
    const payload = await fetchUserProfile(authSession.value)
    const profile = normalizeUserProfile(payload)
    setStoredProfile(profile)
    userProfile.value = { ...profile }
  } catch {
    clearStoredAuth()
    authSession.value = null
    userProfile.value = null
  }
}

function handleUserAction(key) {
  if (key !== 'logout') {
    return
  }

  clearStoredAuth()
  authSession.value = null
  userProfile.value = null

  if (activeKey.value === 'playlists' || activeKey.value === 'account') {
    activeKey.value = 'single'
  }
}

onMounted(() => {
  loadThemeMode()
  syncSystemThemePreference()

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = (event) => {
    systemPrefersDark.value = event.matches
  }

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange)
    removeThemeListener = () => mediaQuery.removeEventListener('change', handleChange)
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleChange)
    removeThemeListener = () => mediaQuery.removeListener(handleChange)
  }

  checkBackend()
  refreshStoredProfile()
})

onBeforeUnmount(() => {
  removeThemeListener?.()
})
</script>

<template>
  <n-config-provider :theme="isDark ? darkTheme : null">
    <n-global-style />

    <login-modal
      v-model:show="loginModalVisible"
      @success="handleLoginSuccess"
    />

    <n-layout has-sider position="absolute" style="inset: 0; overflow: hidden;">
      <n-layout-sider
        v-model:collapsed="collapsed"
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="220"
        show-trigger
        style="height: 100%;"
      >
        <n-flex
          align="center"
          :justify="collapsed ? 'center' : 'start'"
          :wrap="false"
          style="padding: 16px 12px;"
        >
          <n-icon size="28" color="#18a058" style="flex-shrink: 0;">
            <cloud-download-outline />
          </n-icon>
          <n-space
            v-show="!collapsed"
            vertical
            :size="2"
            style="margin-left: 12px; overflow: hidden; white-space: nowrap;"
          >
            <n-gradient-text :size="18" type="success">
              PopDownloader
            </n-gradient-text>
            <n-text depth="3">
              本地音乐工具
            </n-text>
          </n-space>
        </n-flex>

        <n-menu
          v-model:value="activeKey"
          :collapsed="collapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
        />
      </n-layout-sider>

      <div style="height: 100%; overflow: hidden; display: flex; flex-direction: column; flex: 1; min-width: 0;">
        <n-layout-header bordered style="flex-shrink: 0;">
          <n-flex justify="space-between" align="center" :wrap="false" style="padding: 12px 16px;">
            <n-text strong style="font-size: 20px;">
              {{ currentTitle }}
            </n-text>

            <n-flex align="center" :wrap="false" size="medium">
              <n-tag round :type="apiStatusType">
                {{ apiReady ? 'API 正常' : 'API 未连接' }}
              </n-tag>

              <n-button circle secondary @click="toggleTheme">
                <template #icon>
                  <n-icon>
                    <sunny-outline v-if="isDark" />
                    <moon-outline v-else />
                  </n-icon>
                </template>
              </n-button>

              <n-button v-if="!isAuthenticated" secondary @click="openLoginModal">
                <template #icon>
                  <n-icon>
                    <log-in-outline />
                  </n-icon>
                </template>
                登录
              </n-button>

              <n-dropdown
                v-else
                trigger="click"
                :options="userDropdownOptions"
                @select="handleUserAction"
              >
                <div style="width: 32px; height: 32px; border-radius: 9999px; overflow: hidden; cursor: pointer;">
                    <img
                      v-if="userProfile?.avatar"
                      :key="userAvatarKey"
                      :src="userProfile.avatar"
                      alt="user avatar"
                      referrerpolicy="no-referrer"
                      style="width: 32px; height: 32px; border-radius: 9999px; object-fit: cover; display: block;"
                    />
                    <n-avatar v-else round :size="32" style="display: block;">
                      {{ userProfile?.nickname?.slice(0, 1) || 'U' }}
                    </n-avatar>
                </div>
              </n-dropdown>
            </n-flex>
          </n-flex>
        </n-layout-header>

        <n-layout-content style="flex: 1; min-height: 0; overflow: hidden;" :content-style="contentStyle">
          <n-scrollbar style="height: 100%;" content-style="padding: 24px;">
            <component
              :is="currentPageComponent"
              :is-authenticated="isAuthenticated"
              :user-profile="userProfile"
            />
          </n-scrollbar>
        </n-layout-content>
      </div>
    </n-layout>
  </n-config-provider>
</template>
