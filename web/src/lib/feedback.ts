// Sensory feedback: subtle click sounds and, on phones that support it, short vibrations.
// Both can be switched off in Settings.
import { useSettings } from '@/store/settings';

const SOUNDS = ['tap', 'pop', 'toggle', 'send', 'receive', 'notify', 'success', 'error'] as const;
export type SoundName = (typeof SOUNDS)[number];

let context: AudioContext | null = null;
const buffers: Partial<Record<SoundName, AudioBuffer>> = {};
const loading: Partial<Record<SoundName, Promise<AudioBuffer | null>>> = {};

function audioContext() {
  if (context) return context;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  context = new Ctx();
  return context;
}

function loadSound(name: SoundName) {
  if (!loading[name]) {
    loading[name] = (async () => {
      try {
        const ctx = audioContext();
        if (!ctx) return null;
        const response = await fetch(`/sounds/${name}.wav`);
        const data = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(data);
        buffers[name] = buffer;
        return buffer;
      } catch {
        return null;
      }
    })();
  }
  return loading[name]!;
}

/** Decodes the interface sounds after the first interaction, so the first click already has sound. */
export function prepareSounds() {
  const unlock = () => {
    const ctx = audioContext();
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
    SOUNDS.forEach((name) => loadSound(name));
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

export function playSound(name: SoundName, volume = 0.5) {
  if (!useSettings.getState().sound) return;
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const play = (buffer: AudioBuffer | null | undefined) => {
      if (!buffer) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.buffer = buffer;
      source.connect(gain).connect(ctx.destination);
      source.start();
    };
    const ready = buffers[name];
    if (ready) play(ready);
    else loadSound(name).then(play);
  } catch {
    // Sound is decorative – ignore failures (e.g. autoplay rules).
  }
}

const VIBRATION: Record<string, number | number[]> = {
  light: 8,
  medium: 14,
  selection: 5,
  success: [10, 40, 14],
  error: [18, 50, 18],
};

export function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function haptic(kind: keyof typeof VIBRATION) {
  if (!canVibrate() || !useSettings.getState().haptics) return;
  try {
    navigator.vibrate(VIBRATION[kind]);
  } catch {
    // Some browsers block vibration without a recent tap.
  }
}

/** Named feedback moments used across the app. */
export const feedback = {
  tap: () => {
    haptic('light');
    playSound('tap', 0.22);
  },
  select: () => {
    haptic('selection');
    playSound('tap', 0.18);
  },
  like: () => {
    haptic('medium');
    playSound('pop', 0.45);
  },
  toggle: () => {
    haptic('selection');
    playSound('toggle', 0.35);
  },
  send: () => {
    haptic('light');
    playSound('send', 0.35);
  },
  receive: () => {
    haptic('light');
    playSound('receive', 0.35);
  },
  notify: () => {
    haptic('success');
    playSound('notify', 0.5);
  },
  success: () => {
    haptic('success');
    playSound('success', 0.45);
  },
  error: () => {
    haptic('error');
    playSound('error', 0.4);
  },
};
