import { ref, computed } from 'vue';

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentColor = 'blue' | 'green' | 'purple' | 'orange' | 'rose';
export type SettingsTab =
  | 'appearance'
  | 'interface'
  | 'shortcuts'
  | 'proxy'
  | 'ssl'
  | 'throttle'
  | 'breakpoint'
  | 'mapLocal'
  | 'mapRemote'
  | 'script'
  | 'reverse'
  | 'external'
  | 'allow'
  | 'block'
  | 'about';

const THEME_KEY = 'flowman_theme';
const ACCENT_KEY = 'flowman_accent';
const COMPACT_KEY = 'flowman_compact';
const AUTOSCROLL_KEY = 'flowman_autoscroll';

const themeMode = ref<ThemeMode>(
  ((typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) as ThemeMode) || 'system'
);
const accentColor = ref<AccentColor>(
  ((typeof localStorage !== 'undefined' && localStorage.getItem(ACCENT_KEY)) as AccentColor) || 'blue'
);
const isCompact = ref<boolean>(
  typeof localStorage !== 'undefined' && localStorage.getItem(COMPACT_KEY) === 'true'
);
const autoScroll = ref<boolean>(
  typeof localStorage !== 'undefined' && localStorage.getItem(AUTOSCROLL_KEY) !== 'false'
);

const isSettingsOpen = ref<boolean>(false);
const activeTab = ref<SettingsTab>('appearance');

const systemPrefersDark = ref<boolean>(
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
);

const resolvedTheme = computed<'light' | 'dark'>(() => {
  if (themeMode.value === 'system') {
    return systemPrefersDark.value ? 'dark' : 'light';
  }
  return themeMode.value;
});

const isDark = computed(() => resolvedTheme.value === 'dark');

function applyTheme() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved = resolvedTheme.value;

  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', themeMode.value);
  root.setAttribute('data-accent', accentColor.value);
  root.setAttribute('data-compact', String(isCompact.value));
  root.style.colorScheme = resolved;

  if (typeof window !== 'undefined' && window.flowman?.setNativeTheme) {
    window.flowman.setNativeTheme(themeMode.value).catch(() => {});
  }
}

let isInitialized = false;

function initSettings() {
  if (isInitialized) return;
  isInitialized = true;

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    systemPrefersDark.value = mq.matches;

    const handler = (e: MediaQueryListEvent) => {
      systemPrefersDark.value = e.matches;
      if (themeMode.value === 'system') {
        applyTheme();
      }
    };

    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else {
      (mq as any).addListener(handler);
    }
  }

  applyTheme();
}

function setTheme(mode: ThemeMode) {
  themeMode.value = mode;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_KEY, mode);
  }
  applyTheme();
}

function setAccent(accent: AccentColor) {
  accentColor.value = accent;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ACCENT_KEY, accent);
  }
  applyTheme();
}

function setCompact(val: boolean) {
  isCompact.value = val;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(COMPACT_KEY, String(val));
  }
  applyTheme();
}

function setAutoScroll(val: boolean) {
  autoScroll.value = val;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AUTOSCROLL_KEY, String(val));
  }
}

function selectTab(tab: SettingsTab) {
  activeTab.value = tab;
}

function openSettings(tab: SettingsTab = 'appearance') {
  activeTab.value = tab;
  isSettingsOpen.value = true;
}

function closeSettings() {
  isSettingsOpen.value = false;
}

function toggleSettings(tab?: SettingsTab) {
  if (isSettingsOpen.value) {
    isSettingsOpen.value = false;
  } else {
    if (tab) activeTab.value = tab;
    isSettingsOpen.value = true;
  }
}

export function useSettings() {
  return {
    themeMode,
    accentColor,
    resolvedTheme,
    isDark,
    systemPrefersDark,
    isCompact,
    autoScroll,
    activeTab,
    isSettingsOpen,
    initSettings,
    setTheme,
    setAccent,
    setCompact,
    setAutoScroll,
    selectTab,
    openSettings,
    closeSettings,
    toggleSettings,
  };
}

export { useSettings as useTheme };
