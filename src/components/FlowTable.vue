<template>
  <div class="table-wrap" ref="tableContainer" tabindex="0" @keydown="handleKeyDown">
    <table class="flow-table">
      <thead>
        <tr>
          <th style="width: 52px">#</th>
          <th style="width: 72px">Method</th>
          <th style="width: 180px">Host</th>
          <th>Path</th>
          <th style="width: 70px">Status</th>
          <th style="width: 70px">Type</th>
          <th style="width: 80px">Size</th>
          <th style="width: 75px">Time</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="flow in visibleFlows"
          :key="flow.id"
          :class="[
            selectedId === flow.id ? 'selected' : '',
            flow.highlight ? `hl-${flow.highlight}` : '',
          ]"
          @click="selectFlow(flow.id)"
          @contextmenu="handleContextMenu($event, flow)"
        >
          <td class="num">{{ flow.no }}</td>
          <td>
            <span class="method" :class="`m-${flow.method}`">
              {{ flow.method }}
            </span>
          </td>
          <td :title="flow.host">{{ flow.host }}</td>
          <td :title="flow.url">
            <span>{{ flow.path || '/' }}</span>
            <span
              v-for="tag in flagsFor(flow)"
              :key="tag"
              class="tag"
              :class="{
                'tag-tunnel': tag === 'Tunnel',
                'tag-ssl-fail': tag === 'SSL Fail',
              }"
            >
              {{ tag }}
            </span>
          </td>
          <td>
            <span class="status-badge" :class="statusClass(flow.status)">
              {{ flow.status || '-' }}
            </span>
          </td>
          <td>{{ kindOf(flow) }}</td>
          <td>{{ formatSize(flow.responseSize || flow.requestSize) }}</td>
          <td>{{ flow.duration ? `${flow.duration} ms` : '-' }}</td>
        </tr>
      </tbody>
    </table>

    <EmptyState v-if="visibleFlows.length === 0" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { FlowSummary } from '../types/flow';
import { useFlows, formatSize, kindOf, flagsFor, toCurl } from '../composables/useFlows';
import { useProxyState } from '../composables/useProxyState';
import { useContextMenu, type ContextMenuItem } from '../composables/useContextMenu';
import EmptyState from './EmptyState.vue';

const {
  visibleFlows,
  selectedId,
  selectFlow,
  repeatFlow,
  highlightFlow,
  clearFlows,
} = useFlows();

const { rules, saveRules, setView } = useProxyState();
const { showMenu } = useContextMenu();

const tableContainer = ref<HTMLElement | null>(null);

function statusClass(status?: number): string {
  if (!status) return 'st-0';
  const group = Math.floor(status / 100);
  return `st-${group}`;
}

function handleKeyDown(event: KeyboardEvent) {
  if (!visibleFlows.value.length) return;
  const currentIdx = visibleFlows.value.findIndex((f) => f.id === selectedId.value);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const nextIdx = Math.min(visibleFlows.value.length - 1, currentIdx + 1);
    selectFlow(visibleFlows.value[nextIdx].id);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prevIdx = Math.max(0, currentIdx - 1);
    selectFlow(visibleFlows.value[prevIdx].id);
  }
}

function handleContextMenu(event: MouseEvent, flow: FlowSummary) {
  selectFlow(flow.id);

  const colors = [
    { label: '红色', color: 'red', hex: '#ef4444' },
    { label: '橙色', color: 'orange', hex: '#f97316' },
    { label: '黄色', color: 'yellow', hex: '#eab308' },
    { label: '绿色', color: 'green', hex: '#22c55e' },
    { label: '蓝色', color: 'blue', hex: '#3b82f6' },
    { label: '紫色', color: 'purple', hex: '#a855f7' },
    { label: '删除高亮', color: '', hex: '#cbd5e1' },
  ];

  const colorItems: ContextMenuItem[] = colors.map((c) => ({
    label: c.label,
    colorSwatch: c.hex,
    action: () => highlightFlow(flow.id, c.color),
  }));

  const items: ContextMenuItem[] = [
    {
      label: '复制 cURL',
      action: async () => {
        let text = toCurl(flow);
        if (window.flowman) {
          const detail = await window.flowman.getFlow(flow.id);
          if (detail) text = toCurl(detail);
        }
        await navigator.clipboard.writeText(text);
      },
    },
    {
      label: '复制 URL',
      action: () => navigator.clipboard.writeText(flow.url),
    },
    {
      label: '重新发送 (Replay)',
      action: () => repeatFlow(flow.id),
    },
    {
      label: '在 Compose 中编辑',
      action: async () => {
        // Will be picked up by Compose view
        sessionStorage.setItem('flowman_compose_draft', JSON.stringify(flow));
        setView('compose');
      },
    },
    {
      label: '为域名启用 SSL 解密',
      action: async () => {
        if (!rules.value) return;
        const exists = rules.value.ssl.include.some((r) => r.pattern === flow.host);
        if (!exists) {
          const next = {
            ...rules.value,
            ssl: {
              ...rules.value.ssl,
              enabled: true,
              include: [
                ...rules.value.ssl.include,
                { id: `ssl_${Date.now()}`, enabled: true, pattern: flow.host },
              ],
            },
          };
          await saveRules(next);
        }
      },
    },
    { isSeparator: true, label: '' },
    ...colorItems,
    { isSeparator: true, label: '' },
    {
      label: '清空列表',
      danger: true,
      action: clearFlows,
    },
  ];

  showMenu(event, items);
}
</script>
