<template>
  <div v-if="isModalOpen && activeBreakpoint" class="modal-overlay">
    <div class="sheet">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 17px; font-weight: 700;">
          断点拦截: {{ activeBreakpoint.phase === 'request' ? '请求拦截' : '响应拦截' }}
        </h3>
        <span class="tag" style="font-size: 12px;">{{ activeBreakpoint.request.method }} {{ activeBreakpoint.request.url }}</span>
      </div>

      <p style="margin: 0 0 14px; font-size: 12px; color: var(--muted);">
        当前流量在断点处已挂起。你可以在下方直接修改请求/响应内容后再执行放行，或直接阻断。
      </p>

      <div class="form-grid">
        <div class="field" v-if="activeBreakpoint.phase === 'request'">
          <label>HTTP 方法</label>
          <input v-model="editMethod" type="text" />
        </div>
        <div class="field" v-if="activeBreakpoint.phase === 'request'">
          <label>URL</label>
          <input v-model="editUrl" type="text" />
        </div>
        <div class="field" v-if="activeBreakpoint.phase === 'response'">
          <label>状态码 (Status Code)</label>
          <input v-model.number="editStatus" type="number" />
        </div>

        <div class="field wide">
          <label>头部 Headers (每行一个 Key: Value)</label>
          <textarea v-model="editHeaders" rows="6" style="font-family: var(--font-mono); font-size: 12px;" />
        </div>

        <div class="field wide">
          <label>Body 内容</label>
          <textarea v-model="editBody" rows="8" style="font-family: var(--font-mono); font-size: 12px;" />
        </div>
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
        <button class="danger" @click="handleAbort">
          阻断连接 (Abort)
        </button>
        <button @click="handleForwardOriginal">
          原样放行 (Ignore)
        </button>
        <button class="primary" @click="handleContinue">
          修改后放行 (Execute)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useBreakpoint } from '../composables/useBreakpoint';

const {
  activeBreakpoint,
  isModalOpen,
  resolveBreakpoint,
} = useBreakpoint();

const editMethod = ref<string>('');
const editUrl = ref<string>('');
const editStatus = ref<number>(200);
const editHeaders = ref<string>('');
const editBody = ref<string>('');

watch(activeBreakpoint, (bp) => {
  if (!bp) return;
  if (bp.phase === 'request') {
    editMethod.value = bp.request.method;
    editUrl.value = bp.request.url;
    editHeaders.value = Object.entries(bp.request.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    editBody.value = bp.request.body || '';
  } else if (bp.response) {
    editStatus.value = bp.response.status;
    editHeaders.value = Object.entries(bp.response.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    editBody.value = bp.response.body || '';
  }
});

function parseHeaders(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const splitIdx = trimmed.indexOf(':');
    if (splitIdx > 0) {
      const key = trimmed.slice(0, splitIdx).trim();
      const val = trimmed.slice(splitIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

async function handleContinue() {
  if (!activeBreakpoint.value) return;
  if (activeBreakpoint.value.phase === 'request') {
    await resolveBreakpoint({
      action: 'continue',
      request: {
        method: editMethod.value,
        url: editUrl.value,
        headers: parseHeaders(editHeaders.value),
        body: editBody.value,
      },
    });
  } else {
    await resolveBreakpoint({
      action: 'continue',
      response: {
        status: editStatus.value,
        headers: parseHeaders(editHeaders.value),
        body: editBody.value,
      },
    });
  }
}

async function handleForwardOriginal() {
  await resolveBreakpoint({ action: 'continue' });
}

async function handleAbort() {
  await resolveBreakpoint({ action: 'abort' });
}
</script>
