import { contextBridge, ipcRenderer } from 'electron';
import type { FlowmanRules, ComposePayload, BreakpointDecision } from '../../src/types/flow';

contextBridge.exposeInMainWorld('flowman', {
  getState: () => ipcRenderer.invoke('state'),
  setRecording: (value: boolean) => ipcRenderer.invoke('recording', value),
  clear: () => ipcRenderer.invoke('clear'),
  getRules: () => ipcRenderer.invoke('rules:get'),
  saveRules: (rules: FlowmanRules) => ipcRenderer.invoke('rules:save', rules),
  listFlows: () => ipcRenderer.invoke('flows'),
  getFlow: (id: string) => ipcRenderer.invoke('flow', id),
  search: (query: string) => ipcRenderer.invoke('search', query),
  exportHar: () => ipcRenderer.invoke('export-har'),
  exportCa: () => ipcRenderer.invoke('export-ca'),
  installCa: () => ipcRenderer.invoke('install-ca'),
  revealCa: () => ipcRenderer.invoke('reveal-ca'),
  repeat: (id: string) => ipcRenderer.invoke('repeat', id),
  compose: (payload: ComposePayload) => ipcRenderer.invoke('compose', payload),
  resolveBreak: (payload: { id: string; decision: BreakpointDecision }) => ipcRenderer.invoke('break:resolve', payload),
  setSystemProxy: (enabled: boolean) => ipcRenderer.invoke('system-proxy', enabled),
  openBrowser: (url?: string) => ipcRenderer.invoke('browser', url),
  selectFile: () => ipcRenderer.invoke('select-file'),
  highlight: (id: string, color: string) => ipcRenderer.invoke('highlight', { id, color }),
  onFlow: (callback: (flow: any) => void) => {
    const handler = (_event: any, flow: any) => callback(flow);
    ipcRenderer.on('flow', handler);
    return () => ipcRenderer.off('flow', handler);
  },
  onFlowUpdate: (callback: (flow: any) => void) => {
    const handler = (_event: any, flow: any) => callback(flow);
    ipcRenderer.on('flow-update', handler);
    return () => ipcRenderer.off('flow-update', handler);
  },
  onBreak: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('breakpoint', handler);
    return () => ipcRenderer.off('breakpoint', handler);
  },
  onStatus: (callback: (status: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('status', handler);
    return () => ipcRenderer.off('status', handler);
  },
  onCleared: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('cleared', handler);
    return () => ipcRenderer.off('cleared', handler);
  },
  onMenu: (callback: (action: string) => void) => {
    const handler = (_event: any, action: string) => callback(action);
    ipcRenderer.on('menu', handler);
    return () => ipcRenderer.off('menu', handler);
  },
  setNativeTheme: (theme: string) => ipcRenderer.invoke('theme:set', theme),
  getNativeTheme: () => ipcRenderer.invoke('theme:get'),
});
