<template>
  <div
    v-if="isVisible"
    class="context-menu"
    :style="{ left: `${posX}px`, top: `${posY}px` }"
    @click.stop
  >
    <template v-for="(item, idx) in menuItems" :key="idx">
      <div v-if="item.isSeparator" class="separator" />
      <button
        v-else
        :class="{ danger: item.danger }"
        @click="handleClick(item)"
      >
        <span
          v-if="item.colorSwatch"
          class="swatch"
          :style="{ background: item.colorSwatch }"
        />
        {{ item.label }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useContextMenu, type ContextMenuItem } from '../composables/useContextMenu';

const { isVisible, posX, posY, menuItems, hideMenu } = useContextMenu();

function handleClick(item: ContextMenuItem) {
  if (item.action) {
    item.action();
  }
  hideMenu();
}

function handleGlobalClick() {
  if (isVisible.value) {
    hideMenu();
  }
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick);
  window.addEventListener('contextmenu', handleGlobalClick);
});

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick);
  window.removeEventListener('contextmenu', handleGlobalClick);
});
</script>
