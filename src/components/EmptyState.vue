<template>
  <div class="empty">
    <Globe :size="42" color="var(--blue)" style="margin-bottom: 12px; opacity: 0.85;" />
    <strong>等待网络流量中...</strong>
    <p>
      代理监听端口: <code>{{ proxyState?.port || 9001 }}</code>。
      <span v-if="proxyState?.systemProxy">系统代理已自动启用。</span>
      <span v-else>系统代理未接管，你可以手动配置代理或使用内置受控调试浏览器。</span>
    </p>
    <div class="actions">
      <button class="primary" @click="openBrowser()">
        <Compass :size="14" />
        打开调试浏览器
      </button>
      <button @click="toggleSystemProxy">
        <ShieldCheck :size="14" />
        {{ proxyState?.systemProxy ? '关闭系统代理' : '开启系统代理' }}
      </button>
      <button @click="installCa">
        <Lock :size="14" />
        安装 CA 证书
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Globe, Compass, ShieldCheck, Lock } from 'lucide-vue-next';
import { useProxyState } from '../composables/useProxyState';

const {
  proxyState,
  openBrowser,
  setSystemProxy,
  installCa,
} = useProxyState();

async function toggleSystemProxy() {
  if (!proxyState.value) return;
  await setSystemProxy(!proxyState.value.systemProxy);
}
</script>
