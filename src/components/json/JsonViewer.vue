<template>
  <div class="json-viewer-container">
    <!-- Header Bar with Mode Switch & Action Buttons -->
    <div class="json-viewer-header">
      <!-- Mode Segment -->
      <div class="json-modes">
        <button
          v-if="isJson"
          :class="{ active: currentMode === 'tree' }"
          @click="currentMode = 'tree'"
          title="树形展开与折叠结构"
        >
          <FolderTree :size="13" />
          树形
        </button>
        <button
          v-if="isJson"
          :class="{ active: currentMode === 'formatted' }"
          @click="currentMode = 'formatted'"
          title="格式化缩进文本"
        >
          <Code2 :size="13" />
          格式化
        </button>
        <button
          :class="{ active: currentMode === 'raw' }"
          @click="currentMode = 'raw'"
          title="未经修改的原始数据"
        >
          <FileText :size="13" />
          原始
        </button>
      </div>

      <!-- In-JSON Search Box (only in tree mode) -->
      <div v-if="isJson && currentMode === 'tree'" class="json-search">
        <Search :size="12" class="json-search-icon" />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="搜索 Key 或 Value..."
        />
        <button
          v-if="searchTerm"
          class="json-search-clear"
          @click="searchTerm = ''"
        >
          <X :size="10" />
        </button>
      </div>

      <div class="spacer" />

      <!-- Quick Actions for Tree Mode -->
      <div v-if="isJson && currentMode === 'tree'" class="json-actions">
        <button @click="triggerExpandAll" title="全部展开">
          <UnfoldVertical :size="13" />
          全部展开
        </button>
        <button @click="triggerCollapseAll" title="折叠至顶层">
          <FoldVertical :size="13" />
          全部折叠
        </button>
      </div>

      <!-- Copy Button -->
      <button class="json-copy-btn" @click="handleCopy" :title="copied ? '已复制到剪贴板' : '复制内容'">
        <Check v-if="copied" :size="13" color="#22c55e" />
        <Copy v-else :size="13" />
        <span>{{ copied ? '已复制' : '复制' }}</span>
      </button>
    </div>

    <!-- Viewer Body -->
    <div class="json-viewer-content" :style="contentStyle">
      <!-- 1. Tree Mode -->
      <div v-if="isJson && currentMode === 'tree'" class="json-tree-body">
        <JsonTreeNode
          :value="parsedJson"
          :is-last="true"
          :depth="0"
        />
      </div>

      <!-- 2. Formatted Mode -->
      <pre
        v-else-if="isJson && currentMode === 'formatted'"
        class="json-raw-body"
      >{{ formattedJsonText }}</pre>

      <!-- 3. Raw Mode or Non-JSON -->
      <pre
        v-else
        class="json-raw-body"
      >{{ rawText }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, watch } from 'vue';
import {
  FolderTree,
  Code2,
  FileText,
  Search,
  X,
  UnfoldVertical,
  FoldVertical,
  Copy,
  Check,
} from 'lucide-vue-next';
import JsonTreeNode from './JsonTreeNode.vue';

interface Props {
  rawText?: string;
  contentType?: string;
  maxHeight?: string;
  defaultExpandDepth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  rawText: '',
  contentType: '',
  maxHeight: '400px',
  defaultExpandDepth: 2,
});

const currentMode = ref<'tree' | 'formatted' | 'raw'>('tree');
const searchTerm = ref<string>('');
const expandSignal = ref<number>(0);
const collapseSignal = ref<number>(0);
const copied = ref<boolean>(false);

// Provide context to child JsonTreeNode recursively
provide('jsonViewerContext', {
  expandSignal,
  collapseSignal,
  searchTerm,
  defaultExpandDepth: ref(props.defaultExpandDepth),
});

