<template>
  <div class="full-view-container">
    <div class="compose-content">
      <!-- Back Navigation -->
      <div class="view-back-bar">
        <button class="back-btn" @click="setView('capture')" title="返回主页面">
          <ArrowLeft :size="14" />
          <span>返回主页面</span>
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h2 class="page-title">请求构建器 (Compose)</h2>
        <button class="primary" :disabled="sending" @click="handleSend">
          <Send :size="14" />
          {{ sending ? '发送中...' : '发送请求 (Send)' }}
        </button>
      </div>
      <p class="page-desc">
        自由构建并发送自定义 HTTP/HTTPS 请求。支持自定义方法、URL、Header 头部与 Body 内容。
      </p>

      <!-- URL Bar -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <select v-model="method" style="width: 110px; height: 34px; font-weight: 700; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--ink);">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
        <input
          v-model="url"
          type="text"
          placeholder="https://example.com/api/v1/resource"
          style="flex: 1; height: 34px; border-radius: 8px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--ink); padding: 0 10px; font-family: var(--font-mono);"
        />
      </div>

      <!-- Request Editor Grid -->
      <div class="form-grid">
        <div class="field wide">
          <label><strong>请求头部 Headers</strong> (每行一组 Key: Value)</label>
          <textarea
            v-model="headersText"
            rows="5"
            placeholder="User-Agent: Flowman&#10;Content-Type: application/json"
            style="font-family: var(--font-mono); font-size: 12.5px;"
          />
        </div>

        <div class="field wide" v-if="method !== 'GET' && method !== 'HEAD'">
          <label><strong>请求 Body</strong></label>
          <textarea
            v-model="bodyText"
            rows="7"
            placeholder="可直接输入 JSON、表单数据或普通文本"
            style="font-family: var(--font-mono); font-size: 12.5px;"
          />
        </div>
      </div>

      <!-- Result section -->
      <div v-if="resultFlow" style="margin-top: 24px; border-top: 1px solid var(--line); padding-top: 18px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700;">响应结果</h3>
          <span class="status-badge" :class="statusClass(resultFlow.status)">
            HTTP {{ resultFlow.status }}
          </span>
          <span style="color: var(--muted); font-size: 12px;">
            耗时: {{ resultFlow.duration }} ms
          </span>
          <span style="color: var(--muted); font-size: 12px;">
            大小: {{ formatSize(resultFlow.response?.size) }}
          </span>
        </div>

        <div class="form-grid">
          <div class="field wide">
            <label>响应 Headers</label>
            <table class="header-table" style="background: var(--bg-subtle); border-radius: 8px; padding: 8px;">
              <tbody>
                <tr v-for="[k, v] in resultFlow.response?.headers || []" :key="k">
                  <td>{{ k }}</td>
                  <td>{{ v }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="field wide">
            <label>响应 Body</label>
            <JsonViewer
              v-if="resultFlow.response?.text"
              :raw-text="resultFlow.response.text"
              :content-type="resultFlow.response.contentType"
              max-height="450px"
            />
            <div v-else style="color: var(--muted); font-size: 12px; margin-top: 6px;">无响应 Body</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Send, ArrowLeft } from 'lucide-vue-next';
import type { FlowDetail } from '../types/flow';
import { formatSize } from '../composables/useFlows';
import { useProxyState } from '../composables/useProxyState';
import JsonViewer from './json/JsonViewer.vue';

const { setView } = useProxyState();

const method = ref<string>('GET');
const url = ref<string>('http://127.0.0.1:9108/hello');
const headersText = ref<string>('Accept: application/json');
const bodyText = ref<string>('');
const sending = ref<boolean>(false);
const resultFlow = ref<FlowDetail | null>(null);

function statusClass(status?: number): string {
  if (!status) return 'st-0';
  const group = Math.floor(status / 100);
  return `st-${group}`;
}

function formatBody(text?: string, contentType?: string): string {
  if (!text) return '';
  if (/json/i.test(contentType || '')) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

async function handleSend() {
  if (!url.value || !window.flowman) return;
  sending.value = true;
  resultFlow.value = null;

  try {
    const summary = await window.flowman.compose({
      method: method.value,
      url: url.value,
      headers: headersText.value,
      body: bodyText.value,
    });
    if (summary) {
      resultFlow.value = await window.flowman.getFlow(summary.id);
    }
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  const draft = sessionStorage.getItem('flowman_compose_draft');
  if (draft) {
    try {
      const parsed = JSON.parse(draft);
      sessionStorage.removeItem('flowman_compose_draft');
      method.value = parsed.method || 'GET';
      url.value = parsed.url || '';
      if (window.flowman && parsed.id) {
        const detail = await window.flowman.getFlow(parsed.id);
        if (detail?.request) {
          headersText.value = detail.request.headers
            .filter(([k]) => !k.startsWith(':'))
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
          bodyText.value = detail.request.text || '';
        }
      }
    } catch {}
  }
});
</script>
