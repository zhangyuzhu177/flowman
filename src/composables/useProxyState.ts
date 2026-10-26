import { ref, reactive, onMounted, onUnmounted } from 'vue';
import type { ProxyState, FlowmanRules } from '../types/flow';

const proxyState = ref<ProxyState | null>(null);
const rules = ref<FlowmanRules | null>(null);
const recording = ref<boolean>(true);
const currentView = ref<'capture' | 'tools' | 'compose'>('capture');
const currentTool = ref<string>('ssl');
const statusMessage = ref<string>('');

export function useProxyState() {
  let offStatus: (() => void) | null = null;
  let offMenu: (() => void) | null = null;

  async function loadInitial() {
    try {
      if (window.flowman) {
        rules.value = await window.flowman.getRules();
        proxyState.value = await window.flowman.getState();
        recording.value = proxyState.value.recording;
      }
    } catch (err: any) {
      statusMessage.value = `初始化状态失败: ${err.message}`;
    }
  }

  function setupListeners() {
    if (!window.flowman) return;
    offStatus = window.flowman.onStatus((state) => {
      proxyState.value = state;
      recording.value = state.recording;
    });

    offMenu = window.flowman.onMenu((action) => {
      if (action === 'compose') {
        currentView.value = 'compose';
      } else if (action === 'tools') {
        currentView.value = 'tools';
      }
    });
  }

  function cleanupListeners() {
    offStatus?.();
    offMenu?.();
  }

  async function setRecording(val: boolean) {
    if (!window.flowman) return;
    recording.value = val;
    proxyState.value = await window.flowman.setRecording(val);
  }

  async function toggleRecording() {
    await setRecording(!recording.value);
  }

  async function saveRules(nextRules: FlowmanRules) {
    if (!window.flowman) return { ok: false, error: 'API not available' };
    const res = await window.flowman.saveRules(nextRules);
    if (res.ok) {
      rules.value = res.rules;
      proxyState.value = res.state;
    }
    return res;
  }

  async function setSystemProxy(enabled: boolean) {
    if (!window.flowman) return;
    return window.flowman.setSystemProxy(enabled);
  }

  async function installCa() {
    if (!window.flowman) return;
    return window.flowman.installCa();
  }

  async function revealCa() {
    if (!window.flowman) return;
    return window.flowman.revealCa();
  }

  async function exportHar() {
    if (!window.flowman) return;
    return window.flowman.exportHar();
  }

  async function exportCa() {
    if (!window.flowman) return;
    return window.flowman.exportCa();
  }

  async function openBrowser(url?: string) {
    if (!window.flowman) return;
    const target = url || (proxyState.value?.samplePort ? `http://127.0.0.1:${proxyState.value.samplePort}/` : undefined);
    return window.flowman.openBrowser(target);
  }

  async function selectFile() {
    if (!window.flowman) return '';
    return window.flowman.selectFile();
  }

  function setView(view: 'capture' | 'tools' | 'compose') {
    currentView.value = view;
  }

  function setTool(toolId: string) {
    currentTool.value = toolId;
  }

  return {
    proxyState,
    rules,
    recording,
    currentView,
    currentTool,
    statusMessage,
    loadInitial,
    setupListeners,
    cleanupListeners,
    setRecording,
    toggleRecording,
    saveRules,
    setSystemProxy,
    installCa,
    revealCa,
    exportHar,
    exportCa,
    openBrowser,
    selectFile,
    setView,
    setTool,
  };
}
