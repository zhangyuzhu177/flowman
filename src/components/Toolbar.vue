<template>
  <header class="toolbar">
    <div class="brand" @click="setView('capture')">
      <Activity :size="18" color="var(--blue)" />
      <span>Flowman</span>
    </div>

    <button
      class="record"
      :class="{ on: recording }"
      @click="toggleRecording"
      :title="recording ? '正在抓包 (点击暂停)' : '抓包已暂停 (点击开始)'"
    >
      <span class="rec-dot" />
      {{ recording ? '抓包中' : '已暂停' }}
    </button>

    <button @click="clearFlows" title="清除所有会话 (Shift+Cmd+Backspace)">
      <Trash2 :size="14" />
      清除
    </button>

    <div class="search-box">
      <Search :size="14" class="search-icon" />
      <input
        v-model="filterQuery"
        type="text"
        placeholder="过滤 URL、域名、状态码..."
      />
      <button
        v-if="filterQuery"
        class="search-clear"
        @click="filterQuery = ''"
      >
        <X :size="12" />
      </button>
    </div>

    <label class="check" title="同时搜索请求/响应 Body 内容">
      <input v-model="bodySearch" type="checkbox" />
      <span>Body</span>
    </label>

    <div class="chips">
      <button
        v-for="chip in chips"
        :key="chip.id"
        :class="{ active: filterKind === chip.id }"
        @click="filterKind = chip.id"
      >
        {{ chip.label }}
      </button>
    </div>

    <div class="spacer" />

    <button
      :class="{ active: rules?.noCaching }"
      @click="toggleNoCache"
      title="强制禁用缓存 (响应头 Cache-Control / Pragma)"
    >
      <ZapOff :size="14" />
      No-Cache
    </button>

    <button
      :class="{ active: currentView === 'compose' }"
      @click="toggleCompose"
      title="构造自定义请求 (Cmd+N)"
    >
      <Send :size="14" />
      Compose
    </button>

    <button
      :class="{ active: isSettingsOpen }"
      @click="toggleSettings()"
      title="偏好设置与工具箱 (Cmd+, / Cmd+T)"
    >
      <Settings :size="14" />
      设置
    </button>

    <button @click="openBrowser()" title="打开免配置受控调试浏览器">
      <Globe :size="14" />
      浏览器
    </button>
  </header>
</template>

<script setup lang="ts">
import {
  Activity,
  Trash2,
  Search,
  X,
  ZapOff,
  Send,
  Globe,
  Settings,
} from 'lucide-vue-next';
import { useProxyState } from '../composables/useProxyState';
import { useFlows } from '../composables/useFlows';
import { useSettings } from '../composables/useSettings';

const {
  recording,
  rules,
  currentView,
  toggleRecording,
  saveRules,
  openBrowser,
  setView,
} = useProxyState();

const {
  filterQuery,
  bodySearch,
  filterKind,
  clearFlows,
} = useFlows();

const { isSettingsOpen, toggleSettings } = useSettings();

const chips = [
  { id: 'all', label: '全部' },
  { id: 'json', label: 'JSON' },
  { id: 'ws', label: 'WS' },
  { id: 'image', label: '图片' },
  { id: 'js', label: 'JS' },
  { id: 'css', label: 'CSS' },
  { id: 'html', label: 'HTML' },
];

async function toggleNoCache() {
  if (!rules.value) return;
  const next = { ...rules.value, noCaching: !rules.value.noCaching };
  await saveRules(next);
}

function toggleCompose() {
  setView(currentView.value === 'compose' ? 'capture' : 'compose');
}
</script>
