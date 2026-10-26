import { ref } from 'vue';
import type { BreakpointEvent, BreakpointDecision } from '../types/flow';

const activeBreakpoint = ref<BreakpointEvent | null>(null);
const isModalOpen = ref<boolean>(false);

export function useBreakpoint() {
  let offBreak: (() => void) | null = null;

  function setupListeners() {
    if (!window.flowman) return;
    offBreak = window.flowman.onBreak((data: BreakpointEvent) => {
      activeBreakpoint.value = data;
      isModalOpen.value = true;
    });
  }

  function cleanupListeners() {
    offBreak?.();
  }

  async function resolveBreakpoint(decision: BreakpointDecision) {
    if (!activeBreakpoint.value || !window.flowman) return false;
    const res = await window.flowman.resolveBreak({
      id: activeBreakpoint.value.id,
      decision,
    });
    isModalOpen.value = false;
    activeBreakpoint.value = null;
    return res;
  }

  return {
    activeBreakpoint,
    isModalOpen,
    setupListeners,
    cleanupListeners,
    resolveBreakpoint,
  };
}
