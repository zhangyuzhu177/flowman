<template>
  <div class="full-view-container">
    <!-- Left Navigation for Tools -->
    <nav class="tools-sidebar">
      <div class="tools-sidebar-header">
        <button class="back-btn sidebar-back-btn" @click="setView('capture')" title="返回主页面">
          <ArrowLeft :size="14" />
          <span>返回主页面</span>
        </button>
      </div>
      <div class="tools-sidebar-divider" />
      <button
        v-for="tool in toolsList"
        :key="tool.id"
        class="tool-item"
        :class="{ active: currentTool === tool.id }"
        @click="currentTool = tool.id"
      >
        <component :is="tool.icon" :size="15" class="tool-icon" />
        <span>{{ tool.name }}</span>
      </button>
    </nav>

    <!-- Right Content for Selected Tool -->
    <main class="tools-content" v-if="rules">
      <!-- 1. Proxy Tool -->
      <section v-if="currentTool === 'proxy'">
        <h2 class="page-title">代理设置 (Proxy Server)</h2>
        <p class="page-desc">配置 Flowman 本地 HTTP/HTTPS 调试代理的监听端口与系统接管模式。</p>

        <div class="form-grid">
          <div class="field">
            <label>代理监听端口</label>
            <input v-model.number="rules.port" type="number" min="1" max="65535" />
          </div>
          <div class="field">
            <label>系统代理接管</label>
            <div style="display: flex; gap: 8px; align-items: center; height: 34px;">
              <button
                :class="proxyState?.systemProxy ? 'danger' : 'primary'"
                @click="toggleSysProxy"
              >
                {{ proxyState?.systemProxy ? '关闭系统代理' : '开启系统代理' }}
              </button>
              <span style="font-size: 12px; color: var(--muted);">
                {{ proxyState?.systemProxy ? '已接管 macOS 网络设置' : '未接管' }}
              </span>
            </div>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <h4 style="margin: 0 0 10px; font-size: 14px;">CA 根证书管理</h4>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="primary" @click="installCa">
              <ShieldCheck :size="13" />
              一键安装至钥匙串
            </button>
            <button @click="revealCa">
              <FolderOpen :size="13" />
              在访达中显示证书
            </button>
            <button @click="exportCa">
              <Download :size="13" />
              导出 CA 证书 (.pem / .der)
            </button>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <button class="primary" @click="persist">保存代理设置</button>
        </div>
      </section>

      <!-- 2. SSL Tool -->
      <section v-else-if="currentTool === 'ssl'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">SSL 解密 (SSL Proxying)</h2>
          <label class="check">
            <input v-model="rules.ssl.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用 SSL 解密</strong>
          </label>
        </div>
        <p class="page-desc">
          配置允许解密 HTTPS 流量的域名通配符规则。未匹配的域名将仅通过 CONNECT 隧道原样转发，保证网络稳定。
        </p>

        <div style="margin-bottom: 14px;">
          <label class="check">
            <input v-model="rules.ssl.ignoreUpstreamTls" type="checkbox" @change="persist" />
            <span>忽略上游服务器证书无效/自签名错误 (开发调试时非常有用)</span>
          </label>
        </div>

        <h4 style="margin: 16px 0 8px; font-size: 13px;">解密名单 (Include)</h4>
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <input
            v-model="newSslPattern"
            type="text"
            placeholder="例如: *.example.com 或 127.0.0.1"
            style="flex: 1; height: 32px; border: 1px solid #cfd8e6; border-radius: 7px; padding: 0 10px;"
          />
          <button class="primary" @click="addSslRule">
            <Plus :size="13" />
            添加域名
          </button>
        </div>

        <div v-for="(rule, idx) in rules.ssl.include" :key="rule.id" class="rule-card">
          <input v-model="rule.enabled" type="checkbox" @change="persist" />
          <div class="rule-info">
            <strong>{{ rule.pattern }}</strong>
          </div>
          <button class="danger" @click="removeSslRule(idx)">
            <Trash2 :size="12" />
            删除
          </button>
        </div>
      </section>

      <!-- 3. Breakpoints Tool -->
      <section v-else-if="currentTool === 'breakpoint'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">断点拦截 (Breakpoints)</h2>
          <label class="check">
            <input v-model="rules.breakpoints.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用断点</strong>
          </label>
        </div>
        <p class="page-desc">在请求发往后端之前或响应返回前端之前暂停请求，支持查看并实时修改数据。</p>

        <!-- Add Rule Form -->
        <div class="form-grid" style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
          <div class="field">
            <label>规则名称</label>
            <input v-model="bpForm.name" type="text" placeholder="例如: 拦截登录接口" />
          </div>
          <div class="field">
            <label>HTTP 方法</label>
            <select v-model="bpForm.method">
              <option value="*">* (全部)</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div class="field">
            <label>域名 / Host (支持通配符 *)</label>
            <input v-model="bpForm.host" type="text" placeholder="* 或 api.example.com" />
          </div>
          <div class="field">
            <label>路径 Path (支持通配符 *)</label>
            <input v-model="bpForm.path" type="text" placeholder="/api/*" />
          </div>
          <div class="field">
            <label>拦截阶段</label>
            <select v-model="bpForm.phase">
              <option value="request">仅请求阶段 (Request)</option>
              <option value="response">仅响应阶段 (Response)</option>
              <option value="both">请求与响应双向 (Both)</option>
            </select>
          </div>
          <div class="field" style="justify-content: flex-end;">
            <button class="primary" @click="addBreakpointRule">
              <Plus :size="13" />
              添加断点规则
            </button>
          </div>
        </div>

        <!-- Rule List -->
        <div v-for="(rule, idx) in rules.breakpoints.rules" :key="rule.id" class="rule-card">
          <input v-model="rule.enabled" type="checkbox" @change="persist" />
          <div class="rule-info">
            <strong>{{ rule.name || '未命名断点' }} ({{ rule.phase }})</strong>
            <code>{{ rule.method }} {{ rule.host }}{{ rule.path }}</code>
          </div>
          <button class="danger" @click="removeBreakpointRule(idx)">
            <Trash2 :size="12" />
            删除
          </button>
        </div>
      </section>

      <!-- 4. Map Local Tool -->
      <section v-else-if="currentTool === 'mapLocal'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">本地映射 (Map Local)</h2>
          <label class="check">
            <input v-model="rules.mapLocal.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用 Map Local</strong>
          </label>
        </div>
        <p class="page-desc">将匹配的网络请求直接劫持并返回本地文件内容，无需依赖后端服务。</p>

        <!-- Form -->
        <div class="form-grid" style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
          <div class="field">
            <label>匹配 Host</label>
            <input v-model="mapLocalForm.host" type="text" placeholder="api.example.com" />
          </div>
          <div class="field">
            <label>匹配 Path</label>
            <input v-model="mapLocalForm.path" type="text" placeholder="/api/users" />
          </div>
          <div class="field wide">
            <label>映射的本地文件路径</label>
            <div style="display: flex; gap: 8px;">
              <input v-model="mapLocalForm.file" type="text" placeholder="/path/to/mock.json" style="flex: 1;" />
              <button @click="pickMapLocalFile">
                <FolderOpen :size="13" />
                选择文件...
              </button>
            </div>
          </div>
          <div class="field">
            <label>返回 HTTP 状态码</label>
            <input v-model.number="mapLocalForm.status" type="number" />
          </div>
          <div class="field" style="justify-content: flex-end;">
            <button class="primary" @click="addMapLocalRule">
              <Plus :size="13" />
              添加本地映射
            </button>
          </div>
        </div>

        <div v-for="(rule, idx) in rules.mapLocal.rules" :key="rule.id" class="rule-card">
          <input v-model="rule.enabled" type="checkbox" @change="persist" />
          <div class="rule-info">
            <strong>{{ rule.host }}{{ rule.path }} -> {{ rule.file }}</strong>
            <code>Status: {{ rule.status || 200 }}</code>
          </div>
          <button class="danger" @click="removeMapLocalRule(idx)">
            <Trash2 :size="12" />
            删除
          </button>
        </div>
      </section>

      <!-- 5. Map Remote Tool -->
      <section v-else-if="currentTool === 'mapRemote'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">远程映射 (Map Remote)</h2>
          <label class="check">
            <input v-model="rules.mapRemote.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用 Map Remote</strong>
          </label>
        </div>
        <p class="page-desc">将匹配的请求静默转发至另一个目标 URL（例如将线上 API 映射至本地测试服务）。</p>

        <div class="form-grid" style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
          <div class="field">
            <label>原始 Host</label>
            <input v-model="mapRemoteForm.host" type="text" placeholder="prod.api.com" />
          </div>
          <div class="field">
            <label>原始 Path</label>
            <input v-model="mapRemoteForm.path" type="text" placeholder="/api/*" />
          </div>
          <div class="field wide">
            <label>目标重定向 URL</label>
            <input v-model="mapRemoteForm.targetUrl" type="text" placeholder="http://127.0.0.1:3000/api" />
          </div>
          <div class="field wide" style="justify-content: flex-end;">
            <button class="primary" @click="addMapRemoteRule">
              <Plus :size="13" />
              添加远程映射
            </button>
          </div>
        </div>

        <div v-for="(rule, idx) in rules.mapRemote.rules" :key="rule.id" class="rule-card">
          <input v-model="rule.enabled" type="checkbox" @change="persist" />
          <div class="rule-info">
            <strong>{{ rule.host }}{{ rule.path }} -> {{ rule.targetUrl }}</strong>
          </div>
          <button class="danger" @click="removeMapRemoteRule(idx)">
            <Trash2 :size="12" />
            删除
          </button>
        </div>
      </section>

      <!-- 6. Allow List Tool -->
      <section v-else-if="currentTool === 'allow'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">允许列表 (Allow List)</h2>
          <label class="check">
            <input v-model="rules.allow.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用允许列表</strong>
          </label>
        </div>
        <p class="page-desc">开启后将只捕获与记录列表中匹配的请求，其他请求将直接放行且不记录。</p>

        <div style="display: flex; gap: 8px; margin-bottom: 14px;">
          <input v-model="allowInput" type="text" placeholder="域名通配符 (如: *.github.com)" style="flex: 1; height: 32px; border-radius: 7px; border: 1px solid #cfd8e6; padding: 0 10px;" />
          <button class="primary" @click="addAllowRule">
            <Plus :size="13" />
            添加允许规则
          </button>
        </div>

        <div v-for="(rule, idx) in rules.allow.rules" :key="rule.id" class="rule-card">
          <input v-model="rule.enabled" type="checkbox" @change="persist" />
          <div class="rule-info">
            <strong>{{ rule.host }}</strong>
          </div>
          <button class="danger" @click="removeAllowRule(idx)">
            <Trash2 :size="12" />
            删除
          </button>
        </div>
      </section>

      <!-- 7. Block List Tool -->
      <section v-else-if="currentTool === 'block'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">阻止列表 (Block List)</h2>
          <label class="check">
            <input v-model="rules.block.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用阻止列表</strong>
          </label>
        </div>
        <p class="page-desc">直接阻断匹配的广告、跟踪器或恶意请求，并返回指定的 HTTP 状态码。</p>

        <div class="form-grid" style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
          <div class="field">
            <label>拦截域名 Host</label>
            <input v-model="blockForm.host" type="text" placeholder="*ads*.com" />
          </div>
          <div class="field">
            <label>拦截路径 Path</label>
            <input v-model="blockForm.path" type="text" placeholder="*" />
          </div>
          <div class="field">
            <label>返回状态码</label>
            <input v-model.number="blockForm.status" type="number" />
          </div>
          <div class="field" style="justify-content: flex-end;">
            <button class="primary" @click="addBlockRule">
              <Plus :size="13" />
              添加阻断规则
            </button>
          </div>
        </div>

        <div v-for="(rule, idx) in rules.block.rules" :key="rule.id" class="rule-card">
          <input v-model="rule.enabled" type="checkbox" @change="persist" />
          <div class="rule-info">
            <strong>{{ rule.host }}{{ rule.path }}</strong>
            <code>Status: {{ rule.status || 403 }}</code>
          </div>
          <button class="danger" @click="removeBlockRule(idx)">
            <Trash2 :size="12" />
            删除
          </button>
        </div>
      </section>

      <!-- 8. Scripting Tool -->
      <section v-else-if="currentTool === 'script'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">自定义脚本 (Scripting)</h2>
          <label class="check">
            <input v-model="rules.scripts.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用脚本引擎</strong>
          </label>
        </div>
        <p class="page-desc">
          使用 JavaScript 编写动态规则，可在 <code>onRequest(request)</code> 和 <code>onResponse(request, response)</code> 中实时改写请求头、Body、参数等。
        </p>

        <div class="form-grid" style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
          <div class="field wide">
            <label>脚本名称</label>
            <input v-model="scriptForm.name" type="text" placeholder="例如: 模拟错误返回" />
          </div>
          <div class="field wide">
            <label>JavaScript 脚本代码</label>
            <textarea
              v-model="scriptForm.code"
              rows="8"
              style="font-family: var(--font-mono); font-size: 12px;"
            />
          </div>
          <div class="field wide" style="justify-content: flex-end;">
            <button class="primary" @click="addScript">
              <Plus :size="13" />
              添加脚本
            </button>
          </div>
        </div>

        <div v-for="(item, idx) in rules.scripts.items" :key="item.id" class="rule-card">
          <input v-model="item.enabled" type="checkbox" @change="persist" />
          <div class="rule-info">
            <strong>{{ item.name }}</strong>
            <code>{{ item.code.slice(0, 80) }}...</code>
          </div>
          <button class="danger" @click="removeScript(idx)">
            <Trash2 :size="12" />
            删除
          </button>
        </div>
      </section>

      <!-- 9. Reverse Proxy Tool -->
      <section v-else-if="currentTool === 'reverse'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">反向代理 (Reverse Proxy)</h2>
        </div>
        <p class="page-desc">在独立端口启动本地 HTTP 反向代理，将访问该端口的所有流量透明转发至目标服务器。</p>

        <div class="form-grid" style="background: #f8fafc; padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
          <div class="field">
            <label>本地监听端口</label>
            <input v-model.number="reverseForm.listenPort" type="number" placeholder="8080" />
          </div>
          <div class="field">
            <label>目标服务器 URL</label>
            <input v-model="reverseForm.targetUrl" type="text" placeholder="http://127.0.0.1:3000" />
          </div>
          <div class="field wide" style="justify-content: flex-end;">
            <button class="primary" @click="addReverseRule">
              <Plus :size="13" />
              添加反向代理
            </button>
          </div>
        </div>

        <div v-for="(rule, idx) in rules.reverseProxies" :key="rule.id" class="rule-card">
          <input v-model="rule.enabled" type="checkbox" @change="persist" />
          <div class="rule-info">
            <strong>:{{ rule.listenPort }} -> {{ rule.targetUrl }}</strong>
          </div>
          <button class="danger" @click="removeReverseRule(idx)">
            <Trash2 :size="12" />
            删除
          </button>
        </div>
      </section>

      <!-- 10. External Proxy Tool -->
      <section v-else-if="currentTool === 'external'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">外部代理 (External Proxy / Upstream)</h2>
          <label class="check">
            <input v-model="rules.externalProxy.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用上游外部代理</strong>
          </label>
        </div>
        <p class="page-desc">将 Flowman 截获的流量再向上转发给企业代理、Charles、Fiddler 或科学上网客户端。</p>

        <div class="form-grid">
          <div class="field">
            <label>代理协议</label>
            <select v-model="rules.externalProxy.protocol">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>
          <div class="field">
            <label>外部代理主机 (Host)</label>
            <input v-model="rules.externalProxy.host" type="text" placeholder="127.0.0.1" />
          </div>
          <div class="field">
            <label>外部代理端口 (Port)</label>
            <input v-model.number="rules.externalProxy.port" type="number" placeholder="7890" />
          </div>
        </div>

        <div style="margin-top: 18px;">
          <button class="primary" @click="persist">保存外部代理设置</button>
        </div>
      </section>

      <!-- 11. Throttle Tool -->
      <section v-else-if="currentTool === 'throttle'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="page-title">网络限速 (Network Throttling)</h2>
          <label class="check">
            <input v-model="rules.throttle.enabled" type="checkbox" @change="persist" />
            <strong style="color: var(--ink);">启用限速</strong>
          </label>
        </div>
        <p class="page-desc">模拟弱网环境，测试前端应用在网络高延迟或低带宽下的交互表现与超时恢复机制。</p>

        <div class="form-grid">
          <div class="field">
            <label>附加人工延迟 (Latency ms)</label>
            <input v-model.number="rules.throttle.latencyMs" type="number" placeholder="500" />
          </div>
          <div class="field">
            <label>下行速率 (Downstream KB/s, 0 为不限制)</label>
            <input v-model.number="rules.throttle.downloadKbps" type="number" placeholder="100" />
          </div>
        </div>

        <div style="margin-top: 18px;">
          <button class="primary" @click="persist">保存限速配置</button>
        </div>
      </section>

      <!-- 12. About Tool -->
      <section v-else-if="currentTool === 'about'">
        <h2 class="page-title">关于 Flowman</h2>
        <p class="page-desc">基于 Vue 3、TypeScript 与 Vite 现代架构构建的高性能本地 HTTP/HTTPS 调试代理工具。</p>

        <table class="kv" style="max-width: 600px; margin-top: 20px;">
          <tbody>
            <tr><td>版本号</td><td>1.0.0 (Vue 3 + TS + Vite)</td></tr>
            <tr><td>代理端口</td><td>{{ rules.port }}</td></tr>
            <tr><td>CA 证书位置</td><td><code>{{ proxyState?.caPath }}</code></td></tr>
            <tr><td>CA 指纹</td><td><code>{{ proxyState?.caFingerprint?.slice(0, 32) }}...</code></td></tr>
            <tr><td>架构优势</td><td>毫秒级 Vite HMR、完全类型安全、响应式 Composition API、高扩展性</td></tr>
          </tbody>
        </table>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, type Component } from 'vue';
