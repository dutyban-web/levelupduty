/**
 * 몰입 모드용 백색/갈색 소음 (Web Audio) — 외부 파일 없이 재생
 */

export type AmbientKind = 'brown' | 'rain' | 'off'

let ctxRef: AudioContext | null = null
let nodes: { stop: () => void } | null = null

function getCtx(): AudioContext {
  if (!ctxRef) ctxRef = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  return ctxRef
}

/** 핑크/브라운에 가까운 필터링 노이즈 */
function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const rate = ctx.sampleRate
  const len = rate * seconds
  const buf = ctx.createBuffer(1, len, rate)
  const d = buf.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = w * 0.53626
    d[i] = b0 + b1 + b2 + b3 + b4 + b5 + w * 0.53626
    d[i] *= 0.11
  }
  return buf
}

export function startAmbient(kind: AmbientKind, volume = 0.12): () => void {
  stopAmbient()
  if (kind === 'off') return () => {}

  const ctx = getCtx()
  const gain = ctx.createGain()
  gain.gain.value = volume

  if (kind === 'brown') {
    const buf = makeNoiseBuffer(ctx, 3)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400
    src.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    src.start(0)
    nodes = {
      stop: () => {
        try {
          src.stop()
          src.disconnect()
          filter.disconnect()
          gain.disconnect()
        } catch {
          /* ignore */
        }
        nodes = null
      },
    }
    return () => stopAmbient()
  }

  // rain: 더 밝은 밴드 + 살짝 진동 (빗소리 느낌)
  const buf = makeNoiseBuffer(ctx, 2)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.7
  const wet = ctx.createGain()
  wet.gain.value = 1.2
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 3.5
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 400
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)
  src.connect(filter)
  filter.connect(wet)
  wet.connect(gain)
  gain.connect(ctx.destination)
  lfo.start(0)
  src.start(0)
  nodes = {
    stop: () => {
      try {
        lfo.stop()
        src.stop()
        lfo.disconnect()
        lfoGain.disconnect()
        src.disconnect()
        filter.disconnect()
        wet.disconnect()
        gain.disconnect()
      } catch {
        /* ignore */
      }
      nodes = null
    },
  }
  return () => stopAmbient()
}

export function stopAmbient(): void {
  if (nodes) {
    nodes.stop()
    nodes = null
  }
}

export async function resumeAudioIfNeeded(): Promise<void> {
  try {
    const c = getCtx()
    if (c.state === 'suspended') await c.resume()
  } catch {
    /* ignore */
  }
}
