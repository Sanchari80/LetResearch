import { create } from 'zustand';

const KEY = 'letresearch.settings.v1';

interface SettingsState {
  sound: boolean;
  haptics: boolean;
  setSound: (value: boolean) => void;
  setHaptics: (value: boolean) => void;
}

function load(): { sound: boolean; haptics: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { sound: saved.sound !== false, haptics: saved.haptics !== false };
    }
  } catch {
    // Storage can be unavailable (private browsing) – defaults are fine.
  }
  return { sound: true, haptics: true };
}

function persist(state: { sound: boolean; haptics: boolean }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore – the setting still applies for this visit.
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  setSound: (sound) => {
    set({ sound });
    persist({ sound, haptics: get().haptics });
  },
  setHaptics: (haptics) => {
    set({ haptics });
    persist({ sound: get().sound, haptics });
  },
}));
