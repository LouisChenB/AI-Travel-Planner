// createSpeechRecognition() 与 transcribeOnce()

type Recognition = {
  start: () => void
  stop: () => void
  onresult: ((event: any) => void) | null
  lang: string
  continuous: boolean
  interimResults: boolean
}

import { getSettings } from '../storage/settings'

export function createSpeechRecognition(lang = 'zh-CN') {
  const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
  if (!SR) return null
  const recognition: Recognition = new SR()
  recognition.lang = lang
  recognition.continuous = false
  recognition.interimResults = false
  recognition.onresult = null
  return recognition
}

// ===== 下面是科大讯飞 WebSocket 听写实现 =====

const XFY_HOST = 'ws-api.xfyun.cn'
const XFY_PATH = '/v2/iat'
const XFY_URL = `wss://${XFY_HOST}${XFY_PATH}`

async function hmacSHA256Base64(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function toRFC1123Date(d: Date): string {
  return d.toUTCString()
}

async function buildXFYAuthUrl(apiKey: string, apiSecret: string): Promise<string> {
  const date = toRFC1123Date(new Date())
  const signatureOrigin = `host: ${XFY_HOST}\ndate: ${date}\nGET ${XFY_PATH} HTTP/1.1`
  const signatureSha = await hmacSHA256Base64(apiSecret, signatureOrigin)
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`
  const authorization = btoa(authorizationOrigin)
  const url = `${XFY_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(XFY_HOST)}`
  return url
}

function downsampleBuffer(buffer: Float32Array, sampleRate: number, outRate = 16000): Float32Array {
  if (outRate === sampleRate) return buffer
  const ratio = sampleRate / outRate
  const newLen = Math.floor(buffer.length / ratio)
  const result = new Float32Array(newLen)
  let pos = 0
  for (let i = 0; i < newLen; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.floor((i + 1) * ratio)
    let sum = 0
    let count = 0
    for (let j = start; j < end && j < buffer.length; j++) {
      sum += buffer[j]
      count++
    }
    result[pos++] = count ? sum / count : 0
  }
  return result
}

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return out
}

function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

async function transcribeWithXFYun(lang = 'zh-CN'): Promise<string> {
  const s = getSettings()
  if (!s.xfyAppId || !s.xfyApiKey || !s.xfyApiSecret) {
    throw new Error('未配置科大讯飞 AppID/API Key/API Secret')
  }
  console.log('Voice: 准备建立讯飞 WebSocket 连接并签名')
  const url = await buildXFYAuthUrl(s.xfyApiKey, s.xfyApiSecret)
  const ws = new WebSocket(url)

  let opened = false
  let resolveFn: (v: string) => void
  let rejectFn: (e: any) => void
  const resultPromise = new Promise<string>((resolve, reject) => { resolveFn = resolve; rejectFn = reject })
  let accText = ''

  // 流式控制
  let canSend = true
  let settled = false
  let firstFrameSent = false

  // 组装动态修正片段
  const resultSegments: string[] = []
  const extractSegments = (wsList: any[]) => wsList.map((w: any) => w.cw.map((c: any) => c.w).join(''))

  // 音频采集与分帧
  let audioCtx: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let worklet: AudioWorkletNode | null = null
  let micStream: MediaStream | null = null

  const CHUNK_SAMPLES = 640 // 40ms @ 16kHz
  let sampleQueue: number[] = [] // 累计 16kHz 的样本，够 640 就发一帧

  const cleanupAudio = () => {
    try { worklet?.disconnect() } catch (e) { console.error('Voice: 断开 worklet 失败', e) }
    try { source?.disconnect() } catch (e) { console.error('Voice: 断开 source 失败', e) }
    try { audioCtx?.close() } catch (e) { console.error('Voice: 关闭 AudioContext 失败', e) }
    try { micStream?.getTracks().forEach(t => t.stop()) } catch (e) { console.error('Voice: 停止麦克风失败', e) }
  }

  const sendFrame = (frame: any) => {
    if (canSend && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame))
    }
  }

  ws.onopen = async () => {
    opened = true
    console.log('Voice: 讯飞 WebSocket 已连接，启动实时录音与流式发送')
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      await audioCtx.audioWorklet.addModule('/pcm-worklet.js')
      source = audioCtx.createMediaStreamSource(micStream)
      worklet = new AudioWorkletNode(audioCtx, 'pcm-processor')

      // 静音与超时控制
      const startTs = Date.now()
      let lastVoiceTs = Date.now()
      const PEAK_THRESHOLD = 0.02 // 峰值阈值，超过认为有语音
      const MAX_TALK_MS = 60_000   // 最长 1 分钟
      const SILENCE_MS = 3_000     // 静音 3 秒结束

      worklet.port.onmessage = (e: MessageEvent) => {
        const frame = e.data as Float32Array

        // 简单能量检测：峰值大于阈值视为有语音
        let peak = 0
        for (let i = 0; i < frame.length; i++) {
          const v = Math.abs(frame[i])
          if (v > peak) peak = v
        }
        if (peak > PEAK_THRESHOLD) lastVoiceTs = Date.now()

        // 下采样到 16kHz 并入队
        const down = downsampleBuffer(frame, audioCtx!.sampleRate, 16000)
        sampleQueue.push(...Array.from(down))

        // 分帧发送：每 640 样本一帧
        while (canSend && sampleQueue.length >= CHUNK_SAMPLES && ws.readyState === WebSocket.OPEN) {
          const segment = new Float32Array(sampleQueue.slice(0, CHUNK_SAMPLES))
          sampleQueue = sampleQueue.slice(CHUNK_SAMPLES)
          const int16 = floatTo16BitPCM(segment)
          const b64 = int16ToBase64(int16)

          if (!firstFrameSent) {
            const frame0 = {
              common: { app_id: s.xfyAppId },
              business: {
                language: lang.startsWith('zh') ? 'zh_cn' : 'en_us',
                domain: 'iat',
                accent: 'mandarin',
                vad_eos: SILENCE_MS,
                dwa: 'wpgs'
              },
              data: {
                status: 0,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: b64
              }
            }
            sendFrame(frame0)
            firstFrameSent = true
            // console.log('Voice: 首帧已发送')
          } else {
            const mid = { data: { status: 1, format: 'audio/L16;rate=16000', encoding: 'raw', audio: b64 } }
            sendFrame(mid)
          }
        }
      }

      // 建链
      source.connect(worklet)
      worklet.connect(audioCtx.destination)

      // 定时检查静音与最长时长
      const guardTimer = window.setInterval(() => {
        const now = Date.now()
        const idle = now - lastVoiceTs
        const elapsed = now - startTs

        if (!canSend) {
          window.clearInterval(guardTimer)
          return
        }
        if (idle >= SILENCE_MS || elapsed >= MAX_TALK_MS) {
          // 发送尾帧并清理本地音频
          const last = { data: { status: 2, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' } }
          sendFrame(last)
          console.log('Voice: 触发结束（静音或超时），尾帧已发送')
          canSend = false
          cleanupAudio()
          window.clearInterval(guardTimer)
        }
      }, 250)
    } catch (err) {
      console.error('Voice: 启动实时录音失败', err)
      if (!settled) { settled = true; rejectFn(err) }
      try { ws.close() } catch {}
      cleanupAudio()
    }
  }

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data)
      if (msg.code !== 0) {
        console.error('Voice: 讯飞识别错误', msg)
        if (!settled) { settled = true; rejectFn(new Error(`讯飞识别错误：${msg.code} ${msg.message || ''}`)) }
        canSend = false
        try { ws.close() } catch {}
        cleanupAudio()
        return
      }
      const res = msg.data?.result
      if (res?.ws) {
        const segments = extractSegments(res.ws)
        const pgs = res.pgs
        const rg = res.rg
        if (pgs === 'rpl' && Array.isArray(rg) && rg.length === 2) {
          const start = Math.max(0, rg[0])
          const end = Math.max(start, rg[1])
          resultSegments.splice(start, end - start + 1, ...segments)
        } else {
          resultSegments.push(...segments)
        }
        accText = resultSegments.join('')
      }
      if (msg.data?.status === 2) {
        console.log('Voice: 讯飞识别完成', accText)
        canSend = false
        if (!settled) { settled = true; resolveFn(accText) }
        try { if (ws.readyState === WebSocket.OPEN) ws.close() } catch {}
        cleanupAudio()
      }
    } catch (e) {
      console.error('Voice: 解析讯飞返回消息失败', e)
    }
  }

  ws.onerror = (e) => {
    console.error('Voice: 讯飞 WebSocket 连接错误', e)
  }

  ws.onclose = (e: CloseEvent) => {
    console.error('Voice: WebSocket 关闭', { opened, code: e.code, reason: e.reason, readyState: ws.readyState })
    canSend = false
    cleanupAudio()
    if (!opened && !settled) {
      settled = true
      rejectFn(new Error(`讯飞连接未建立，code=${e.code}, reason=${e.reason || '未知'}`))
    }
  }

  return resultPromise
}

// 使用科大讯飞
export async function transcribeOnce(lang = 'zh-CN'): Promise<string> {
  const s = getSettings()
  if (!s.xfyAppId || !s.xfyApiKey || !s.xfyApiSecret) {
    const err = new Error('未配置科大讯飞 AppID/API Key/API Secret，请在设置页填写后重试。')
    console.error('Voice: 缺少讯飞配置', err)
    throw err
  }
  try {
    return await transcribeWithXFYun(lang)
  } catch (e) {
    console.error('Voice: 讯飞识别失败', e)
    throw e
  }
}