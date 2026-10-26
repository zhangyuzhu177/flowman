<template>
  <aside class="sidebar" :style="{ width: `${sidebarWidth}px` }">
    <div class="sidebar-content">
      <!-- Segment switch -->
      <div class="segment">
        <button
          :class="{ active: activeSection === 'domains' }"
          @click="activeSection = 'domains'"
        >
          域名 ({{ sourceGroups.length }})
        </button>
        <button
          :class="{ active: activeSection === 'apps' }"
          @click="activeSection = 'apps'"
        >
          应用
        </button>
      </div>

      <!-- All traffic option -->
      <div class="source-list">
        <button
          class="source-item"
          :class="{ active: activeSourceKey === '*' }"
          @click="activeSourceKey = '*'"
        >
          <span class="source-name">全部流量</span>
          <span class="source-count">{{ totalFlowsCount }}</span>
        </button>
      </div>

      <!-- Pinned section (domains only) -->
      <div v-if="activeSection === 'domains' && pinnedItems.length > 0" class="pinned-section">
        <div class="source-head">
          <span>固定域名 (PINNED)</span>
        </div>
        <div class="source-list">
          <button
            v-for="item in pinnedItems"
            :key="item.key"
            class="source-item"
            :class="{ active: activeSourceKey === item.key }"
            @click="activeSourceKey = item.key"
            @contextmenu="handleContextMenu($event, item.key)"
          >
            <span class="source-name">
              <Pin :size="12" class="pin-icon" />
              <span>{{ item.label }}</span>
            </span>
            <span class="source-count">{{ item.count }}</span>
          </button>
        </div>
      </div>

      <!-- Main source list -->
      <div class="source-head">
        <span>{{ activeSection === 'domains' ? '域名列表' : '应用列表' }}</span>
        <span>{{ unpinnedItems.length }}</span>
      </div>

      <div class="source-list">
        <button
          v-for="item in unpinnedItems"
          :key="item.key"
          class="source-item"
          :class="{ active: activeSourceKey === item.key }"
          @click="activeSourceKey = item.key"
          @contextmenu="handleContextMenu($event, item.key)"
        >
          <span class="source-name">{{ item.label }}</span>
          <span class="source-count">{{ item.count }}</span>
        </button>
      </div>
    </div>
  </aside>

  <!-- Draggable divider -->
  <div
    class="sidebar-splitter"
    :class="{ active: isDragging }"
    @mousedown="startResize"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Pin } from 'lucide-vue-next';
import { useFlows } from '../composables/useFlows';
import { useProxyState } from '../composables/useProxyState';
import { useContextMenu, type ContextMenuItem } from '../composables/useContextMenu';

const {
  flows,
  activeSection,
  activeSourceKey,
  sourceGroups,
  pinnedItems,
  unpinnedItems,
  pinnedHosts,
  togglePin,
} = useFlows();

const { rules, saveRules } = useProxyState();
const { showMenu } = useContextMenu();

const totalFlowsCount = computed(() => flows.value.length);

// Sidebar width & resizing
const defaultWidth = 248;
const storedWidth = localStorage.getItem('flowman_sidebar_w');
const sidebarWidth = ref<number>(storedWidth ? parseInt(storedWidth, 10) : defaultWidth);
const isDragging = ref<boolean>(false);

function startResize(e: MouseEvent) {
  e.preventDefault();
  isDragging.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const onMouseMove = (moveEvent: MouseEvent) => {
    const newWidth = Math.max(160, Math.min(window.innerWidth - 380, moveEvent.clientX));
    sidebarWidth.value = newWidth;
    localStorage.setItem('flowman_sidebar_w', String(newWidth));
  };

  const onMouseUp = () => {
    isDragging.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function handleContextMenu(event: MouseEvent, key: string) {
  const isPinned = pinnedHosts.value.has(key);
  const items: ContextMenuItem[] = [
    {
      label: isPinned ? '取消固定' : '固定到顶部',
      action: () => togglePin(key),
    },
    {
      label: '复制名称',
      action: () => navigator.clipboard.writeText(key),
    },
  ];

  if (activeSection.value === 'domains' && rules.value) {
    items.push({
      label: '为此域名开启 SSL 解密',
      action: async () => {
        if (!rules.value) return;
        const exists = rules.value.ssl.include.some((r) => r.pattern === key);
        if (!exists) {
          const next = {
            ...rules.value,
            ssl: {
              ...rules.value.ssl,
              enabled: true,
              include: [
                ...rules.value.ssl.include,
                { id: `ssl_${Date.now()}`, enabled: true, pattern: key },
              ],
            },
          };
          await saveRules(next);
        }
      },
    });
  }

  showMenu(event, items);
}
</script>
