import { ref } from 'vue';

export interface ContextMenuItem {
  label: string;
  action?: () => void;
  colorSwatch?: string;
  isSeparator?: boolean;
  danger?: boolean;
}

const isVisible = ref<boolean>(false);
const posX = ref<number>(0);
const posY = ref<number>(0);
const menuItems = ref<ContextMenuItem[]>([]);

export function useContextMenu() {
  function showMenu(event: MouseEvent, items: ContextMenuItem[]) {
    event.preventDefault();
    event.stopPropagation();
    posX.value = Math.min(event.clientX, window.innerWidth - 220);
    posY.value = Math.min(event.clientY, window.innerHeight - (items.length * 30 + 20));
    menuItems.value = items;
    isVisible.value = true;
  }

  function hideMenu() {
    isVisible.value = false;
  }

  return {
    isVisible,
    posX,
    posY,
    menuItems,
    showMenu,
    hideMenu,
  };
}
