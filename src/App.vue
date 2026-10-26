<template>
  <div id="app">
    <!-- Top Toolbar -->
    <Toolbar />

    <!-- Main Workspace -->
    <div v-show="currentView === 'capture'" class="workspace">
      <!-- Left Sidebar (Domains / Apps) -->
      <Sidebar />

      <!-- Center & Right/Bottom: Stage (Traffic Table + Inspector) -->
      <div
        class="stage"
        :class="`dock-${dock}`"
        ref="stageEl"
      >
        <!-- Traffic Table -->
        <FlowTable />

        <!-- Resizable Splitter between Table and Inspector -->
        <div
          class="inspector-splitter"
          :class="{ active: isInspectorDragging }"
          @mousedown="startInspectorResize"
        />

        <!-- Multi-tab Inspector -->
        <Inspector :size="inspectorSize" />
      </div>
    </div>

    <!-- Compose View -->
    <ComposeView v-if="currentView === 'compose'" />

    <!-- Bottom Status Bar -->
    <StatusBar />

    <!-- Breakpoint Interception Modal Sheet -->
    <BreakpointModal />

    <!-- Unified Settings & Tools Modal Dialog (Left-Right Layout) -->
    <SettingsModal />

    <!-- Global Floating Context Menu -->
    <ContextMenu />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useProxyState } from './composables/useProxyState';
import { useFlows } from './composables/useFlows';
import { useBreakpoint } from './composables/useBreakpoint';

import Toolbar from './components/Toolbar.vue';
import Sidebar from './components/Sidebar.vue';
import FlowTable from './components/FlowTable.vue';
import Inspector from './components/Inspector.vue';
import SettingsModal from './components/SettingsModal.vue';
import ComposeView from './components/ComposeView.vue';
import StatusBar from './components/StatusBar.vue';
import BreakpointModal from './components/BreakpointModal.vue';
import ContextMenu from './components/ContextMenu.vue';
import { useSettings } from './composables/useSettings';

const {
  currentView,
  loadInitial: loadProxyInitial,
  setupListeners: setupProxyListeners,
  cleanupListeners: cleanupProxyListeners,
} = useProxyState();

const {
  dock,
  loadInitial: loadFlowsInitial,
  setupListeners: setupFlowsListeners,
  cleanupListeners: cleanupFlowsListeners,
} = useFlows();

const {
  setupListeners: setupBreakListeners,
  cleanupListeners: cleanupBreakListeners,
} = useBreakpoint();

const {
  initSettings,
  isSettingsOpen,
  closeSettings,
  toggleSettings,
} = useSettings();

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault();
    toggleSettings('appearance');
  } else if ((e.metaKey || e.ctrlKey) && (e.key === 't' || e.key === 'T')) {
    e.preventDefault();
    toggleSettings('proxy');
  } else if (e.key === 'Escape' && isSettingsOpen.value) {
    e.preventDefault();
    closeSettings();
  }
}

// Inspector dynamic resizing
const stageEl = ref<HTMLElement | null>(null);
const isInspectorDragging = ref<boolean>(false);

const storedH = localStorage.getItem('flowman_inspector_h');
const storedW = localStorage.getItem('flowman_inspector_w');
const inspectorH = ref<number>(storedH ? parseInt(storedH, 10) : 320);
const inspectorW = ref<number>(storedW ? parseInt(storedW, 10) : 420);

const inspectorSize = computed(() => {
  return dock.value === 'bottom' ? inspectorH.value : inspectorW.value;
});

function startInspectorResize(e: MouseEvent) {
  e.preventDefault();
  if (!stageEl.value) return;
  isInspectorDragging.value = true;
  document.body.style.cursor = dock.value === 'bottom' ? 'row-resize' : 'col-resize';
  document.body.style.userSelect = 'none';

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!stageEl.value) return;
    const stageRect = stageEl.value.getBoundingClientRect();
    if (dock.value === 'bottom') {
      const newHeight = Math.max(160, Math.min(stageRect.height - 140, stageRect.bottom - moveEvent.clientY));
      inspectorH.value = newHeight;
      localStorage.setItem('flowman_inspector_h', String(newHeight));
    } else {
      const newWidth = Math.max(240, Math.min(stageRect.width - 240, stageRect.right - moveEvent.clientX));
      inspectorW.value = newWidth;
      localStorage.setItem('flowman_inspector_w', String(newWidth));
    }
  };

  const onMouseUp = () => {
    isInspectorDragging.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

onMounted(async () => {
  initSettings();
  window.addEventListener('keydown', handleGlobalKeydown);

  setupProxyListeners();
  setupFlowsListeners();
  setupBreakListeners();

  await loadProxyInitial();
  await loadFlowsInitial();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  cleanupProxyListeners();
  cleanupFlowsListeners();
  cleanupBreakListeners();
});
</script>
