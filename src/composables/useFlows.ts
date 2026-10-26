import { ref, computed, watch } from 'vue';
import type { FlowSummary, FlowDetail } from '../types/flow';

const flows = ref<FlowSummary[]>([]);
const selectedId = ref<string | null>(null);
const selectedDetail = ref<FlowDetail | null>(null);
const activeSection = ref<'domains' | 'apps'>('domains');
const activeSourceKey = ref<string>('*');

// Pinned hosts stored in localStorage
const pinnedHosts = ref<Set<string>>(
  new Set(JSON.parse(localStorage.getItem('flowman_pinned_hosts') || '[]'))
);

const filterQuery = ref<string>('');
const bodySearch = ref<boolean>(false);
const bodyMatchedIds = ref<Set<string> | null>(null);
const filterKind = ref<string>('all');
const dock = ref<'bottom' | 'right'>(
  (localStorage.getItem('flowman_dock') as 'bottom' | 'right') || 'bottom'
);
const inspectorTab = ref<string>('summary');

export function formatSize(bytes?: number): string {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function kindOf(flow: FlowSummary): string {
  const type = flow.contentType || '';
  if (flow.websocket) return 'WS';
  if (/json/i.test(type)) return 'JSON';
  if (/image|svg/i.test(type)) return '图片';
  if (/javascript/i.test(type)) return 'JS';
  if (/css/i.test(type)) return 'CSS';
  if (/html/i.test(type)) return 'HTML';
  return type ? type.split(';')[0].split('/').pop() || '' : '';
}

export function flagsFor(flow: FlowSummary): string[] {
  const flags = flow.flags || {};
  const tags: string[] = [];
  if (flags.blocked) tags.push('Blocked');
  if (flags.mappedLocal) tags.push('MapLocal');
  if (flags.mappedRemote) tags.push('MapRemote');
  if (flags.scripted) tags.push('Script');
  if (flags.tunnel) tags.push('Tunnel');
  if (flags.sslFailed) tags.push('SSL Fail');
  return tags;
}

export function toCurl(flow: FlowDetail | FlowSummary): string {
  const parts = ['curl', '-X', flow.method, `'${flow.url}'`];
  if ('request' in flow && flow.request?.headers) {
    for (const [k, v] of flow.request.headers) {
      if (/^:(method|path|scheme|authority)$/i.test(k)) continue;
      parts.push('-H', `'${k}: ${String(v).replace(/'/g, "'\\''")}'`);
    }
    if (flow.request.text) {
      parts.push('--data-raw', `'${flow.request.text.replace(/'/g, "'\\''")}'`);
    }
  }
  return parts.join(' ');
}

export function useFlows() {
  let offFlow: (() => void) | null = null;
  let offFlowUpdate: (() => void) | null = null;
  let offCleared: (() => void) | null = null;

  async function loadInitial() {
    if (window.flowman) {
      flows.value = await window.flowman.listFlows();
    }
  }

  function setupListeners() {
    if (!window.flowman) return;
    offFlow = window.flowman.onFlow((flow) => {
      upsertFlow(flow);
    });
    offFlowUpdate = window.flowman.onFlowUpdate((flow) => {
      upsertFlow(flow);
    });
    offCleared = window.flowman.onCleared(() => {
      flows.value = [];
      selectedId.value = null;
      selectedDetail.value = null;
    });
  }

  function cleanupListeners() {
    offFlow?.();
    offFlowUpdate?.();
    offCleared?.();
  }

  function upsertFlow(summary: FlowSummary) {
    const idx = flows.value.findIndex((f) => f.id === summary.id);
    if (idx >= 0) {
      flows.value[idx] = { ...flows.value[idx], ...summary };
    } else {
      flows.value.push(summary);
    }
    if (selectedId.value === summary.id) {
      refreshSelectedDetail();
    }
  }

  async function selectFlow(id: string | null) {
    selectedId.value = id;
    if (!id || !window.flowman) {
      selectedDetail.value = null;
      return;
    }
    try {
      selectedDetail.value = await window.flowman.getFlow(id);
    } catch {
      selectedDetail.value = null;
    }
  }

  async function refreshSelectedDetail() {
    if (selectedId.value && window.flowman) {
      selectedDetail.value = await window.flowman.getFlow(selectedId.value);
    }
  }

  async function clearFlows() {
    if (window.flowman) {
      await window.flowman.clear();
    }
    flows.value = [];
    selectedId.value = null;
    selectedDetail.value = null;
  }

  async function repeatFlow(id: string) {
    if (window.flowman) {
      return window.flowman.repeat(id);
    }
  }

  async function highlightFlow(id: string, color: string) {
    if (window.flowman) {
      const updated = await window.flowman.highlight(id, color);
      if (updated) {
        upsertFlow(updated);
      }
    }
  }

  function togglePin(host: string) {
    const next = new Set(pinnedHosts.value);
    if (next.has(host)) {
      next.delete(host);
    } else {
      next.add(host);
    }
    pinnedHosts.value = next;
    localStorage.setItem('flowman_pinned_hosts', JSON.stringify(Array.from(next)));
  }

  function setDock(mode: 'bottom' | 'right') {
    dock.value = mode;
    localStorage.setItem('flowman_dock', mode);
  }

  function toggleDock() {
    setDock(dock.value === 'bottom' ? 'right' : 'bottom');
  }

  // Watch filterQuery and bodySearch for searching body
  watch([filterQuery, bodySearch], async ([q, isBody]) => {
    if (!isBody || !q || !window.flowman) {
      bodyMatchedIds.value = null;
      return;
    }
    try {
      const found = await window.flowman.search(q);
      bodyMatchedIds.value = new Set(found.map((f) => f.id));
    } catch {
      bodyMatchedIds.value = new Set();
    }
  });

  // Source list grouped by domain or app
  const sourceGroups = computed(() => {
    const counts = new Map<string, number>();
    for (const flow of flows.value) {
      const key = activeSection.value === 'domains'
        ? (flow.host || 'unknown')
        : (flow.appName || 'Unknown App');
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const items: Array<{ key: string; label: string; count: number; pinned?: boolean }> = [];
    
    // Sort keys alphabetically
    const sortedKeys = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
    for (const key of sortedKeys) {
      items.push({
        key,
        label: key,
        count: counts.get(key) || 0,
        pinned: pinnedHosts.value.has(key),
      });
    }

    return items;
  });

  const pinnedItems = computed(() => {
    if (activeSection.value !== 'domains') return [];
    return sourceGroups.value.filter((item) => item.pinned);
  });

  const unpinnedItems = computed(() => {
    if (activeSection.value !== 'domains') return sourceGroups.value;
    return sourceGroups.value.filter((item) => !item.pinned);
  });

  // Filtered visible flows
  const visibleFlows = computed(() => {
    const q = filterQuery.value.trim().toLowerCase();
    const kind = filterKind.value;
    const sourceKey = activeSourceKey.value;
    const isDomain = activeSection.value === 'domains';

    return flows.value.filter((flow) => {
      // Source filter
      if (sourceKey !== '*') {
        const flowKey = isDomain ? flow.host : flow.appName;
        if (flowKey !== sourceKey) return false;
      }

      // Kind filter
      if (kind !== 'all') {
        const flowKind = kindOf(flow).toLowerCase();
        if (kind === 'json' && !/json/i.test(flow.contentType || '')) return false;
        if (kind === 'ws' && !flow.websocket) return false;
        if (kind === 'image' && !/image|svg/i.test(flow.contentType || '')) return false;
        if (kind === 'js' && !/javascript/i.test(flow.contentType || '')) return false;
        if (kind === 'css' && !/css/i.test(flow.contentType || '')) return false;
        if (kind === 'html' && !/html/i.test(flow.contentType || '')) return false;
      }

      // Search query
      if (q) {
        if (bodySearch.value) {
          if (!bodyMatchedIds.value || !bodyMatchedIds.value.has(flow.id)) {
            return false;
          }
        } else {
          const matchTarget = `${flow.method} ${flow.url} ${flow.status} ${flow.contentType || ''} ${flow.appName || ''}`.toLowerCase();
          if (!matchTarget.includes(q)) return false;
        }
      }

      return true;
    });
  });

  return {
    flows,
    visibleFlows,
    selectedId,
    selectedDetail,
    activeSection,
    activeSourceKey,
    pinnedHosts,
    filterQuery,
    bodySearch,
    filterKind,
    dock,
    inspectorTab,
    sourceGroups,
    pinnedItems,
    unpinnedItems,
    loadInitial,
    setupListeners,
    cleanupListeners,
    upsertFlow,
    selectFlow,
    clearFlows,
    repeatFlow,
    highlightFlow,
    togglePin,
    setDock,
    toggleDock,
  };
}
