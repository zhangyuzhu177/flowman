<template>
  <div class="json-node" :class="{ 'is-complex': isComplex }">
    <!-- Header line for node -->
    <div
      class="node-line"
      :class="{ clickable: isComplex }"
      @click="handleLineClick"
    >
      <!-- Expand / Collapse Arrow -->
      <span
        v-if="isComplex"
        class="toggle-icon"
        :class="{ open: isOpen }"
        @click.stop="toggleOpen"
      >
        <ChevronRight :size="13" />
      </span>
      <span v-else class="toggle-spacer" />

      <!-- Key name if present -->
      <span v-if="nodeKey !== undefined" class="node-key">
        <span class="key-quotes">"</span><span :class="{ 'highlight-text': isKeyMatched }">{{ nodeKey }}</span><span class="key-quotes">"</span>
        <span class="colon">: </span>
      </span>

      <!-- Complex object/array OPEN bracket -->
      <template v-if="isComplex">
        <span class="bracket">{{ isArray ? '[' : '{' }}</span>

        <!-- Collapsed inline summary -->
        <span v-if="!isOpen" class="collapsed-summary">
          <span class="ellipsis">...</span>
          <span class="badge">{{ itemsCount }} {{ isArray ? 'items' : 'keys' }}</span>
          <span class="bracket">{{ isArray ? ']' : '}' }}</span>
          <span v-if="!isLast" class="comma">,</span>
        </span>
      </template>

      <!-- Primitive value -->
      <template v-else>
        <span :class="valueClass">
          <template v-if="typeof value === 'string'">
            <span class="str-quote">"</span><span :class="{ 'highlight-text': isValueMatched }">{{ displayStringValue }}</span><span class="str-quote">"</span>
          </template>
          <template v-else-if="value === null">
            null
          </template>
          <template v-else>
            <span :class="{ 'highlight-text': isValueMatched }">{{ String(value) }}</span>
          </template>
        </span>
        <span v-if="!isLast" class="comma">,</span>
      </template>
    </div>

    <!-- Children (when complex and expanded) -->
    <div v-if="isComplex && isOpen" class="node-children">
      <!-- Array items -->
      <template v-if="isArray">
        <JsonTreeNode
          v-for="(item, idx) in (value as any[])"
          :key="idx"
          :node-key="idx"
          :value="item"
          :is-last="idx === (value as any[]).length - 1"
          :depth="depth + 1"
        />
      </template>

      <!-- Object entries -->
      <template v-else>
        <JsonTreeNode
          v-for="(key, idx) in objectKeys"
          :key="key"
          :node-key="key"
          :value="(value as Record<string, any>)[key]"
          :is-last="idx === objectKeys.length - 1"
          :depth="depth + 1"
        />
      </template>

      <!-- Complex object/array CLOSE bracket -->
      <div class="node-line close-bracket-line">
        <span class="toggle-spacer" />
        <span class="bracket">{{ isArray ? ']' : '}' }}</span>
        <span v-if="!isLast" class="comma">,</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue';
import { ChevronRight } from 'lucide-vue-next';

interface Props {
  nodeKey?: string | number;
  value: any;
  isLast?: boolean;
  depth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  nodeKey: undefined,
  isLast: true,
  depth: 0,
});

const isComplex = computed(() => {
  return props.value !== null && typeof props.value === 'object';
});

const isArray = computed(() => {
  return Array.isArray(props.value);
});

const objectKeys = computed(() => {
  if (!isComplex.value || isArray.value || !props.value) return [];
  return Object.keys(props.value);
});

const itemsCount = computed(() => {
  if (isArray.value) return (props.value as any[]).length;
  if (isComplex.value && props.value) return objectKeys.value.length;
  return 0;
});

// Injection from parent JsonViewer
const context = inject<{
  expandSignal: { value: number };
  collapseSignal: { value: number };
  searchTerm: { value: string };
  defaultExpandDepth: { value: number };
}>('jsonViewerContext', {
  expandSignal: ref(0),
  collapseSignal: ref(0),
  searchTerm: ref(''),
  defaultExpandDepth: ref(2),
});