import {
  ArrowLeft,
  Globe,
  Lock,
  CirclePause,
  FolderCode,
  ArrowLeftRight,
  CheckCircle2,
  Ban,
  Code2,
  RefreshCw,
  Plug,
  Gauge,
  Info,
  ShieldCheck,
  FolderOpen,
  Download,
  Plus,
  Trash2,
} from 'lucide-vue-next';
import { useProxyState } from '../composables/useProxyState';

const {
  rules,
  proxyState,
  currentTool,
  saveRules,
  setSystemProxy,
  installCa,
  revealCa,
  exportCa,
  selectFile,
  setView,
} = useProxyState();

interface ToolItem {
  id: string;
  name: string;
  icon: Component;
}

const toolsList: ToolItem[] = [
  { id: 'proxy', name: '代理设置', icon: Globe },
  { id: 'ssl', name: 'SSL 解密', icon: Lock },
  { id: 'breakpoint', name: '断点调试', icon: CirclePause },
  { id: 'mapLocal', name: '本地映射', icon: FolderCode },
  { id: 'mapRemote', name: '远程重定向', icon: ArrowLeftRight },
  { id: 'allow', name: '允许列表', icon: CheckCircle2 },
  { id: 'block', name: '阻止列表', icon: Ban },
  { id: 'script', name: '脚本引擎', icon: Code2 },
  { id: 'reverse', name: '反向代理', icon: RefreshCw },
  { id: 'external', name: '外部代理', icon: Plug },
  { id: 'throttle', name: '网络限速', icon: Gauge },
  { id: 'about', name: '关于说明', icon: Info },
];

