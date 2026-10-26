<template>
  <div v-if="isSettingsOpen" class="modal-overlay" @click.self="closeSettings">
    <div class="settings-modal-window" role="dialog" aria-modal="true">
      <!-- Modal Header -->
      <div class="settings-modal-header">
        <div class="settings-header-title-group">
          <div class="settings-header-icon">
            <Sliders :size="18" />
          </div>
          <div>
            <h3 class="settings-modal-title">偏好设置与工具箱</h3>
            <span class="settings-modal-subtitle">全局外观主题、网络代理与调试规则配置中心</span>
          </div>
        </div>
        <button class="settings-close-btn" @click="closeSettings" title="关闭设置 (Esc)">
          <X :size="16" />
        </button>
      </div>

      <!-- Modal Body (Left-Right Layout: 左侧功能菜单，右侧主体内容) -->
      <div class="settings-modal-body">
        <!-- Left: Feature Menu (功能菜单) -->
        <nav class="settings-modal-sidebar">
          <div class="settings-nav-groups">
            <div
              v-for="group in menuGroups"
              :key="group.id"
              class="settings-menu-group"
            >
              <div class="settings-group-title">{{ group.name }}</div>
              <button
                v-for="item in group.items"
                :key="item.id"
                class="settings-menu-item"
                :class="{ active: activeTab === item.id }"
                @click="activeTab = item.id"
              >
                <component :is="item.icon" :size="15" class="menu-icon" />
                <span class="menu-label">{{ item.name }}</span>
              </button>
            </div>
          </div>
        </nav>

        <!-- Right: Main Content (主体内容) -->
        <main class="settings-modal-content" v-if="rules">
          <!-- 1. 外观与主题 (Appearance) -->
          <section v-if="activeTab === 'appearance'">
            <h2 class="page-title">外观与主题 (Appearance)</h2>
            <p class="page-desc">自定义 Flowman 外观模式（跟随系统、浅色、深色）以及系统强调色。</p>

            <div class="section-block">
              <h4 class="section-title">主题外观模式</h4>
              <p class="section-desc">支持跟随操作系统外观自动切换，或固定使用浅色/深色主题。</p>

              <div class="theme-cards-grid">
                <!-- 跟随系统 -->
                <div
                  class="theme-card"
                  :class="{ active: themeMode === 'system' }"
                  @click="setTheme('system')"
                >
                  <div class="theme-preview system-preview">
                    <div class="mock-header">
                      <span class="mock-dots" />
                      <span class="mock-bar" />
                    </div>
                    <div class="mock-body">
                      <div class="mock-sidebar" />
                      <div class="mock-content">
                        <div class="mock-line" />
                        <div class="mock-line short" />
                        <div class="mock-line active" />
                      </div>
                    </div>
                  </div>
                  <div class="theme-info">
                    <div class="theme-label-row">
                      <Laptop :size="15" class="theme-icon" />
                      <strong>跟随系统</strong>
                      <span v-if="themeMode === 'system'" class="theme-active-tag">
                        {{ systemPrefersDark ? '深色' : '浅色' }}
                      </span>
                    </div>
                    <p class="theme-sub">根据操作系统自动切换深浅色</p>
                  </div>
                </div>

                <!-- 浅色模式 -->
                <div
                  class="theme-card"
                  :class="{ active: themeMode === 'light' }"
                  @click="setTheme('light')"
                >
                  <div class="theme-preview light-preview">
                    <div class="mock-header">
                      <span class="mock-dots" />
                      <span class="mock-bar" />
                    </div>
                    <div class="mock-body">
                      <div class="mock-sidebar" />
                      <div class="mock-content">
                        <div class="mock-line" />
                        <div class="mock-line short" />
                        <div class="mock-line active" />
                      </div>
                    </div>
                  </div>
                  <div class="theme-info">
                    <div class="theme-label-row">
                      <Sun :size="15" class="theme-icon" />
                      <strong>浅色模式</strong>
                      <span v-if="themeMode === 'light'" class="theme-active-tag">已启用</span>
                    </div>
                    <p class="theme-sub">明亮清晰，经典 Proxyman 界面</p>
                  </div>
                </div>

                <!-- 深色模式 -->
                <div
                  class="theme-card"
                  :class="{ active: themeMode === 'dark' }"
                  @click="setTheme('dark')"
                >
                  <div class="theme-preview dark-preview">
                    <div class="mock-header">
                      <span class="mock-dots" />
                      <span class="mock-bar" />
                    </div>
                    <div class="mock-body">
                      <div class="mock-sidebar" />
                      <div class="mock-content">
                        <div class="mock-line" />
                        <div class="mock-line short" />
                        <div class="mock-line active" />
                      </div>
                    </div>
                  </div>
                  <div class="theme-info">
                    <div class="theme-label-row">
                      <Moon :size="15" class="theme-icon" />
                      <strong>深色模式</strong>
                      <span v-if="themeMode === 'dark'" class="theme-active-tag">已启用</span>
                    </div>
                    <p class="theme-sub">低眩光暗色界面，沉浸夜间护眼</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="section-block" style="margin-top: 24px;">
              <h4 class="section-title">主题强调色 (Accent Color)</h4>
              <p class="section-desc">自定义操作按钮、激活选项卡与行选中高亮的核心主色调。</p>
              <div class="accent-swatches-grid">
                <button
                  v-for="item in accents"
                  :key="item.id"
                  class="accent-swatch"
                  :class="{ active: accentColor === item.id }"
                  @click="setAccent(item.id)"
                >
                  <span class="accent-dot" :style="{ background: item.color }" />
                  <span class="accent-name">{{ item.name }}</span>
                  <Check v-if="accentColor === item.id" :size="14" class="accent-check" />
                </button>
              </div>
            </div>
          </section>

          <!-- 2. 界面与布局 (Interface) -->
          <section v-else-if="activeTab === 'interface'">
            <h2 class="page-title">界面与布局 (Interface)</h2>
            <p class="page-desc">设置抓包主界面的详情检查器停靠方式、表格紧凑度和滚动行为。</p>

            <div class="section-block">
              <h4 class="section-title">检查器面板布局 (Inspector Dock)</h4>
              <p class="section-desc">选择流量详情检查器停靠在表格底部或右侧。</p>
              <div class="segment-group">
                <button
                  class="segment-opt"
                  :class="{ active: dock === 'bottom' }"
                  @click="setDock('bottom')"
                >
                  <Rows2 :size="15" />
                  <span>底部停靠 (Bottom Dock)</span>
                </button>
                <button
                  class="segment-opt"
                  :class="{ active: dock === 'right' }"
                  @click="setDock('right')"
                >
                  <Columns2 :size="15" />
                  <span>右侧停靠 (Right Dock)</span>
                </button>
              </div>
            </div>

            <div class="section-block" style="margin-top: 24px;">
              <h4 class="section-title">表格与列表显示</h4>
              <div class="setting-toggle-row">
                <div class="toggle-text">
                  <strong>紧凑模式 (Compact Mode)</strong>
                  <p>减小抓包列表每行单元格内边距与字体大小，一屏容纳更多请求。</p>
                </div>
                <label class="switch">
                  <input
                    type="checkbox"
                    :checked="isCompact"
                    @change="setCompact(!isCompact)"
                  />
                  <span class="slider round" />
                </label>
              </div>

              <div class="setting-toggle-row">
                <div class="toggle-text">
                  <strong>实时流量自动滚动到底部</strong>
                  <p>持续抓包时，新接收的网络请求将自动滚动并展示在最底端。</p>
                </div>
                <label class="switch">
                  <input
                    type="checkbox"
                    :checked="autoScroll"
                    @change="setAutoScroll(!autoScroll)"
                  />
                  <span class="slider round" />
                </label>
              </div>
            </div>
          </section>

          <!-- 3. 快捷按键 (Shortcuts) -->
          <section v-else-if="activeTab === 'shortcuts'">
            <h2 class="page-title">快捷按键指南 (Shortcuts)</h2>
            <p class="page-desc">使用快捷键能够大幅提高日常接口抓包与断点调试效率。</p>

            <table class="shortcuts-table">
              <thead>
                <tr>
                  <th style="width: 220px;">操作功能</th>
                  <th style="width: 200px;">快捷键</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>偏好设置</strong></td>
                  <td><kbd>⌘</kbd> <kbd>,</kbd></td>
                  <td>打开或关闭本设置与工具弹窗</td>
                </tr>
                <tr>
                  <td><strong>工具箱</strong></td>
                  <td><kbd>⌘</kbd> <kbd>T</kbd></td>
                  <td>直接打开设置中的代理与规则工具</td>
                </tr>
                <tr>
                  <td><strong>新建请求 (Compose)</strong></td>
                  <td><kbd>⌘</kbd> <kbd>N</kbd></td>
                  <td>打开自定义 HTTP 请求构建器</td>
                </tr>
                <tr>
                  <td><strong>清除所有抓包会话</strong></td>
                  <td><kbd>⇧</kbd> <kbd>⌘</kbd> <kbd>⌫</kbd></td>
                  <td>清空抓包列表全部记录</td>
                </tr>
                <tr>
                  <td><strong>上 / 下切换请求</strong></td>
                  <td><kbd>↑</kbd> / <kbd>↓</kbd></td>
                  <td>在抓包列表中快速选择上一个或下一个请求</td>
                </tr>
                <tr>
                  <td><strong>关闭弹窗</strong></td>
                  <td><kbd>Esc</kbd></td>
                  <td>退出设置弹窗或断点拦截弹窗</td>
                </tr>
              </tbody>
            </table>
          </section>

          <!-- 4. 代理服务设置 (Proxy Server) -->
          <section v-else-if="activeTab === 'proxy'">
            <h2 class="page-title">代理服务设置 (Proxy Server)</h2>
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

          <!-- 5. SSL 解密 (SSL Proxying) -->
          <section v-else-if="activeTab === 'ssl'">
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
                style="flex: 1; height: 32px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--ink); border-radius: 7px; padding: 0 10px;"
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

          <!-- 6. 网络限速 (Throttle) -->
          <section v-else-if="activeTab === 'throttle'">
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

          <!-- 7. 外部代理 (External Proxy) -->
          <section v-else-if="activeTab === 'external'">
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

          <!-- 8. 断点拦截 (Breakpoints) -->
          <section v-else-if="activeTab === 'breakpoint'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 class="page-title">断点拦截 (Breakpoints)</h2>
              <label class="check">
                <input v-model="rules.breakpoints.enabled" type="checkbox" @change="persist" />
                <strong style="color: var(--ink);">启用断点拦截</strong>
              </label>
            </div>
            <p class="page-desc">在请求发往后端之前或响应返回前端之前暂停请求，支持查看并实时修改数据。</p>

            <!-- Add Rule Form -->
            <div class="form-grid" style="background: var(--bg-subtle); padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
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
                <input v-model="bpForm.path" type="text" placeholder="/*" />
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

            <div v-for="(rule, idx) in rules.breakpoints.rules" :key="rule.id" class="rule-card">
              <input v-model="rule.enabled" type="checkbox" @change="persist" />
              <div class="rule-info">
                <strong>{{ rule.name || '未命名断点' }}</strong>
                <code>[{{ rule.phase }}] {{ rule.method }} {{ rule.host }}{{ rule.path }}</code>
              </div>
              <button class="danger" @click="removeBreakpointRule(idx)">
                <Trash2 :size="12" />
                删除
              </button>
            </div>
          </section>

          <!-- 9. 本地映射 (Map Local) -->
          <section v-else-if="activeTab === 'mapLocal'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 class="page-title">本地映射 (Map Local)</h2>
              <label class="check">
                <input v-model="rules.mapLocal.enabled" type="checkbox" @change="persist" />
                <strong style="color: var(--ink);">启用本地映射</strong>
              </label>
            </div>
            <p class="page-desc">将匹配的远程请求直接劫持并返回本地文件内容，无需修改前端代码即可 Mock 接口。</p>

            <div class="form-grid" style="background: var(--bg-subtle); padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
              <div class="field">
                <label>匹配 Host (域名)</label>
                <input v-model="mapLocalForm.host" type="text" placeholder="api.example.com 或 *" />
              </div>
              <div class="field">
                <label>匹配 Path (路径)</label>
                <input v-model="mapLocalForm.path" type="text" placeholder="/v1/users" />
              </div>
              <div class="field wide">
                <label>本地响应内容文件</label>
                <div style="display: flex; gap: 8px;">
                  <input v-model="mapLocalForm.file" type="text" placeholder="请选择本地文件路径..." style="flex: 1;" />
                  <button @click="pickMapLocalFile">
                    <FolderOpen :size="13" />
                    选择文件
                  </button>
                </div>
              </div>
              <div class="field">
                <label>HTTP 状态码</label>
                <input v-model.number="mapLocalForm.status" type="number" placeholder="200" />
              </div>
              <div class="field" style="justify-content: flex-end;">
                <button class="primary" @click="addMapLocalRule">
                  <Plus :size="13" />
                  添加本地映射规则
                </button>
              </div>
            </div>

            <div v-for="(rule, idx) in rules.mapLocal.rules" :key="rule.id" class="rule-card">
              <input v-model="rule.enabled" type="checkbox" @change="persist" />
              <div class="rule-info">
                <strong>{{ rule.host }}{{ rule.path }}</strong>
                <code>-> {{ rule.file }} ({{ rule.status }})</code>
              </div>
              <button class="danger" @click="removeMapLocalRule(idx)">
                <Trash2 :size="12" />
                删除
              </button>
            </div>
          </section>

          <!-- 10. 远程重定向 (Map Remote) -->
          <section v-else-if="activeTab === 'mapRemote'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 class="page-title">远程重定向 (Map Remote)</h2>
              <label class="check">
                <input v-model="rules.mapRemote.enabled" type="checkbox" @change="persist" />
                <strong style="color: var(--ink);">启用远程重定向</strong>
              </label>
            </div>
            <p class="page-desc">透明地将发往线上/测试域名的请求重定向到指定的目标服务器或开发机。</p>

            <div class="form-grid" style="background: var(--bg-subtle); padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
              <div class="field">
                <label>源域名 (Source Host)</label>
                <input v-model="mapRemoteForm.host" type="text" placeholder="api.prod.com 或 *" />
              </div>
              <div class="field">
                <label>源路径 (Source Path)</label>
                <input v-model="mapRemoteForm.path" type="text" placeholder="/*" />
              </div>
              <div class="field wide">
                <label>重定向目标完整 URL</label>
                <input v-model="mapRemoteForm.targetUrl" type="text" placeholder="http://127.0.0.1:8080/api/mock" />
              </div>
              <div class="field wide" style="display: flex; justify-content: flex-end;">
                <button class="primary" @click="addMapRemoteRule">
                  <Plus :size="13" />
                  添加重定向规则
                </button>
              </div>
            </div>

            <div v-for="(rule, idx) in rules.mapRemote.rules" :key="rule.id" class="rule-card">
              <input v-model="rule.enabled" type="checkbox" @change="persist" />
              <div class="rule-info">
                <strong>{{ rule.host }}{{ rule.path }}</strong>
                <code>-> {{ rule.targetUrl }}</code>
              </div>
              <button class="danger" @click="removeMapRemoteRule(idx)">
                <Trash2 :size="12" />
                删除
              </button>
            </div>
          </section>

          <!-- 11. 脚本引擎 (Scripting) -->
          <section v-else-if="activeTab === 'script'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 class="page-title">动态脚本引擎 (Scripting)</h2>
              <label class="check">
                <input v-model="rules.scripts.enabled" type="checkbox" @change="persist" />
                <strong style="color: var(--ink);">启用脚本引擎</strong>
              </label>
            </div>
            <p class="page-desc">
              使用 JavaScript 编写动态脚本，在 <code>onResponse(request, response)</code> 中实时改写请求头、参数与 Body。
            </p>

            <div class="form-grid" style="background: var(--bg-subtle); padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
              <div class="field wide">
                <label>脚本规则名称</label>
                <input v-model="scriptForm.name" type="text" placeholder="例如: 模拟错误返回" />
              </div>
              <div class="field wide">
                <label>JavaScript 脚本逻辑</label>
                <textarea
                  v-model="scriptForm.code"
                  rows="8"
                  style="font-family: var(--font-mono); font-size: 12px; margin-top: 6px;"
                />
              </div>
              <div class="field wide" style="display: flex; justify-content: flex-end;">
                <button class="primary" @click="addScript">
                  <Plus :size="13" />
                  添加脚本规则
                </button>
              </div>
            </div>

            <div v-for="(rule, idx) in rules.scripts.items" :key="rule.id" class="rule-card">
              <input v-model="rule.enabled" type="checkbox" @change="persist" />
              <div class="rule-info">
                <strong>{{ rule.name }}</strong>
                <code>{{ rule.code.slice(0, 80) }}...</code>
              </div>
              <button class="danger" @click="removeScript(idx)">
                <Trash2 :size="12" />
                删除
              </button>
            </div>
          </section>

          <!-- 12. 反向代理 (Reverse Proxy) -->
          <section v-else-if="activeTab === 'reverse'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 class="page-title">反向代理 (Reverse Proxy)</h2>
            </div>
            <p class="page-desc">在独立端口启动本地 HTTP 反向代理，将访问该端口的所有流量透明转发至目标服务器。</p>

            <div class="form-grid" style="background: var(--bg-subtle); padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
              <div class="field">
                <label>本地监听端口</label>
                <input v-model.number="reverseForm.listenPort" type="number" placeholder="8080" />
              </div>
              <div class="field">
                <label>目标转发地址 (Target URL)</label>
                <input v-model="reverseForm.targetUrl" type="text" placeholder="https://api.github.com" />
              </div>
              <div class="field wide" style="display: flex; justify-content: flex-end;">
                <button class="primary" @click="addReverseRule">
                  <Plus :size="13" />
                  添加反向代理规则
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

          <!-- 13. 允许列表 (Allow List) -->
          <section v-else-if="activeTab === 'allow'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 class="page-title">允许列表 (Allow List)</h2>
              <label class="check">
                <input v-model="rules.allow.enabled" type="checkbox" @change="persist" />
                <strong style="color: var(--ink);">启用允许列表</strong>
              </label>
            </div>
            <p class="page-desc">开启后将只捕获与记录列表中匹配的请求，其他请求将直接放行且不记录。</p>

            <div style="display: flex; gap: 8px; margin-bottom: 14px;">
              <input v-model="allowInput" type="text" placeholder="域名通配符 (如: *.github.com)" style="flex: 1; height: 32px; border-radius: 7px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--ink); padding: 0 10px;" />
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

          <!-- 14. 阻止列表 (Block List) -->
          <section v-else-if="activeTab === 'block'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 class="page-title">阻止列表 (Block List)</h2>
              <label class="check">
                <input v-model="rules.block.enabled" type="checkbox" @change="persist" />
                <strong style="color: var(--ink);">启用阻止列表</strong>
              </label>
            </div>
            <p class="page-desc">直接阻断匹配的广告、跟踪器或恶意请求，并返回指定的 HTTP 状态码。</p>

            <div class="form-grid" style="background: var(--bg-subtle); padding: 14px; border-radius: 10px; border: 1px solid var(--line);">
              <div class="field">
                <label>拦截域名 Host</label>
                <input v-model="blockForm.host" type="text" placeholder="*ads*.com" />
              </div>
              <div class="field">
                <label>返回 HTTP 状态码</label>
                <select v-model.number="blockForm.status">
                  <option :value="403">403 Forbidden</option>
                  <option :value="404">404 Not Found</option>
                  <option :value="500">500 Server Error</option>
                </select>
              </div>
              <div class="field wide" style="display: flex; justify-content: flex-end;">
                <button class="primary" @click="addBlockRule">
                  <Plus :size="13" />
                  添加阻止规则
                </button>
              </div>
            </div>

            <div v-for="(rule, idx) in rules.block.rules" :key="rule.id" class="rule-card">
              <input v-model="rule.enabled" type="checkbox" @change="persist" />
              <div class="rule-info">
                <strong>{{ rule.host }}</strong>
                <code>返回状态: {{ rule.status }}</code>
              </div>
              <button class="danger" @click="removeBlockRule(idx)">
                <Trash2 :size="12" />
                删除
              </button>
            </div>
          </section>

          <!-- 15. 关于 Flowman (About) -->
          <section v-else-if="activeTab === 'about'">
            <div class="about-card">
              <div class="about-logo">
                <Activity :size="32" color="var(--blue)" />
              </div>
              <div class="about-info">
                <h3>Flowman</h3>
                <p class="about-version">版本 1.0.0 (Build 2026.10)</p>
                <p class="about-desc">
                  现代化的本地 HTTP/HTTPS 调试代理工具。采用 Vue 3、TypeScript 与 Vite 现代架构实现，完整集成 SSL 解密、断点拦截、本地映射与脚本引擎。
                </p>
                <div class="about-badges">
                  <span class="tag">Vue 3.5</span>
                  <span class="tag">Vite 8</span>
                  <span class="tag">Electron 33</span>
                  <span class="tag">TypeScript 5.9</span>
                </div>
              </div>
            </div>

            <div style="margin-top: 24px;">
              <h4 style="margin: 0 0 10px; font-size: 14px;">环境运行状态</h4>
              <table class="kv" style="max-width: 600px;">
                <tbody>
                  <tr><td>当前代理端口</td><td><code>{{ proxyState?.port || 9001 }}</code></td></tr>
                  <tr><td>系统代理状态</td><td>{{ proxyState?.systemProxy ? '已接管 macOS 网络' : '未启用' }}</td></tr>
                  <tr><td>CA 根证书指纹</td><td><code>{{ proxyState?.caFingerprint || '未生成' }}</code></td></tr>
                  <tr><td>架构设计</td><td>Vue 3 + TS + Vite + Electron (双进程模型)</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      <!-- Modal Footer -->
      <div class="settings-modal-footer">
        <span class="settings-footer-tip">
          提示: 你可以随时按 <kbd>⌘</kbd> <kbd>,</kbd> 打开设置，按 <kbd>Esc</kbd> 关闭
        </span>
        <button class="primary" @click="closeSettings">
          完成
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, type Component } from 'vue';
import {
  Palette,
  Sliders,
  Keyboard,
  Globe,
  Lock,
  Gauge,
  Plug,
  CirclePause,
  FolderCode,
  ArrowLeftRight,
  Code2,
  RefreshCw,
  CheckCircle2,
  Ban,
  Info,
  Laptop,
  Sun,
  Moon,
  Check,
  Rows2,
  Columns2,
  ShieldCheck,
  FolderOpen,
  Download,
  Plus,
  Trash2,
  Activity,
  X,
} from 'lucide-vue-next';
import { useProxyState } from '../composables/useProxyState';
import { useSettings, type AccentColor, type SettingsTab } from '../composables/useSettings';
import { useFlows } from '../composables/useFlows';

