<template>
  <div class="inspector-panel" :style="panelStyle">
    <!-- Inspector Tab Bar -->
    <div class="inspector-bar">
      <button
        v-for="t in tabs"
        :key="t.id"
        :class="{ active: inspectorTab === t.id }"
        @click="inspectorTab = t.id"
      >
        {{ t.label }}
      </button>

      <div class="spacer" />

      <button
        @click="toggleDock"
        :title="dock === 'bottom' ? '停靠到右侧' : '停靠到底部'"
      >
        <Columns2 v-if="dock === 'bottom'" :size="13" />
        <Rows2 v-else :size="13" />
      </button>
    </div>

    <!-- Inspector Content -->
    <div v-if="selectedDetail" class="inspector-body">
      <!-- Warnings / Errors -->
      <div v-if="selectedDetail.error" class="warn-box">
        <strong>请求异常 / SSL 握手失败:</strong>
        <div>{{ selectedDetail.error }}</div>
      </div>
      <div v-if="selectedDetail.scriptErrors?.length" class="warn-box">
        <strong>脚本执行异常:</strong>
        <div v-for="(err, idx) in selectedDetail.scriptErrors" :key="idx">{{ err }}</div>
      </div>

      <!-- Tab: Summary -->
      <div v-if="inspectorTab === 'summary'">
        <table class="kv">
          <tbody>
            <tr><td>URL</td><td><code>{{ selectedDetail.url }}</code></td></tr>
            <tr><td>Method</td><td><strong>{{ selectedDetail.method }}</strong></td></tr>
            <tr><td>Status</td><td>{{ selectedDetail.status || '-' }}</td></tr>
            <tr><td>Protocol</td><td>{{ selectedDetail.protocol }}</td></tr>
            <tr><td>Host</td><td>{{ selectedDetail.host }}</td></tr>
            <tr><td>Path</td><td>{{ selectedDetail.path }}</td></tr>
            <tr v-if="selectedDetail.query"><td>Query</td><td>{{ selectedDetail.query }}</td></tr>
            <tr><td>Application</td><td>{{ selectedDetail.appName || 'Unknown' }}</td></tr>
            <tr><td>Response Size</td><td>{{ formatSize(selectedDetail.response?.size) }} (解码后: {{ formatSize(selectedDetail.response?.decodedSize) }})</td></tr>
            <tr><td>Request Size</td><td>{{ formatSize(selectedDetail.request?.size) }}</td></tr>
            <tr><td>Content-Type</td><td>{{ selectedDetail.contentType || '-' }}</td></tr>
            <tr><td>Duration</td><td>{{ selectedDetail.duration }} ms</td></tr>
            <tr><td>Started</td><td>{{ new Date(selectedDetail.startedAt).toLocaleString() }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Tab: Request -->
      <div v-else-if="inspectorTab === 'request'">
        <h4 style="margin: 0 0 8px; font-size: 13px;">Request Headers</h4>
        <table class="header-table">
          <tbody>
            <tr v-for="[k, v] in selectedDetail.request?.headers || []" :key="k">
              <td>{{ k }}</td>
              <td>{{ v }}</td>
            </tr>
          </tbody>
        </table>
        <h4 style="margin: 16px 0 8px; font-size: 13px;">Request Body</h4>
        <JsonViewer
          v-if="selectedDetail.request?.text"
          :raw-text="selectedDetail.request.text"
          :content-type="selectedDetail.request.contentType"
          max-height="500px"
        />
        <div v-else style="color: var(--muted); font-size: 12px;">无请求 Body</div>
      </div>

      <!-- Tab: Response -->
      <div v-else-if="inspectorTab === 'response'">
        <h4 style="margin: 0 0 8px; font-size: 13px;">Response Headers</h4>
        <table class="header-table">
          <tbody>
            <tr v-for="[k, v] in selectedDetail.response?.headers || []" :key="k">
              <td>{{ k }}</td>
              <td>{{ v }}</td>
            </tr>
          </tbody>
        </table>
        <h4 style="margin: 16px 0 8px; font-size: 13px;">Response Body</h4>
        <JsonViewer
          v-if="selectedDetail.response?.text"
          :raw-text="selectedDetail.response.text"
          :content-type="selectedDetail.response.contentType"
          max-height="500px"
        />
        <div v-else style="color: var(--muted); font-size: 12px;">无响应 Body</div>
      </div>

      <!-- Tab: Headers -->
      <div v-else-if="inspectorTab === 'headers'">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <h4 style="margin: 0 0 8px; font-size: 13px;">Request Headers</h4>
            <table class="header-table">
              <tbody>
                <tr v-for="[k, v] in selectedDetail.request?.headers || []" :key="k">
                  <td>{{ k }}</td>
                  <td>{{ v }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h4 style="margin: 0 0 8px; font-size: 13px;">Response Headers</h4>
            <table class="header-table">
              <tbody>
                <tr v-for="[k, v] in selectedDetail.response?.headers || []" :key="k">
                  <td>{{ k }}</td>
                  <td>{{ v }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: Body -->
      <div v-else-if="inspectorTab === 'body'">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <h4 style="margin: 0 0 8px; font-size: 13px;">Request Body ({{ formatSize(selectedDetail.request?.size) }})</h4>
            <JsonViewer
              v-if="selectedDetail.request?.text"
              :raw-text="selectedDetail.request.text"
              :content-type="selectedDetail.request.contentType"
              max-height="600px"
            />
            <div v-else style="color: var(--muted); font-size: 12px;">无请求 Body</div>
          </div>
          <div>
            <h4 style="margin: 0 0 8px; font-size: 13px;">Response Body ({{ formatSize(selectedDetail.response?.size) }})</h4>
            <JsonViewer
              v-if="selectedDetail.response?.text"
              :raw-text="selectedDetail.response.text"
              :content-type="selectedDetail.response.contentType"
              max-height="600px"
            />
            <div v-else style="color: var(--muted); font-size: 12px;">无响应 Body</div>
          </div>
        </div>
      </div>

      <!-- Tab: Cookies -->
      <div v-else-if="inspectorTab === 'cookies'">
        <h4 style="margin: 0 0 8px; font-size: 13px;">Request Cookies</h4>
        <table class="header-table">
          <tbody>
            <tr v-for="cookie in requestCookies" :key="cookie.key">
              <td>{{ cookie.key }}</td>
              <td>{{ cookie.value }}</td>
            </tr>
            <tr v-if="requestCookies.length === 0">
              <td colspan="2" style="color: var(--muted)">无 Cookie</td>
            </tr>
          </tbody>
        </table>

        <h4 style="margin: 16px 0 8px; font-size: 13px;">Response Set-Cookie</h4>
        <table class="header-table">
          <tbody>
            <tr v-for="(cookie, idx) in responseCookies" :key="idx">
              <td>{{ cookie.key }}</td>
              <td>{{ cookie.value }}</td>
            </tr>
            <tr v-if="responseCookies.length === 0">
              <td colspan="2" style="color: var(--muted)">无 Set-Cookie</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tab: Timing -->
      <div v-else-if="inspectorTab === 'timing'">
        <table class="kv">
          <tbody>
            <tr>
              <td>总耗时</td>
              <td>
                <div>{{ selectedDetail.duration }} ms</div>
                <div class="timing"><span style="width: 100%" /></div>
              </td>
            </tr>
            <tr>
              <td>发起时间</td>
              <td>{{ new Date(selectedDetail.startedAt).toISOString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tab: cURL -->
      <div v-else-if="inspectorTab === 'curl'">
        <div style="margin-bottom: 8px; display: flex; justify-content: flex-end;">
          <button @click="copyCurlText">
            <Copy :size="12" />
            复制 cURL
          </button>
        </div>
        <pre class="body-code">{{ curlCommand }}</pre>
      </div>
    </div>

    <!-- Empty state for inspector -->
    <div v-else class="inspector-body" style="display: grid; place-items: center; height: 100%; color: var(--muted);">
      <div>请选择左侧列表中的任意请求查看详情</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Columns2, Rows2, Copy } from 'lucide-vue-next';
import JsonViewer from './json/JsonViewer.vue';
import { useFlows, formatSize, toCurl } from '../composables/useFlows';

const props = defineProps<{
  size: number;
}>();

const {
  selectedDetail,
  dock,
  inspectorTab,
  toggleDock,
} = useFlows();

const tabs = [
  { id: 'summary', label: '概览' },
  { id: 'request', label: '请求' },
  { id: 'response', label: '响应' },
  { id: 'headers', label: 'Header' },
  { id: 'body', label: '正文' },
  { id: 'cookies', label: 'Cookie' },
  { id: 'timing', label: '计时' },
  { id: 'curl', label: 'cURL' },
];

const panelStyle = computed(() => {
  if (dock.value === 'bottom') {
    return { height: `${props.size}px` };
  } else {
    return { width: `${props.size}px` };
  }
});

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

const curlCommand = computed(() => {
  if (!selectedDetail.value) return '';
  return toCurl(selectedDetail.value);
});

async function copyCurlText() {
  if (curlCommand.value) {
    await navigator.clipboard.writeText(curlCommand.value);
  }
}

const requestCookies = computed(() => {
  if (!selectedDetail.value?.request?.headers) return [];
  const cookieHeaders = selectedDetail.value.request.headers
    .filter(([k]) => k.toLowerCase() === 'cookie')
    .map(([, v]) => v)
    .join('; ');

  if (!cookieHeaders) return [];
  return cookieHeaders.split(';').map((pair) => {
    const [key, ...vals] = pair.trim().split('=');
    return { key, value: vals.join('=') };
  });
});

const responseCookies = computed(() => {
  if (!selectedDetail.value?.response?.headers) return [];
  const setCookies = selectedDetail.value.response.headers
    .filter(([k]) => k.toLowerCase() === 'set-cookie')
    .map(([, v]) => v);

  return setCookies.map((raw) => {
    const first = raw.split(';')[0];
    const [key, ...vals] = first.split('=');
    return { key: key.trim(), value: vals.join('=') };
  });
});
</script>