async function persist() {
  if (!rules.value) return;
  await saveRules(rules.value);
}

async function toggleSysProxy() {
  if (!proxyState.value) return;
  await setSystemProxy(!proxyState.value.systemProxy);
}

// SSL
const newSslPattern = ref('');
async function addSslRule() {
  if (!newSslPattern.value || !rules.value) return;
  rules.value.ssl.include.push({
    id: `ssl_${Date.now()}`,
    enabled: true,
    pattern: newSslPattern.value.trim(),
  });
  newSslPattern.value = '';
  await persist();
}

async function removeSslRule(idx: number) {
  if (!rules.value) return;
  rules.value.ssl.include.splice(idx, 1);
  await persist();
}

// Breakpoints
const bpForm = reactive({
  name: '',
  method: '*',
  host: '*',
  path: '/*',
  phase: 'request' as 'request' | 'response' | 'both',
});

async function addBreakpointRule() {
  if (!rules.value) return;
  rules.value.breakpoints.rules.push({
    id: `bp_${Date.now()}`,
    enabled: true,
    name: bpForm.name || '未命名断点',
    method: bpForm.method,
    host: bpForm.host,
    path: bpForm.path,
    phase: bpForm.phase,
  });
  bpForm.name = '';
  await persist();
}

async function removeBreakpointRule(idx: number) {
  if (!rules.value) return;
  rules.value.breakpoints.rules.splice(idx, 1);
  await persist();
}