// Initial open state: open up to defaultExpandDepth (e.g. depth < 2)
const isOpen = ref<boolean>(props.depth < context.defaultExpandDepth.value);

// Listen to global expand/collapse signals
watch(() => context.expandSignal.value, () => {
  if (isComplex.value) {
    isOpen.value = true;
  }
});

watch(() => context.collapseSignal.value, () => {
  if (isComplex.value) {
    // Keep root open, collapse deeper children
    isOpen.value = props.depth === 0;
  }
});

function toggleOpen() {
  if (isComplex.value) {
    isOpen.value = !isOpen.value;
  }
}

function handleLineClick() {
  if (isComplex.value) {
    toggleOpen();
  }
}

const valueClass = computed(() => {
  if (props.value === null) return 'val-null';
  const type = typeof props.value;
  if (type === 'string') return 'val-string';
  if (type === 'number') return 'val-number';
  if (type === 'boolean') return 'val-boolean';
  return 'val-other';
});

const displayStringValue = computed(() => {
  if (typeof props.value !== 'string') return '';
  // Max display truncate for huge strings
  if (props.value.length > 2000) {
    return props.value.slice(0, 2000) + '... [truncated]';
  }
  return props.value;
});

// Search highlighting
const isKeyMatched = computed(() => {
  const query = context.searchTerm.value.trim().toLowerCase();
  if (!query || props.nodeKey === undefined) return false;
  return String(props.nodeKey).toLowerCase().includes(query);
});

const isValueMatched = computed(() => {
  const query = context.searchTerm.value.trim().toLowerCase();
  if (!query || isComplex.value) return false;
  return String(props.value).toLowerCase().includes(query);
});

// If child or key matches search, automatically expand this node
watch([isKeyMatched, isValueMatched], ([km, vm]) => {
  if (km || vm) {
    isOpen.value = true;
  }
});
</script>

<style scoped>
.json-node {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 20px;
  user-select: text;
}

.node-line {
  display: flex;
  align-items: center;
  border-radius: 4px;
  padding: 1px 4px;
  min-height: 20px;
  white-space: pre-wrap;
  word-break: break-all;
  transition: background-color 0.1s ease;
}

.node-line:hover {
  background: rgba(255, 255, 255, 0.05);
}

.node-line.clickable {
  cursor: pointer;
}

.toggle-icon {
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #94a3b8;
  margin-right: 2px;
  flex-shrink: 0;
  transition: transform 0.15s ease, color 0.15s ease;
}

.toggle-icon:hover {
  color: #38bdf8;
}

.toggle-icon.open {
  transform: rotate(90deg);
}

.toggle-spacer {
  width: 14px;
  height: 14px;
  display: inline-block;
  margin-right: 2px;
  flex-shrink: 0;
}

.node-key {
  color: #93c5fd; /* Soft sky blue */
  font-weight: 500;
}

.key-quotes {
  color: #60a5fa;
  opacity: 0.7;
}

.colon {
  color: #64748b;
  margin-right: 4px;
}

.bracket {
  color: #cbd5e1;
  font-weight: 600;
}

.comma {
  color: #64748b;
}

.collapsed-summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
}

.ellipsis {
  color: #64748b;
}

.badge {
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 10px;
  border-radius: 99px;
  padding: 0 6px;
  height: 16px;
  line-height: 15px;
  font-family: var(--font-sans);
}

.node-children {
  padding-left: 18px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  margin-left: 7px;
}

.close-bracket-line {
  margin-left: -7px;
}

/* Value colors */
.val-string {
  color: #86efac; /* Bright soft green */
  word-break: break-all;
}

.str-quote {
  color: #4ade80;
  opacity: 0.7;
}

.val-number {
  color: #fdba74; /* Warm orange */
  font-weight: 600;
}

.val-boolean {
  color: #f472b6; /* Pink */
  font-weight: 600;
}

.val-null {
  color: #94a3b8; /* Muted slate */
  font-style: italic;
}

.val-other {
  color: #e2e8f0;
}

.highlight-text {
  background: rgba(234, 179, 8, 0.35);
  color: #fef08a;
  border-radius: 2px;
  padding: 0 2px;
}
</style>
