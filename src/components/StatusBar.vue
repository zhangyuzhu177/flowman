<template>
  <footer class="status-bar">
    <div class="status-item">
      <span class="dot" :class="{ on: proxyState?.running }" />
      <span>代理监听: <strong>{{ proxyState?.port || 9001 }}</strong></span>
    </div>

    <div class="status-item">
      <span>会话流: {{ visibleFlows.length }} / {{ flows.length }}</span>
    </div>

    <div class="status-item">
      <span>SSL 解密: <strong>{{ rules?.ssl.enabled ? '已启用' : '已关闭' }}</strong></span>
    </div>

    <div class="status-item">
      <span>系统代理: </span>
      <span
        class="status-link"
        @click="toggleSysProxy"
        :title="proxyState?.systemProxy ? '点击关闭系统代理' : '点击开启系统代理'"
      >
        <strong>{{ proxyState?.systemProxy ? '已接管 (点击关闭)' : '未启用 (点击开启)' }}</strong>
      </span>
    </div>

    <div class="spacer" />

    <div class="status-item">
      <span class="status-link" @click="installCa" title="安装 Flowman CA 根证书至系统钥匙串">
        安装 CA 证书
      </span>
      <span>|</span>
      <span class="status-link" @click="revealCa" title="在访达中显示 CA 证书文件">
        定位证书
      </span>
      <span>|</span>
      <span class="status-link" @click="exportHar" title="将抓包记录导出为 HAR 1.2 标准文件">
        导出 HAR
      </span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useProxyState } from '../composables/useProxyState';
import { useFlows } from '../composables/useFlows';

const {
  proxyState,
  rules,
  setSystemProxy,
  installCa,
  revealCa,
  exportHar,
} = useProxyState();

const { flows, visibleFlows } = useFlows();

async function toggleSysProxy() {
  if (!proxyState.value) return;
  await setSystemProxy(!proxyState.value.systemProxy);
}
</script>