// Map Local
const mapLocalForm = reactive({
  host: '*',
  path: '/',
  file: '',
  status: 200,
});

async function pickMapLocalFile() {
  const chosen = await selectFile();
  if (chosen) mapLocalForm.file = chosen;
}

async function addMapLocalRule() {
  if (!rules.value || !mapLocalForm.file) return;
  rules.value.mapLocal.rules.push({
    id: `ml_${Date.now()}`,
    enabled: true,
    name: 'Map Local',
    method: '*',
    host: mapLocalForm.host,
    path: mapLocalForm.path,
    file: mapLocalForm.file,
    status: mapLocalForm.status,
  });
  await persist();
}

async function removeMapLocalRule(idx: number) {
  if (!rules.value) return;
  rules.value.mapLocal.rules.splice(idx, 1);
  await persist();
}

// Map Remote
const mapRemoteForm = reactive({
  host: '*',
  path: '/*',
  targetUrl: '',
});

async function addMapRemoteRule() {
  if (!rules.value || !mapRemoteForm.targetUrl) return;
  rules.value.mapRemote.rules.push({
    id: `mr_${Date.now()}`,
    enabled: true,
    name: 'Map Remote',
    method: '*',
    host: mapRemoteForm.host,
    path: mapRemoteForm.path,
    targetUrl: mapRemoteForm.targetUrl,
  });
  await persist();
}

