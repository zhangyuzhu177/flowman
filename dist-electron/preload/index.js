let electron = require("electron");
// electron/preload/index.ts
electron.contextBridge.exposeInMainWorld("flowman", {
	getState: () => electron.ipcRenderer.invoke("state"),
	setRecording: (value) => electron.ipcRenderer.invoke("recording", value),
	clear: () => electron.ipcRenderer.invoke("clear"),
	getRules: () => electron.ipcRenderer.invoke("rules:get"),
	saveRules: (rules) => electron.ipcRenderer.invoke("rules:save", rules),
	listFlows: () => electron.ipcRenderer.invoke("flows"),
	getFlow: (id) => electron.ipcRenderer.invoke("flow", id),
	search: (query) => electron.ipcRenderer.invoke("search", query),
	exportHar: () => electron.ipcRenderer.invoke("export-har"),
	exportCa: () => electron.ipcRenderer.invoke("export-ca"),
	installCa: () => electron.ipcRenderer.invoke("install-ca"),
	revealCa: () => electron.ipcRenderer.invoke("reveal-ca"),
	repeat: (id) => electron.ipcRenderer.invoke("repeat", id),
	compose: (payload) => electron.ipcRenderer.invoke("compose", payload),
	resolveBreak: (payload) => electron.ipcRenderer.invoke("break:resolve", payload),
	setSystemProxy: (enabled) => electron.ipcRenderer.invoke("system-proxy", enabled),
	openBrowser: (url) => electron.ipcRenderer.invoke("browser", url),
	selectFile: () => electron.ipcRenderer.invoke("select-file"),
	highlight: (id, color) => electron.ipcRenderer.invoke("highlight", {
		id,
		color
	}),
	onFlow: (callback) => {
		const handler = (_event, flow) => callback(flow);
		electron.ipcRenderer.on("flow", handler);
		return () => electron.ipcRenderer.off("flow", handler);
	},
	onFlowUpdate: (callback) => {
		const handler = (_event, flow) => callback(flow);
		electron.ipcRenderer.on("flow-update", handler);
		return () => electron.ipcRenderer.off("flow-update", handler);
	},
	onBreak: (callback) => {
		const handler = (_event, data) => callback(data);
		electron.ipcRenderer.on("breakpoint", handler);
		return () => electron.ipcRenderer.off("breakpoint", handler);
	},
	onStatus: (callback) => {
		const handler = (_event, data) => callback(data);
		electron.ipcRenderer.on("status", handler);
		return () => electron.ipcRenderer.off("status", handler);
	},
	onCleared: (callback) => {
		const handler = () => callback();
		electron.ipcRenderer.on("cleared", handler);
		return () => electron.ipcRenderer.off("cleared", handler);
	},
	onMenu: (callback) => {
		const handler = (_event, action) => callback(action);
		electron.ipcRenderer.on("menu", handler);
		return () => electron.ipcRenderer.off("menu", handler);
	}
});