const {
  rules,
  proxyState,
  saveRules,
  setSystemProxy,
  installCa,
  revealCa,
  exportCa,
  selectFile,
} = useProxyState();

const {
  themeMode,
  accentColor,
  systemPrefersDark,
  isCompact,
  autoScroll,
  isSettingsOpen,
  activeTab,
  setTheme,
  setAccent,
  setCompact,
  setAutoScroll,
  closeSettings,
} = useSettings();

const { dock, setDock } = useFlows();

// Category grouped navigation
interface MenuItem {
  id: SettingsTab;
  name: string;
  icon: Component;
}

interface MenuGroup {
  id: string;
  name: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    id: 'general',
    name: '基础偏好',
    items: [
      { id: 'appearance', name: '外观与主题', icon: Palette },
      { id: 'interface', name: '界面与布局', icon: Sliders },
      { id: 'shortcuts', name: '快捷按键', icon: Keyboard },
    ],
  },
  {
    id: 'network',
    name: '代理与网络',
    items: [
      { id: 'proxy', name: '代理服务', icon: Globe },
      { id: 'ssl', name: 'SSL 解密', icon: Lock },
      { id: 'throttle', name: '网络限速', icon: Gauge },
      { id: 'external', name: '外部代理', icon: Plug },
    ],
  },
  {
    id: 'rules',
    name: '规则与调试',
    items: [
      { id: 'breakpoint', name: '断点拦截', icon: CirclePause },
      { id: 'mapLocal', name: '本地映射', icon: FolderCode },
      { id: 'mapRemote', name: '远程重定向', icon: ArrowLeftRight },
      { id: 'script', name: '脚本引擎', icon: Code2 },
      { id: 'reverse', name: '反向代理', icon: RefreshCw },
      { id: 'allow', name: '允许列表', icon: CheckCircle2 },
      { id: 'block', name: '阻止列表', icon: Ban },
    ],
  },
  {
    id: 'info',
    name: '软件信息',
    items: [
      { id: 'about', name: '关于 Flowman', icon: Info },
    ],
  },
];

const accents: { id: AccentColor; name: string; color: string }[] = [
  { id: 'blue', name: '经典蓝', color: '#0a64d8' },
  { id: 'green', name: '翡翠绿', color: '#10b981' },
  { id: 'purple', name: '极光紫', color: '#8b5cf6' },
  { id: 'orange', name: '琥珀橙', color: '#f59e0b' },
  { id: 'rose', name: '玫瑰红', color: '#f43f5e' },
];

async function persist() {
  if (!rules.value) return;
  await saveRules(rules.value);
}

async function toggleSysProxy() {
  if (!proxyState.value) return;
  await setSystemProxy(!proxyState.value.systemProxy);
}

// SSL Rules
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
  mapLocalForm.file = '';
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
  mapRemoteForm.targetUrl = '';
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
  code: `function onResponse(request, response) {\n  // 修改返回数据\n  // response.body = JSON.stringify({ custom: true });\n  return response;\n}`,
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
  reverseForm.targetUrl = '';
  await persist();
}

async function removeReverseRule(idx: number) {
  if (!rules.value) return;
  rules.value.reverseProxies.splice(idx, 1);
  await persist();
}
</script>