async function removeMapRemoteRule(idx: number) {
  if (!rules.value) return;
  rules.value.mapRemote.rules.splice(idx, 1);
  await persist();
}

// Allow List
const allowInput = ref('');
async function addAllowRule() {
  if (!rules.value || !allowInput.value) return;
  rules.value.allow.rules.push({
    id: `allow_${Date.now()}`,
    enabled: true,
    name: 'Allow Rule',
    method: '*',
    host: allowInput.value.trim(),
    path: '*',
  });
  allowInput.value = '';
  await persist();
}

async function removeAllowRule(idx: number) {
  if (!rules.value) return;
  rules.value.allow.rules.splice(idx, 1);
  await persist();
}

// Block List
const blockForm = reactive({
  host: '',
  path: '*',
  status: 403,
});

async function addBlockRule() {
  if (!rules.value || !blockForm.host) return;
  rules.value.block.rules.push({
    id: `block_${Date.now()}`,
    enabled: true,
    name: 'Block Rule',
    method: '*',
    host: blockForm.host.trim(),
    path: blockForm.path.trim(),
    action: 'block',
    status: blockForm.status,
  });
  blockForm.host = '';
  await persist();
}

async function removeBlockRule(idx: number) {
  if (!rules.value) return;
  rules.value.block.rules.splice(idx, 1);
  await persist();
}

// Scripting
const scriptForm = reactive({
  name: '',
  code: `function onResponse(request, response) {
  // 修改返回数据
  // response.body = JSON.stringify({ custom: true });
  return response;
}`,
});

async function addScript() {
  if (!rules.value || !scriptForm.name) return;
  rules.value.scripts.items.push({
    id: `sc_${Date.now()}`,
    enabled: true,
    name: scriptForm.name,
    code: scriptForm.code,
  });
  scriptForm.name = '';
  await persist();
}

async function removeScript(idx: number) {
  if (!rules.value) return;
  rules.value.scripts.items.splice(idx, 1);
  await persist();
}

// Reverse Proxy
const reverseForm = reactive({
  listenPort: 8080,
  targetUrl: '',
});

async function addReverseRule() {
  if (!rules.value || !reverseForm.targetUrl) return;
  rules.value.reverseProxies.push({
    id: `rev_${Date.now()}`,
    enabled: true,
    listenPort: reverseForm.listenPort,
    targetUrl: reverseForm.targetUrl,
  });
  await persist();
}

async function removeReverseRule(idx: number) {
  if (!rules.value) return;
  rules.value.reverseProxies.splice(idx, 1);
  await persist();
}
</script>
