#!/usr/bin/env node
/**
 * 本地音频转 MP3 工具
 *
 * 用途：把 App 缓存/下载目录里的音频文件（常见是扩展名不规范的 .bin，
 * 实际为 M4A/AAC、FLAC 等标准容器）批量转成 MP3。
 *
 * 这里只做「容器 + 编码」转换，不涉及任何解密或签名。源文件必须本身是可解码的音频。
 *
 * 用法：
 *   node tools/convert-to-mp3.js --out ./mp3-output --kbps 192 <文件或目录> [更多...]
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ffmpeg = require('@ffmpeg-installer/ffmpeg').path

const AUDIO_EXTENSIONS = ['.bin', '.m4a', '.mp4', '.aac', '.flac', '.mp3', '.wav', '.ogg', '.opus', '.wma']
const DEFAULT_KBPS = 192

function parseArgs(argv) {
  const options = { out: './mp3-output', kbps: DEFAULT_KBPS, inputs: [] }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--out' || arg === '-o') {
      options.out = argv[++index]
      continue
    }

    if (arg === '--kbps' || arg === '-b') {
      options.kbps = Number(argv[++index]) || DEFAULT_KBPS
      continue
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    options.inputs.push(arg)
  }

  return options
}

function collectFiles(input, collected = []) {
  const stat = fs.statSync(input)

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(input)) {
      collectFiles(path.join(input, entry), collected)
    }

    return collected
  }

  const ext = path.extname(input).toLowerCase()

  if (AUDIO_EXTENSIONS.includes(ext) || ext === '') {
    collected.push(input)
  }

  return collected
}

function probe(file) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' })
  const log = `${result.stderr || ''}${result.stdout || ''}`

  const durationMatch = log.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
  const audioLine = (log.match(/Stream #\d+:\d+.*?: Audio:.*/) || [''])[0]
  const codecMatch = audioLine.match(/Audio:\s*([a-zA-Z0-9_]+)/)
  const sampleRateMatch = audioLine.match(/(\d{4,6})\s*Hz/)
  const bitrateMatch = audioLine.match(/(\d+)\s*kb\/s/)
  const hasCover = /attached pic/i.test(log)

  if (!durationMatch) {
    return { ok: false, log }
  }

  const [, hours, minutes, seconds] = durationMatch
  const duration = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)

  return {
    ok: true,
    duration,
    codec: codecMatch?.[1] || '未知',
    sampleRate: sampleRateMatch?.[1] || '',
    bitrate: bitrateMatch?.[1] || '',
    hasCover,
    log,
  }
}

function convert(file, outputPath, kbps) {
  // 直接传 argv 数组，不让任何字符串拼接介入。
  // 含空格/中文/斜杠的值放进数组才不会被切碎（fluent-ffmpeg 的字符串 option 就踩过这个坑）。
  const baseArgs = [
    '-hide_banner',
    '-y',
    '-i', file,
    '-map', '0:a:0',
    '-map', '0:v?',
    '-c:a', 'libmp3lame',
    '-b:a', `${kbps}k`,
    '-c:v', 'copy',
    '-id3v2_version', '3',
    '-map_metadata', '0',
    '-write_id3v1', '0',
    outputPath,
  ]

  let result = spawnSync(ffmpeg, baseArgs, { encoding: 'utf8' })

  // 封面轨道拷贝失败时（例如源里的视频轨不是 attached_pic），退回纯音频转换
  if (result.status !== 0) {
    fs.rmSync(outputPath, { force: true })

    result = spawnSync(ffmpeg, [
      '-hide_banner',
      '-y',
      '-i', file,
      '-vn',
      '-map', '0:a:0',
      '-c:a', 'libmp3lame',
      '-b:a', `${kbps}k`,
      '-id3v2_version', '3',
      '-map_metadata', '0',
      '-write_id3v1', '0',
      outputPath,
    ], { encoding: 'utf8' })
  }

  return result
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help || options.inputs.length === 0) {
    console.log('用法: node tools/convert-to-mp3.js --out ./mp3-output --kbps 192 <文件或目录> [...]')
    console.log('说明: --kbps 默认 192；源为 AAC 128k 时 192k 已足够，调到 320k 只增大体积不提升音质。')
    process.exit(options.help ? 0 : 1)
  }

  const outputDir = path.resolve(options.out)
  fs.mkdirSync(outputDir, { recursive: true })

  const files = options.inputs.flatMap((input) => collectFiles(input))
  console.log(`共发现 ${files.length} 个待处理文件，输出目录: ${outputDir}\n`)

  let succeeded = 0
  let failed = 0

  for (const file of files) {
    const info = probe(file)
    const name = path.basename(file).replace(/\.[^.]+$/, '')
    const outputPath = path.join(outputDir, `${name}.mp3`)

    if (!info.ok) {
      console.log(`✗ ${path.basename(file)} → 不是可解码的音频，跳过`)
      failed += 1
      continue
    }

    const result = convert(file, outputPath, options.kbps)

    if (result.status !== 0 || !fs.existsSync(outputPath)) {
      // ffmpeg 失败时仍可能留下一个 0 字节或残缺的 .mp3，必须删除，避免误当成品
      fs.rmSync(outputPath, { force: true })
      console.log(`✗ ${path.basename(file)} → 转换失败`)
      const tail = (result.stderr || '').trim().split('\n').slice(-3).join(' | ')
      if (tail) {
        console.log(`   ${tail.slice(0, 220)}`)
      }
      failed += 1
      continue
    }

    const outStat = fs.statSync(outputPath)
    const outInfo = probe(outputPath)
    const durationDelta = outInfo.ok ? Math.abs(outInfo.duration - info.duration) : 0

    console.log(
      `✓ ${path.basename(file)} → ${path.basename(outputPath)}  `
      + `${(outStat.size / 1024 / 1024).toFixed(2)}MB  `
      + `源 ${info.codec}${info.bitrate ? ` ${info.bitrate}kbps` : ''} ${info.duration.toFixed(1)}s  `
      + `产物 ${outInfo.bitrate || '?'}kbps ${outInfo.ok ? outInfo.duration.toFixed(1) : '?'}s  `
      + `时长差 ${durationDelta.toFixed(2)}s${info.hasCover ? '  含封面' : ''}`,
    )
    succeeded += 1
  }

  console.log(`\n完成：成功 ${succeeded}，失败 ${failed}`)
}

main()