// JSON detection and parsing
const parsedState = computed(() => {
  const text = (props.rawText || '').trim();
  if (!text) return { isJson: false, data: null };

  // Quick sanity check before JSON.parse
  if (
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('[') && text.endsWith(']'))
  ) {
    try {
      const data = JSON.parse(text);
      return { isJson: true, data };
    } catch {
      return { isJson: false, data: null };
    }
  }

  // Also try if contentType contains json
  if (/json/i.test(props.contentType || '')) {
    try {
      const data = JSON.parse(text);
      return { isJson: true, data };
    } catch {
      return { isJson: false, data: null };
    }
  }

  return { isJson: false, data: null };
});

const isJson = computed(() => parsedState.value.isJson);
const parsedJson = computed(() => parsedState.value.data);

// Automatically set mode to raw if not json
watch(isJson, (valid) => {
  if (!valid) {
    currentMode.value = 'raw';
  } else if (currentMode.value === 'raw') {
    currentMode.value = 'tree';
  }
}, { immediate: true });

const formattedJsonText = computed(() => {
  if (!isJson.value) return props.rawText || '';
  try {
    return JSON.stringify(parsedJson.value, null, 2);
  } catch {
    return props.rawText || '';
  }
});

const contentStyle = computed(() => {
  return {
    maxHeight: props.maxHeight,
  };
});

function triggerExpandAll() {
  expandSignal.value++;
}

function triggerCollapseAll() {
  collapseSignal.value++;
}

async function handleCopy() {
  const textToCopy = currentMode.value === 'formatted' || currentMode.value === 'tree'
    ? formattedJsonText.value
    : (props.rawText || '');

  try {
    await navigator.clipboard.writeText(textToCopy);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  } catch {}
}
</script>

<style scoped>
.json-viewer-container {
  display: flex;
  flex-direction: column;
  background: #101828;
  border-radius: 9px;
  overflow: hidden;
  border: 1px solid #1e293b;
  margin-top: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.json-viewer-header {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  background: #0b1120;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
  user-select: none;
}

.json-modes {
  display: flex;
  gap: 3px;
  background: #1e293b;
  padding: 2px;
  border-radius: 6px;
}

.json-modes button {
  background: transparent;
  color: #94a3b8;
  border: none;
  height: 22px;
  padding: 0 8px;
  font-size: 11.5px;
  border-radius: 4px;
  gap: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.json-modes button:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.05);
}

.json-modes button.active {
  background: #0a64d8;
  color: white;
  font-weight: 500;
}

.json-search {
  position: relative;
  display: flex;
  align-items: center;
  margin-left: 4px;
}

.json-search input {
  height: 24px;
  width: 170px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #f1f5f9;
  font-size: 11px;
  padding: 0 22px 0 24px;
  outline: none;
  transition: all 0.15s ease;
}

.json-search input:focus {
  border-color: #38bdf8;
  width: 220px;
  background: #0f172a;
}

.json-search-icon {
  position: absolute;
  left: 6px;
  color: #64748b;
  pointer-events: none;
}

.json-search-clear {
  position: absolute;
  right: 4px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  height: 16px;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.json-search-clear:hover {
  color: #f1f5f9;
  background: #334155;
}

.spacer {
  flex: 1;
}

.json-actions {
  display: flex;
  gap: 4px;
}

.json-actions button, .json-copy-btn {
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  font-size: 11.5px;
  height: 24px;
  padding: 0 8px;
  border-radius: 5px;
  gap: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.json-actions button:hover, .json-copy-btn:hover {
  background: #334155;
  color: white;
  border-color: #475569;
}

.json-viewer-content {
  overflow: auto;
  padding: 10px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
}

.json-viewer-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.json-viewer-content::-webkit-scrollbar-track {
  background: transparent;
}

.json-viewer-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  background-clip: padding-box;
  border: 1px solid transparent;
  border-radius: 9999px;
  min-height: 20px;
}

.json-viewer-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

.json-viewer-content::-webkit-scrollbar-corner {
  background: transparent;
}

.json-tree-body {
  width: 100%;
}

.json-raw-body {
  margin: 0;
  color: #e8eefc;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
}
</style>
