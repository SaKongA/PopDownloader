<script setup>
import {
  NButton,
  NCard,
  NGrid,
  NGridItem,
  NH2,
  NIcon,
  NList,
  NListItem,
  NSpace,
  NTag,
  NText,
} from 'naive-ui'
import {
  CodeSlashOutline,
  LogoGithub,
  PersonCircleOutline,
  SparklesOutline,
} from '@vicons/ionicons5'

const appInfo = {
  name: 'PopDownloader',
  version: 'v1.2.0',
  description: '一个本地优先的汽水音乐工具，支持二维码登录、单曲解析、资源详情查看、歌单浏览和批量打包下载。',
}

const authorInfo = {
  name: 'Jason',
  role: '作者 / 维护者',
  githubName: 'SaKongA',
}

const repositoryInfo = {
  name: 'SaKongA/PopDownloader',
  url: 'https://github.com/SaKongA/PopDownloader',
  issuesUrl: 'https://github.com/SaKongA/PopDownloader/issues',
}

const acknowledgements = [
  {
    name: 'Vue 3',
    description: '负责整个前端应用的组件化开发与响应式状态管理。',
    url: 'https://vuejs.org/',
  },
  {
    name: 'Naive UI',
    description: '提供当前项目的大部分桌面风格界面组件。',
    url: 'https://www.naiveui.com/',
  },
  {
    name: 'Vite',
    description: '负责本地开发服务器与前端构建流程。',
    url: 'https://vitejs.dev/',
  },
  {
    name: 'Express',
    description: '承担本地 API 代理、资源解析和下载服务。',
    url: 'https://expressjs.com/',
  },
  {
    name: 'Archiver',
    description: '用于批量下载时生成 ZIP 压缩包。',
    url: 'https://www.npmjs.com/package/archiver',
  },
  {
    name: 'fluent-ffmpeg / ffmpeg-installer',
    description: '用于视频音频提取与媒体处理能力。',
    url: 'https://www.npmjs.com/package/fluent-ffmpeg',
  },
  {
    name: 'flac-tagger',
    description: '用于写入 FLAC 元数据与封面信息。',
    url: 'https://www.npmjs.com/package/flac-tagger',
  },
  {
    name: 'lottie-web',
    description: '用于首页单曲解析动画展示。',
    url: 'https://www.npmjs.com/package/lottie-web',
  },
  {
    name: '@vicons/ionicons5',
    description: '提供应用中使用的图标资源。',
    url: 'https://www.npmjs.com/package/@vicons/ionicons5',
  },
  {
    name: 'concurrently / nodemon',
    description: '用于本地开发时并行启动与服务自动重载。',
    url: 'https://www.npmjs.com/package/concurrently',
  },
]

function openExternal(url) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <n-space vertical size="large">
    <n-card embedded>
      <n-space vertical size="large">
        <n-space align="center" justify="space-between" :wrap="false">
          <n-space vertical :size="8">
            <n-space align="center">
              <n-h2 style="margin: 0;">
                {{ appInfo.name }}
              </n-h2>
              <n-tag type="success" round>
                {{ appInfo.version }}
              </n-tag>
            </n-space>
            <n-text depth="3">
              {{ appInfo.description }}
            </n-text>
          </n-space>

          <n-icon size="42" color="#18a058">
            <sparkles-outline />
          </n-icon>
        </n-space>
      </n-space>
    </n-card>

    <n-grid cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
      <n-grid-item>
        <n-card embedded title="作者信息">
          <template #header-extra>
            <n-icon size="20">
              <person-circle-outline />
            </n-icon>
          </template>

          <n-space vertical size="medium">
            <n-text>
              作者：{{ authorInfo.name }}
            </n-text>
            <n-text depth="3">
              角色：{{ authorInfo.role }}
            </n-text>
            <n-text depth="3">
              GitHub：{{ authorInfo.githubName }}
            </n-text>
            <n-button secondary @click="openExternal(`https://github.com/${authorInfo.githubName}`)">
              打开作者主页
            </n-button>
          </n-space>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card embedded title="GitHub 仓库">
          <template #header-extra>
            <n-icon size="20">
              <logo-github />
            </n-icon>
          </template>

          <n-space vertical size="medium">
            <n-text>
              仓库：{{ repositoryInfo.name }}
            </n-text>
            <n-text depth="3">
              代码地址：{{ repositoryInfo.url }}
            </n-text>
            <n-text depth="3">
              问题反馈：{{ repositoryInfo.issuesUrl }}
            </n-text>
            <n-space>
              <n-button secondary @click="openExternal(repositoryInfo.url)">
                打开仓库
              </n-button>
              <n-button secondary @click="openExternal(repositoryInfo.issuesUrl)">
                提交 Issue
              </n-button>
            </n-space>
          </n-space>
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card embedded title="开源鸣谢">
      <template #header-extra>
        <n-icon size="20">
          <code-slash-outline />
        </n-icon>
      </template>

      <n-list hoverable clickable>
        <n-list-item
          v-for="item in acknowledgements"
          :key="item.name"
          @click="openExternal(item.url)"
        >
          <n-space vertical :size="6">
            <n-space align="center">
              <n-text strong>{{ item.name }}</n-text>
              <n-tag size="small" round>
                Open Source
              </n-tag>
            </n-space>
            <n-text depth="3">
              {{ item.description }}
            </n-text>
            <n-text depth="3">
              {{ item.url }}
            </n-text>
          </n-space>
        </n-list-item>
      </n-list>
    </n-card>
  </n-space>
</template>
