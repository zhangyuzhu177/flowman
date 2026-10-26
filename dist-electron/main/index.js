// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
let electron = require("electron");
let fs = require("fs");
fs = __toESM(fs);
let http = require("http");
http = __toESM(http);
let path = require("path");
path = __toESM(path);
let crypto = require("crypto");
crypto = __toESM(crypto);
let node_forge = require("node-forge");
node_forge = __toESM(node_forge);
let https = require("https");
https = __toESM(https);
let net = require("net");
net = __toESM(net);
let tls = require("tls");
tls = __toESM(tls);
let zlib = require("zlib");
zlib = __toESM(zlib);
let events = require("events");
let url = require("url");
let vm = require("vm");
vm = __toESM(vm);
let child_process = require("child_process");
let os = require("os");
os = __toESM(os);
// electron/main/proxy/certs.ts
function keyPair() {
	const generated = crypto.default.generateKeyPairSync("rsa", { modulusLength: 2048 });
	return {
		privateKey: node_forge.default.pki.privateKeyFromPem(generated.privateKey.export({
			type: "pkcs1",
			format: "pem"
		})),
		publicKey: node_forge.default.pki.publicKeyFromPem(generated.publicKey.export({
			type: "pkcs1",
			format: "pem"
		}))
	};
}
function attributes(commonName) {
	return [
		{
			name: "commonName",
			value: commonName
		},
		{
			name: "organizationName",
			value: "Flowman"
		},
		{
			shortName: "OU",
			value: "Local Debugging"
		}
	];
}
function netIsIp(host) {
	return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}
var CertStore = class {
	constructor(directory) {
		this.caCert = null;
		this.caKey = null;
		this.caCertPem = "";
		this.caKeyPem = "";
		this.directory = directory;
		this.cache = /* @__PURE__ */ new Map();
	}
	load() {
		fs.default.mkdirSync(this.directory, { recursive: true });
		const certPath = path.default.join(this.directory, "ca-cert.pem");
		const keyPath = path.default.join(this.directory, "ca-key.pem");
		if (fs.default.existsSync(certPath) && fs.default.existsSync(keyPath)) {
			this.caCertPem = fs.default.readFileSync(certPath, "utf8");
			this.caKeyPem = fs.default.readFileSync(keyPath, "utf8");
			this.caCert = node_forge.default.pki.certificateFromPem(this.caCertPem);
			this.caKey = node_forge.default.pki.privateKeyFromPem(this.caKeyPem);
			return;
		}
		const keys = keyPair();
		const cert = node_forge.default.pki.createCertificate();
		cert.publicKey = keys.publicKey;
		cert.serialNumber = crypto.default.randomBytes(16).toString("hex");
		cert.validity.notBefore = /* @__PURE__ */ new Date();
		cert.validity.notAfter = /* @__PURE__ */ new Date();
		cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
		const subject = attributes("Flowman Local CA");
		cert.setSubject(subject);
		cert.setIssuer(subject);
		cert.setExtensions([
			{
				name: "basicConstraints",
				cA: true,
				critical: true
			},
			{
				name: "keyUsage",
				keyCertSign: true,
				cRLSign: true,
				digitalSignature: true,
				critical: true
			},
			{ name: "subjectKeyIdentifier" }
		]);
		cert.sign(keys.privateKey, node_forge.default.md.sha256.create());
		this.caCert = cert;
		this.caKey = keys.privateKey;
		this.caCertPem = node_forge.default.pki.certificateToPem(cert);
		this.caKeyPem = node_forge.default.pki.privateKeyToPem(keys.privateKey);
		fs.default.writeFileSync(certPath, this.caCertPem, { mode: 420 });
		fs.default.writeFileSync(keyPath, this.caKeyPem, { mode: 384 });
		fs.default.writeFileSync(path.default.join(this.directory, "ca-cert.der"), this.der(), { mode: 420 });
	}
	issue(host) {
		const normalized = String(host || "localhost").toLowerCase();
		if (this.cache.has(normalized)) return this.cache.get(normalized);
		if (!this.caCert || !this.caKey) this.load();
		const keys = keyPair();
		const cert = node_forge.default.pki.createCertificate();
		cert.publicKey = keys.publicKey;
		cert.serialNumber = crypto.default.randomBytes(16).toString("hex");
		cert.validity.notBefore = /* @__PURE__ */ new Date(Date.now() - 6e4);
		cert.validity.notAfter = /* @__PURE__ */ new Date();
		cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);
		cert.setSubject(attributes(normalized));
		cert.setIssuer(this.caCert.subject.attributes);
		const altNames = netIsIp(normalized) ? [{
			type: 7,
			ip: normalized
		}] : [{
			type: 2,
			value: normalized
		}];
		cert.setExtensions([
			{
				name: "basicConstraints",
				cA: false
			},
			{
				name: "keyUsage",
				digitalSignature: true,
				keyEncipherment: true,
				critical: true
			},
			{
				name: "extKeyUsage",
				serverAuth: true
			},
			{
				name: "subjectAltName",
				altNames
			},
			{ name: "subjectKeyIdentifier" }
		]);
		cert.sign(this.caKey, node_forge.default.md.sha256.create());
		const issued = {
			key: node_forge.default.pki.privateKeyToPem(keys.privateKey),
			cert: node_forge.default.pki.certificateToPem(cert)
		};
		this.cache.set(normalized, issued);
		return issued;
	}
	der() {
		if (!this.caCert) this.load();
		const asn1 = node_forge.default.pki.certificateToAsn1(this.caCert);
		const der = node_forge.default.asn1.toDer(asn1).getBytes();
		return Buffer.from(der, "binary");
	}
	fingerprint() {
		return crypto.default.createHash("sha256").update(this.der()).digest("hex").toUpperCase().replace(/(.{2})/g, "$1 ").trim();
	}
};
// electron/main/proxy/rules.ts
function createId(prefix) {
	return `${prefix}-${crypto.default.randomBytes(4).toString("hex")}`;
}
var DEFAULT_RULES = {
	port: 9001,
	noCaching: false,
	ssl: {
		enabled: true,
		ignoreUpstreamTls: false,
		include: [{
			id: "ssl-all",
			enabled: true,
			pattern: "*"
		}],
		exclude: []
	},
	allow: {
		enabled: false,
		rules: []
	},
	block: {
		enabled: false,
		rules: []
	},
	mapLocal: {
		enabled: false,
		rules: []
	},
	mapRemote: {
		enabled: false,
		rules: []
	},
	breakpoints: {
		enabled: false,
		rules: []
	},
	scripts: {
		enabled: false,
		items: []
	},
	reverseProxies: [],
	externalProxy: {
		enabled: false,
		protocol: "http",
		host: "",
		port: 8080
	},
	throttle: {
		enabled: false,
		latencyMs: 0,
		downloadKbps: 0
	},
	pins: []
};
function asBool(value, fallback) {
	return typeof value === "boolean" ? value : fallback;
}
function asNumber(value, fallback) {
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
}
function normalizeRule(rule, index) {
	const source = rule && typeof rule === "object" ? rule : {};
	return {
		id: typeof source.id === "string" && source.id ? source.id : createId(`rule${index}`),
		enabled: source.enabled !== false,
		name: String(source.name || "未命名规则"),
		method: String(source.method || "ANY").toUpperCase(),
		host: String(source.host || "*"),
		path: String(source.path || "*"),
		query: String(source.query || ""),
		action: source.action === "hide" ? "hide" : "block",
		status: asNumber(source.status, 403),
		file: String(source.file || ""),
		contentType: String(source.contentType || ""),
		targetUrl: String(source.targetUrl || ""),
		preserveHost: Boolean(source.preserveHost),
		phase: [
			"request",
			"response",
			"both"
		].includes(source.phase) ? source.phase : "both",
		code: typeof source.code === "string" ? source.code : "",
		listenPort: asNumber(source.listenPort, 0)
	};
}
function normalizeSslRule(rule, index) {
	const source = rule && typeof rule === "object" ? rule : {};
	return {
		id: typeof source.id === "string" && source.id ? source.id : createId(`ssl${index}`),
		enabled: source.enabled !== false,
		pattern: String(source.pattern || source.host || "*")
	};
}
function normalizeRules(input) {
	const source = input && typeof input === "object" ? input : {};
	const list = (value) => Array.isArray(value) ? value.map(normalizeRule) : [];
	const sslList = (value) => Array.isArray(value) ? value.map(normalizeSslRule) : [];
	return {
		port: Math.min(65535, Math.max(1, asNumber(source.port, DEFAULT_RULES.port))),
		noCaching: asBool(source.noCaching, false),
		ssl: {
			enabled: asBool(source.ssl && source.ssl.enabled, true),
			ignoreUpstreamTls: asBool(source.ssl && source.ssl.ignoreUpstreamTls, false),
			include: sslList(source.ssl && source.ssl.include).length ? sslList(source.ssl && source.ssl.include) : DEFAULT_RULES.ssl.include.map((item) => ({ ...item })),
			exclude: sslList(source.ssl && source.ssl.exclude)
		},
		allow: {
			enabled: asBool(source.allow && source.allow.enabled, false),
			rules: list(source.allow && source.allow.rules)
		},
		block: {
			enabled: asBool(source.block && source.block.enabled, false),
			rules: list(source.block && source.block.rules)
		},
		mapLocal: {
			enabled: asBool(source.mapLocal && source.mapLocal.enabled, false),
			rules: list(source.mapLocal && source.mapLocal.rules)
		},
		mapRemote: {
			enabled: asBool(source.mapRemote && source.mapRemote.enabled, false),
			rules: list(source.mapRemote && source.mapRemote.rules)
		},
		breakpoints: {
			enabled: asBool(source.breakpoints && source.breakpoints.enabled, false),
			rules: list(source.breakpoints && source.breakpoints.rules)
		},
		scripts: {
			enabled: asBool(source.scripts && source.scripts.enabled, false),
			items: Array.isArray(source.scripts && source.scripts.items) ? source.scripts.items.map((item, idx) => ({
				id: item.id || createId(`script${idx}`),
				enabled: item.enabled !== false,
				name: String(item.name || "未命名脚本"),
				code: typeof item.code === "string" ? item.code : ""
			})) : []
		},
		reverseProxies: Array.isArray(source.reverseProxies) ? source.reverseProxies.map((rule, idx) => ({
			id: rule.id || createId(`rev${idx}`),
			enabled: rule.enabled !== false,
			listenPort: asNumber(rule.listenPort, 0),
			targetUrl: String(rule.targetUrl || "")
		})).filter((rule) => rule.listenPort > 0) : [],
		externalProxy: {
			enabled: asBool(source.externalProxy && source.externalProxy.enabled, false),
			protocol: "http",
			host: String(source.externalProxy && source.externalProxy.host || ""),
			port: asNumber(source.externalProxy && source.externalProxy.port, 8080)
		},
		throttle: {
			enabled: asBool(source.throttle && source.throttle.enabled, false),
			latencyMs: Math.max(0, asNumber(source.throttle && source.throttle.latencyMs, 0)),
			downloadKbps: Math.max(0, asNumber(source.throttle && source.throttle.downloadKbps, 0))
		},
		pins: Array.isArray(source.pins) ? source.pins.map(String) : []
	};
}
function wildcardToRegExp(pattern) {
	const source = String(pattern || "*");
	if (source === "*") return /^.*$/i;
	const escaped = source.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
	return new RegExp(`^${escaped}$`, "i");
}
function matchPattern(pattern, value) {
	const parts = String(pattern || "*").split(",").map((item) => item.trim()).filter(Boolean);
	if (!parts.length) return true;
	return parts.some((part) => wildcardToRegExp(part).test(String(value || "")));
}
function requestMatches(rule, request) {
	if (!rule || rule.enabled === false) return false;
	if (rule.method && rule.method !== "ANY" && rule.method !== request.method) return false;
	if (!matchPattern(rule.host || "*", request.host)) return false;
	if (!matchPattern(rule.path || "*", request.path)) return false;
	if (rule.query) {
		const query = request.query || "";
		if (!query.includes(rule.query) && !matchPattern(rule.query, query)) return false;
	}
	return true;
}
function enabledRules(group) {
	if (!group || group.enabled === false) return [];
	return (group.rules || group.items || []).filter((rule) => rule.enabled !== false);
}
// electron/main/proxy/scripting.ts
function runHook(code, hook, request, response) {
	const context = vm.default.createContext({
		URL,
		URLSearchParams,
		console: {
			log() {},
			warn() {},
			error() {}
		}
	});
	new vm.default.Script(`${code}\n;this.__hook = (typeof ${hook} === "function") ? ${hook} : null;`).runInContext(context, { timeout: 150 });
	if (typeof context.__hook !== "function") return {
		skipped: true,
		value: hook === "onRequest" ? request : response
	};
	const value = context.__hook(request, response);
	return {
		skipped: false,
		value: value == null ? hook === "onRequest" ? request : response : value
	};
}
function applyScripts(items, hook, request, response) {
	let currentRequest = request;
	let currentResponse = response;
	const errors = [];
	for (const item of items) {
		if (!item || item.enabled === false || !item.code) continue;
		try {
			const result = runHook(item.code, hook, currentRequest, currentResponse);
			if (hook === "onRequest" && result.value && typeof result.value === "object") currentRequest = result.value;
			if (hook === "onResponse" && result.value && typeof result.value === "object") currentResponse = result.value;
		} catch (error) {
			errors.push(`${item.name || "脚本"}: ${error.message}`);
		}
	}
	return {
		request: currentRequest,
		response: currentResponse,
		errors
	};
}
// electron/main/proxy/engine.ts
var MAX_CAPTURE = 1048576;
var MAX_EDIT = 8388608;
var HOP = /* @__PURE__ */ new Set([
	"connection",
	"proxy-connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade"
]);
function listen(server, port) {
	return new Promise((resolve, reject) => {
		const onError = (error) => {
			server.off("listening", onListening);
			reject(error);
		};
		const onListening = () => {
			server.off("error", onError);
			resolve();
		};
		server.once("error", onError);
		server.once("listening", onListening);
		server.listen(port, "127.0.0.1");
	});
}
function closeServer(server) {
	if (!server) return Promise.resolve();
	return new Promise((resolve) => server.close(() => resolve()));
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function readBody(stream, limit) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let total = 0;
		stream.on("data", (chunk) => {
			total += chunk.length;
			if (total <= limit) chunks.push(chunk);
		});
		stream.on("end", () => resolve({
			body: Buffer.concat(chunks),
			total,
			truncated: total > limit
		}));
		stream.on("error", reject);
	});
}
function pairsFromRaw(rawHeaders) {
	const pairs = [];
	for (let index = 0; index < rawHeaders.length; index += 2) pairs.push([rawHeaders[index], rawHeaders[index + 1]]);
	return pairs;
}
function pairsToObject(input, keepHop = false) {
	const headers = {};
	if (!input) return headers;
	if (!Array.isArray(input)) {
		if (typeof input === "object") for (const [key, value] of Object.entries(input)) {
			const lower = key.toLowerCase();
			if (!keepHop && HOP.has(lower)) continue;
			headers[lower] = value;
		}
		return headers;
	}
	if (input.length === 0) return headers;
	if (Array.isArray(input[0])) for (const [name, value] of input) {
		if (name == null) continue;
		const key = String(name).toLowerCase();
		if (!keepHop && HOP.has(key)) continue;
		if (headers[key] == null) headers[key] = value;
		else if (Array.isArray(headers[key])) headers[key].push(value);
		else headers[key] = [headers[key], value];
	}
	else for (let index = 0; index < input.length; index += 2) {
		const name = input[index];
		const value = input[index + 1];
		if (name == null) continue;
		const key = String(name).toLowerCase();
		if (!keepHop && HOP.has(key)) continue;
		if (headers[key] == null) headers[key] = value;
		else if (Array.isArray(headers[key])) headers[key].push(value);
		else headers[key] = [headers[key], value];
	}
	return headers;
}
function objectToPairs(headers) {
	const pairs = [];
	if (!headers) return pairs;
	for (const [name, value] of Object.entries(headers)) if (Array.isArray(value)) value.forEach((item) => pairs.push([name, String(item)]));
	else if (value != null) pairs.push([name, String(value)]);
	return pairs;
}
function headerValue(headers, name) {
	if (!headers) return "";
	const value = headers[name.toLowerCase()];
	if (Array.isArray(value)) return value.join(", ");
	return value == null ? "" : String(value);
}
function decodeBuffer(buffer, encoding) {
	const value = String(encoding || "").toLowerCase();
	try {
		if (value.includes("br")) return zlib.default.brotliDecompressSync(buffer);
		if (value.includes("gzip")) return zlib.default.gunzipSync(buffer);
		if (value.includes("deflate")) return zlib.default.inflateSync(buffer);
	} catch (error) {
		return buffer;
	}
	return buffer;
}
function looksText(buffer) {
	if (!buffer.length) return true;
	const sample = buffer.subarray(0, Math.min(buffer.length, 1e3));
	let odd = 0;
	for (const byte of sample) if (byte === 0) return false;
	else if (byte < 9 || byte > 13 && byte < 32) odd += 1;
	return odd / sample.length < .08;
}
function presentBody(buffer, headers) {
	const contentType = headerValue(headers, "content-type");
	const decoded = decodeBuffer(buffer, headerValue(headers, "content-encoding"));
	const textLike = /json|text|xml|javascript|svg|x-www-form-urlencoded|graphql|\+xml/i.test(contentType) || looksText(decoded);
	const clipped = decoded.subarray(0, MAX_CAPTURE);
	return {
		size: buffer.length,
		decodedSize: decoded.length,
		truncated: decoded.length > MAX_CAPTURE,
		contentType,
		text: textLike ? clipped.toString("utf8") : "",
		base64: !textLike && decoded.length <= 4e5 ? decoded.toString("base64") : ""
	};
}
function appNameFromUA(userAgent) {
	const source = String(userAgent || "");
	for (const [pattern, name] of [
		[/Postman/i, "Postman"],
		[/curl\//i, "curl"],
		[/python-requests|aiohttp|httpx/i, "Python"],
		[/Go-http-client/i, "Go"],
		[/Flowman/i, "Flowman"],
		[/Electron/i, "Electron"],
		[/Edg\//i, "Edge"],
		[/Chrome\//i, "Chrome"],
		[/Firefox\//i, "Firefox"],
		[/Safari\//i, "Safari"]
	]) if (pattern.test(source)) return name;
	return "未知应用";
}
function contextFromUrl(urlString, method, headers) {
	const url$1 = new url.URL(urlString);
	return {
		method: method.toUpperCase(),
		protocol: url$1.protocol.replace(":", ""),
		host: url$1.hostname,
		port: Number(url$1.port || (url$1.protocol === "https:" ? 443 : 80)),
		path: url$1.pathname || "/",
		query: url$1.search.startsWith("?") ? url$1.search.slice(1) : "",
		url: url$1.toString(),
		headers
	};
}
var DebugProxy = class extends events.EventEmitter {
	constructor({ certStore, rules }) {
		super();
		this.sequence = 0;
		this.recording = true;
		this.server = null;
		this.secureHttp = null;
		this.reverseServers = [];
		this.pendingBreaks = /* @__PURE__ */ new Map();
		this.lastError = "";
		this.certStore = certStore;
		this.rules = rules;
		this.flows = [];
		this.port = rules.port;
	}
	status() {
		return {
			running: Boolean(this.server && this.server.listening),
			port: this.port,
			recording: this.recording,
			flowCount: this.flows.length,
			address: `127.0.0.1:${this.port}`,
			ssl: this.rules.ssl.enabled,
			error: this.lastError || ""
		};
	}
	async start(port) {
		await this.stop();
		this.port = port;
		this.rules.port = port;
		this.secureHttp = http.default.createServer((req, res) => {
			this.onHttp(req, res, true).catch((error) => this.failResponse(res, error));
		});
		this.secureHttp.on("upgrade", (req, socket, head) => this.onUpgrade(req, socket, head, true));
		this.secureHttp.on("clientError", (_error, socket) => socket.destroy());
		this.server = http.default.createServer((req, res) => {
			this.onHttp(req, res, false).catch((error) => this.failResponse(res, error));
		});
		this.server.on("connect", (req, socket, head) => this.onConnect(req, socket, head));
		this.server.on("upgrade", (req, socket, head) => this.onUpgrade(req, socket, head, false));
		this.server.on("clientError", (_error, socket) => {
			if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
		});
		await listen(this.server, port);
		await this.syncReverse();
		this.lastError = "";
		this.emit("status", this.status());
	}
	async stop() {
		const current = this.server;
		this.server = null;
		await Promise.all(this.reverseServers.map(closeServer));
		this.reverseServers = [];
		await closeServer(current);
		if (this.secureHttp) {
			this.secureHttp.removeAllListeners();
			this.secureHttp = null;
		}
	}
	async updateRules(rules) {
		const previous = this.port;
		const wasListening = Boolean(this.server && this.server.listening);
		this.rules = rules;
		if (rules.port !== previous || !wasListening) await this.start(rules.port);
		else await this.syncReverse();
		this.emit("status", this.status());
	}
	setRecording(recording) {
		this.recording = Boolean(recording);
		this.emit("status", this.status());
	}
	clear() {
		this.flows = [];
		this.emit("cleared");
		this.emit("status", this.status());
	}
	listSummaries() {
		return this.flows.map((flow) => this.summary(flow));
	}
	getFlow(id) {
		return this.flows.find((flow) => flow.id === id) || null;
	}
	search(query) {
		const needle = String(query || "").trim().toLowerCase();
		if (!needle) return this.listSummaries();
		return this.flows.filter((flow) => {
			return [
				flow.url,
				flow.method,
				String(flow.status || ""),
				flow.appName,
				flow.request.text,
				flow.response.text,
				JSON.stringify(flow.request.headers),
				JSON.stringify(flow.response.headers)
			].join("\n").toLowerCase().includes(needle);
		}).map((flow) => this.summary(flow));
	}
	summary(flow) {
		return {
			id: flow.id,
			no: flow.no,
			startedAt: flow.startedAt,
			duration: flow.duration,
			method: flow.method,
			url: flow.url,
			protocol: flow.protocol,
			host: flow.host,
			path: flow.path,
			query: flow.query,
			status: flow.status,
			error: flow.error,
			appName: flow.appName,
			highlight: flow.highlight,
			source: flow.source,
			websocket: flow.websocket,
			contentType: flow.response && flow.response.contentType || "",
			responseSize: flow.response && flow.response.size || 0,
			requestSize: flow.request && flow.request.size || 0,
			flags: flow.flags
		};
	}
	shouldCapture(request) {
		if (!this.recording) return false;
		if (!this.rules.allow.enabled) return true;
		return enabledRules(this.rules.allow).some((rule) => requestMatches(rule, request));
	}
	shouldIntercept(host) {
		if (!this.rules.ssl.enabled) return false;
		const included = (this.rules.ssl.include || []).filter((rule) => rule.enabled !== false);
		const excluded = (this.rules.ssl.exclude || []).filter((rule) => rule.enabled !== false);
		if (!included.some((rule) => matchPattern(rule.pattern || "*", host))) return false;
		return !excluded.some((rule) => matchPattern(rule.pattern || "*", host));
	}
	onConnect(req, clientSocket, head) {
		const [host, portRaw] = String(req.url || "").split(":");
		const port = Number(portRaw || 443);
		clientSocket.on("error", () => {});
		if (!host || !this.shouldIntercept(host)) {
			this.tunnel(clientSocket, head, host, port);
			return;
		}
		const issued = this.certStore.issue(host);
		const secureContext = tls.default.createSecureContext({
			key: issued.key,
			cert: issued.cert
		});
		clientSocket.flowTarget = {
			host,
			port
		};
		clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
		if (head && head.length) clientSocket.unshift(head);
		const tlsSocket = new tls.default.TLSSocket(clientSocket, {
			isServer: true,
			secureContext
		});
		tlsSocket.flowTarget = {
			host,
			port
		};
		tlsSocket.on("error", (error) => {
			const flow = this.makeFlow({
				method: "CONNECT",
				url: `https://${host}${port && port !== 443 ? `:${port}` : ""}`,
				protocol: "https",
				host,
				port,
				path: "/",
				query: ""
			}, {
				started: Date.now(),
				source: "proxy",
				status: 526,
				error: `SSL 握手失败: ${error.message}（需在系统钥匙串中信任 Flowman CA）`,
				flags: { sslFailed: true }
			});
			this.addFlow(flow);
			clientSocket.destroy();
		});
		tlsSocket.once("secure", () => {
			if (this.secureHttp) this.secureHttp.emit("connection", tlsSocket);
		});
	}
	tunnel(clientSocket, head, host, port) {
		const started = Date.now();
		const flow = this.makeFlow({
			method: "CONNECT",
			url: `https://${host}${port && port !== 443 ? `:${port}` : ""}`,
			protocol: "https",
			host,
			port,
			path: "/",
			query: ""
		}, {
			started,
			source: "proxy",
			status: 200,
			flags: { tunnel: true },
			responseHeaders: [["x-flowman-tunnel", "tcp"]]
		});
		let clientBytes = 0;
		let serverBytes = 0;
		const upstream = net.default.connect(port, host, () => {
			clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
			if (head && head.length) upstream.write(head);
			clientSocket.on("data", (chunk) => {
				clientBytes += chunk.length;
			});
			upstream.on("data", (chunk) => {
				serverBytes += chunk.length;
			});
			upstream.pipe(clientSocket);
			clientSocket.pipe(upstream);
			this.addFlow(flow);
		});
		const finalize = (error) => {
			if (error && flow.status === 200) {
				flow.status = 502;
				flow.error = error.message;
			}
			flow.duration = Date.now() - started;
			if (flow.request) flow.request.size = clientBytes;
			if (flow.response) flow.response.size = serverBytes;
			this.emit("flow-update", this.summary(flow));
			upstream.destroy();
			clientSocket.destroy();
		};
		upstream.on("error", finalize);
		upstream.on("close", () => finalize());
		clientSocket.on("error", finalize);
		clientSocket.on("close", () => finalize());
	}
	async onHttp(req, res, secure) {
		const started = Date.now();
		let request;
		if (secure || !/^https?:\/\//i.test(req.url || "")) {
			const hostHeader = req.headers.host || "unknown";
			request = contextFromUrl(`${secure ? "https:" : "http:"}//${hostHeader}${req.url}`, req.method || "GET", pairsToObject(req.rawHeaders || []));
			const stamped = req.socket?.flowTarget || req.socket?._parent && req.socket._parent.flowTarget;
			if (secure && stamped) {
				request.host = stamped.host;
				request.port = stamped.port;
				request.protocol = "https";
				const pathAndQuery = req.url || "/";
				request.url = `https://${stamped.host}${stamped.port && stamped.port !== 443 ? `:${stamped.port}` : ""}${pathAndQuery}`;
				const parsed = new url.URL(request.url);
				request.path = parsed.pathname;
				request.query = parsed.search.startsWith("?") ? parsed.search.slice(1) : "";
			}
		} else request = contextFromUrl(req.url || "/", req.method || "GET", pairsToObject(req.rawHeaders || []));
		const contentLength = Number(req.headers["content-length"] || 0);
		if (!this.needsBuffer(request) && contentLength <= MAX_EDIT) {
			await this.streamForward(req, res, request, started);
			return;
		}
		const read = await readBody(req, MAX_EDIT);
		if (read.truncated) {
			this.writePlain(res, 413, "请求体超过 Flowman 可编辑上限（8MB）");
			this.addFlow(this.makeFlow(request, {
				status: 413,
				error: "body too large",
				started,
				source: "proxy"
			}));
			return;
		}
		await this.execute({
			request,
			body: read.body,
			rawHeaders: req.rawHeaders || [],
			response: res,
			started,
			source: "proxy"
		});
	}
	needsBuffer(request) {
		return Boolean(this.rules.block.enabled && enabledRules(this.rules.block).some((rule) => requestMatches(rule, request)) || this.rules.mapLocal.enabled && enabledRules(this.rules.mapLocal).some((rule) => requestMatches(rule, request)) || this.rules.mapRemote.enabled && enabledRules(this.rules.mapRemote).some((rule) => requestMatches(rule, request)) || this.rules.breakpoints.enabled && enabledRules(this.rules.breakpoints).some((rule) => requestMatches(rule, request)) || this.rules.scripts.enabled && enabledRules(this.rules.scripts).length);
	}
	async streamForward(req, res, request, started) {
		const headers = pairsToObject(req.rawHeaders || []);
		if (this.rules.noCaching) this.applyNoCache(headers);
		const requestHeaders = pairsFromRaw(req.rawHeaders || []);
		const reqChunks = [];
		const flowBase = this.makeFlow(request, {
			started,
			source: "proxy",
			requestHeaders,
			requestBody: Buffer.alloc(0)
		});
		try {
			if (this.rules.throttle.latencyMs) await sleep(this.rules.throttle.latencyMs);
			const onReqChunk = (chunk) => {
				if (reqChunks.reduce((acc, c) => acc + c.length, 0) < MAX_CAPTURE) reqChunks.push(chunk);
			};
			const upstream = await this.openUpstream(request, req.method || "GET", headers, req, onReqChunk);
			const chunks = [];
			let size = 0;
			res.writeHead(upstream.status, this.headersForRaw(upstream.rawHeaders, null));
			upstream.stream.on("data", (chunk) => {
				size += chunk.length;
				if (size <= MAX_CAPTURE) chunks.push(chunk);
				if (!this.writeThrottled(res, chunk)) res.write(chunk);
			});
			await new Promise((resolve, reject) => {
				upstream.stream.on("end", resolve);
				upstream.stream.on("error", reject);
			});
			res.end();
			const body = Buffer.concat(chunks);
			const reqBody = Buffer.concat(reqChunks);
			flowBase.status = upstream.status;
			if (reqBody.length > 0) flowBase.request = {
				headers: requestHeaders,
				...presentBody(reqBody, headers)
			};
			flowBase.response = presentBody(body, pairsToObject(upstream.rawHeaders));
			flowBase.response.headers = pairsFromRaw(upstream.rawHeaders);
			flowBase.response.size = size;
			flowBase.duration = Date.now() - started;
			this.addFlow(flowBase);
		} catch (error) {
			if (!res.headersSent) this.writePlain(res, 502, error.message);
			else res.end();
			flowBase.status = 502;
			flowBase.error = error.message;
			flowBase.duration = Date.now() - started;
			this.addFlow(flowBase);
		}
	}
	writeThrottled(res, chunk) {
		const kbps = this.rules.throttle.enabled ? this.rules.throttle.downloadKbps : 0;
		if (!kbps) return false;
		const bytesPerSecond = kbps * 1024 / 8;
		const delay = Math.min(2e3, chunk.length / bytesPerSecond * 1e3);
		res.write(chunk);
		if (res.socket) res.socket.pause?.();
		setTimeout(() => res.socket && res.socket.resume?.(), delay);
		return true;
	}
	async execute({ request, body, rawHeaders, response, started, source }) {
		const flags = {};
		let headers = pairsToObject(rawHeaders && rawHeaders.length ? rawHeaders : objectToPairs(request.headers || {}));
		let method = request.method;
		let current = { ...request };
		let payload = body || Buffer.alloc(0);
		const scriptErrors = [];
		const block = this.rules.block.enabled ? enabledRules(this.rules.block).find((rule) => requestMatches(rule, current)) : null;
		if (block) {
			if (block.action === "hide") {
				response.socket?.destroy();
				return null;
			}
			const message = Buffer.from("Blocked by Flowman");
			this.writePlain(response, block.status || 403, message.toString());
			const flow = this.makeFlow(current, {
				started,
				source,
				status: block.status || 403,
				flags: { blocked: true },
				requestHeaders: objectToPairs(headers),
				requestBody: payload,
				responseHeaders: [["content-type", "text/plain"]],
				responseBody: message
			});
			this.addFlow(flow);
			return flow;
		}
		const local = this.rules.mapLocal.enabled ? enabledRules(this.rules.mapLocal).find((rule) => requestMatches(rule, current)) : null;
		if (local) {
			flags.mappedLocal = true;
			let fileBody = Buffer.from("map local file missing");
			let status = 404;
			try {
				fileBody = fs.default.readFileSync(local.file || "");
				status = 200;
			} catch (error) {
				fileBody = Buffer.from(error.message);
			}
			const type = local.contentType || contentTypeFor(local.file || "");
			response.writeHead(status, {
				"content-type": type,
				"content-length": fileBody.length,
				"x-flowman-map": "local"
			});
			response.end(fileBody);
			const flow = this.makeFlow(current, {
				started,
				source,
				status,
				flags,
				requestHeaders: objectToPairs(headers),
				requestBody: payload,
				responseHeaders: [["content-type", type]],
				responseBody: fileBody
			});
			this.addFlow(flow);
			return flow;
		}
		const remote = this.rules.mapRemote.enabled ? enabledRules(this.rules.mapRemote).find((rule) => requestMatches(rule, current)) : null;
		if (remote && remote.targetUrl) {
			flags.mappedRemote = true;
			const target = new url.URL(remote.targetUrl);
			const next = new url.URL(current.url);
			next.protocol = target.protocol;
			next.hostname = target.hostname;
			next.port = target.port;
			if (target.pathname && target.pathname !== "/") next.pathname = target.pathname;
			if (target.search) next.search = target.search;
			current = contextFromUrl(next.toString(), method, headers);
			if (!remote.preserveHost) headers.host = target.host;
		}
		if (this.rules.noCaching) this.applyNoCache(headers);
		const breakpoint = this.matchingBreakpoint(current);
		if (breakpoint && breakpoint.phase !== "response") {
			const decision = await this.askBreakpoint({
				phase: "request",
				request: this.publicRequest(method, current.url, headers, payload)
			});
			if (!decision || decision.action === "abort") {
				this.writePlain(response, 499, "Breakpoint aborted");
				return null;
			}
			const edited = decision.request || {};
			method = String(edited.method || method).toUpperCase();
			current = contextFromUrl(edited.url || current.url, method, edited.headers || headers);
			headers = edited.headers || headers;
			payload = Buffer.from(edited.body || "");
		}
		if (this.rules.scripts.enabled) {
			const scripted = applyScripts(enabledRules(this.rules.scripts), "onRequest", this.publicRequest(method, current.url, headers, payload));
			scriptErrors.push(...scripted.errors);
			if (scripted.request) {
				flags.scripted = true;
				method = String(scripted.request.method || method).toUpperCase();
				headers = scripted.request.headers || headers;
				payload = Buffer.from(scripted.request.body || "");
				current = contextFromUrl(scripted.request.url || current.url, method, headers);
			}
		}
		if (this.rules.throttle.latencyMs) await sleep(this.rules.throttle.latencyMs);
		let upstream;
		try {
			upstream = await this.fetch(current.url, method, headers, payload);
		} catch (error) {
			this.writePlain(response, 502, error.message);
			const flow = this.makeFlow(current, {
				started,
				source,
				status: 502,
				error: error.message,
				flags,
				requestHeaders: objectToPairs(headers),
				requestBody: payload
			});
			flow.scriptErrors = scriptErrors;
			this.addFlow(flow);
			return flow;
		}
		let status = upstream.status;
		let responseHeaders = pairsToObject(upstream.rawHeaders);
		let responseBody = upstream.body;
		if (breakpoint && breakpoint.phase !== "request") {
			const decision = await this.askBreakpoint({
				phase: "response",
				request: this.publicRequest(method, current.url, headers, payload),
				response: this.publicResponse(status, responseHeaders, responseBody)
			});
			if (!decision || decision.action === "abort") {
				this.writePlain(response, 499, "Breakpoint aborted");
				return null;
			}
			if (decision.response) {
				status = Number(decision.response.status || status);
				responseHeaders = decision.response.headers || responseHeaders;
				responseBody = Buffer.from(decision.response.body || "");
				delete responseHeaders["content-encoding"];
			}
		}
		if (this.rules.scripts.enabled) {
			const scripted = applyScripts(enabledRules(this.rules.scripts), "onResponse", this.publicRequest(method, current.url, headers, payload), this.publicResponse(status, responseHeaders, responseBody));
			scriptErrors.push(...scripted.errors);
			if (scripted.response) {
				flags.scripted = true;
				status = Number(scripted.response.status || status);
				responseHeaders = scripted.response.headers || responseHeaders;
				responseBody = Buffer.from(scripted.response.body || "");
				delete responseHeaders["content-encoding"];
			}
		}
		const raw = this.headersForObject(responseHeaders, responseBody);
		response.writeHead(status, raw);
		response.end(responseBody);
		const flow = this.makeFlow(current, {
			started,
			source,
			status,
			flags,
			requestHeaders: objectToPairs(headers),
			requestBody: payload,
			responseHeaders: objectToPairs(responseHeaders),
			responseBody
		});
		flow.scriptErrors = scriptErrors;
		this.addFlow(flow);
		return flow;
	}
	matchingBreakpoint(request) {
		if (!this.rules.breakpoints.enabled) return null;
		return enabledRules(this.rules.breakpoints).find((rule) => requestMatches(rule, request)) || null;
	}
	askBreakpoint(payload) {
		const id = crypto.default.randomBytes(6).toString("hex");
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.pendingBreaks.delete(id);
				resolve({ action: "continue" });
			}, 12e4);
			this.pendingBreaks.set(id, {
				resolve,
				timer
			});
			this.emit("breakpoint", {
				id,
				...payload
			});
		});
	}
	resolveBreakpoint(id, decision) {
		const pending = this.pendingBreaks.get(id);
		if (!pending) return false;
		clearTimeout(pending.timer);
		this.pendingBreaks.delete(id);
		pending.resolve(decision || { action: "continue" });
		return true;
	}
	applyNoCache(headers) {
		delete headers["if-none-match"];
		delete headers["if-modified-since"];
		headers["cache-control"] = "no-cache";
		headers.pragma = "no-cache";
	}
	publicRequest(method, url, headers, body) {
		return {
			method,
			url,
			headers: { ...headers },
			body: body.toString("utf8")
		};
	}
	publicResponse(status, headers, body) {
		const decoded = decodeBuffer(body, headerValue(headers, "content-encoding"));
		return {
			status,
			headers: { ...headers },
			body: decoded.toString("utf8")
		};
	}
	async fetch(urlString, method, headers, body) {
		const url$2 = new url.URL(urlString);
		const outbound = { ...headers };
		delete outbound["content-length"];
		if (body.length) outbound["content-length"] = String(body.length);
		outbound.connection = "close";
		const external = this.rules.externalProxy;
		if (external.enabled && external.host && external.port && url$2.protocol === "http:") return this.bufferedRequest({
			hostname: external.host,
			port: Number(external.port),
			method,
			path: url$2.href,
			headers: outbound,
			body
		});
		if (external.enabled && external.host && external.port && url$2.protocol === "https:") {
			const tunnel = await this.connectTunnel(external.host, Number(external.port), url$2.hostname, Number(url$2.port || 443));
			return this.bufferedTlsRequest(tunnel, url$2, method, outbound, body);
		}
		return this.bufferedRequest({
			protocol: url$2.protocol,
			hostname: url$2.hostname,
			port: Number(url$2.port || (url$2.protocol === "https:" ? 443 : 80)),
			servername: url$2.hostname,
			method,
			path: `${url$2.pathname}${url$2.search}`,
			headers: outbound,
			body,
			tls: url$2.protocol === "https:"
		});
	}
	upstreamTls() {
		return {
			ca: [...tls.default.rootCertificates, this.certStore.caCertPem],
			rejectUnauthorized: !this.rules.ssl.ignoreUpstreamTls
		};
	}
	bufferedRequest(options) {
		const library = options.tls || options.protocol === "https:" ? https.default : http.default;
		const tlsOptions = options.tls || options.protocol === "https:" ? this.upstreamTls() : {};
		return new Promise((resolve, reject) => {
			const req = library.request({
				hostname: options.hostname,
				port: options.port,
				method: options.method,
				path: options.path,
				headers: options.headers,
				servername: options.servername,
				agent: false,
				timeout: 3e4,
				...tlsOptions
			}, (res) => {
				readBody(res, MAX_EDIT).then((read) => {
					resolve({
						status: res.statusCode || 0,
						rawHeaders: res.rawHeaders,
						body: read.body
					});
				}).catch(reject);
			});
			req.on("error", reject);
			req.on("timeout", () => req.destroy(/* @__PURE__ */ new Error("upstream timeout")));
			if (options.body && options.body.length) req.write(options.body);
			req.end();
		});
	}
	openUpstream(request, method, headers, incoming, onReqChunk) {
		const outbound = {
			...headers,
			connection: "close"
		};
		return new Promise((resolve, reject) => {
			const req = (request.protocol === "https" ? https.default : http.default).request({
				hostname: request.host,
				port: request.port,
				method,
				path: `${request.path}${request.query ? `?${request.query}` : ""}`,
				headers: outbound,
				servername: request.host,
				agent: false,
				timeout: 3e4,
				...request.protocol === "https" ? this.upstreamTls() : {}
			}, (res) => resolve({
				status: res.statusCode || 0,
				rawHeaders: res.rawHeaders,
				stream: res
			}));
			req.on("error", reject);
			req.on("timeout", () => req.destroy(/* @__PURE__ */ new Error("upstream timeout")));
			if (incoming) {
				if (onReqChunk) incoming.on("data", onReqChunk);
				incoming.pipe(req);
			} else req.end();
		});
	}
	connectTunnel(proxyHost, proxyPort, host, port) {
		return new Promise((resolve, reject) => {
			const socket = net.default.connect(proxyPort, proxyHost, () => {
				socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
			});
			let buffer = Buffer.alloc(0);
			const onData = (chunk) => {
				buffer = Buffer.concat([buffer, chunk]);
				const index = buffer.indexOf("\r\n\r\n");
				if (index === -1) return;
				socket.off("data", onData);
				const header = buffer.slice(0, index).toString("latin1");
				if (!/^HTTP\/1\.[01] 200/i.test(header)) {
					socket.destroy();
					reject(new Error(header.split("\r\n")[0] || "external proxy rejected CONNECT"));
					return;
				}
				const rest = buffer.slice(index + 4);
				if (rest.length) socket.unshift(rest);
				resolve(socket);
			};
			socket.on("data", onData);
			socket.on("error", reject);
		});
	}
	bufferedTlsRequest(socket, url, method, headers, body) {
		return new Promise((resolve, reject) => {
			const tlsSocket = tls.default.connect({
				socket,
				servername: url.hostname,
				...this.upstreamTls()
			}, () => {
				const lines = [`${method} ${url.pathname}${url.search} HTTP/1.1`];
				for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
				tlsSocket.write(`${lines.join("\r\n")}\r\n\r\n`);
				if (body.length) tlsSocket.write(body);
				readHttpResponse(tlsSocket).then(resolve).catch(reject);
			});
			tlsSocket.on("error", reject);
		});
	}
	headersForRaw(rawHeaders, body) {
		const pairs = [];
		for (let index = 0; index < rawHeaders.length; index += 2) {
			const name = rawHeaders[index];
			const lower = name.toLowerCase();
			if (HOP.has(lower)) continue;
			if (body && lower === "content-length") continue;
			pairs.push(name, rawHeaders[index + 1]);
		}
		if (body) pairs.push("Content-Length", String(body.length));
		return pairs;
	}
	headersForObject(headers, body) {
		const pairs = [];
		for (const [name, value] of Object.entries(headers || {})) {
			if (HOP.has(name.toLowerCase())) continue;
			if (name.toLowerCase() === "content-length") continue;
			pairs.push(name, Array.isArray(value) ? value.join(", ") : String(value));
		}
		pairs.push("Content-Length", String(body.length));
		return pairs;
	}
	writePlain(res, status, message) {
		if (res.headersSent || res.writableEnded) return;
		const body = Buffer.from(String(message));
		res.writeHead(status, {
			"content-type": "text/plain; charset=utf-8",
			"content-length": body.length,
			connection: "close"
		});
		res.end(body);
	}
	failResponse(res, error) {
		this.lastError = error.message;
		this.writePlain(res, 502, error.message);
		this.emit("status", this.status());
	}
	makeFlow(request, extra = {}) {
		const requestBody = extra.requestBody || Buffer.alloc(0);
		const responseBody = extra.responseBody || Buffer.alloc(0);
		const requestHeaders = extra.requestHeaders || (request.headers ? Array.isArray(request.headers) ? request.headers : objectToPairs(request.headers) : []);
		const responseHeaders = extra.responseHeaders || [];
		const requestObject = pairsToObject(requestHeaders);
		const responseObject = pairsToObject(responseHeaders);
		return {
			id: crypto.default.randomBytes(8).toString("hex"),
			no: 0,
			startedAt: extra.started || Date.now(),
			duration: extra.started ? Date.now() - extra.started : 0,
			method: request.method,
			url: request.url,
			protocol: request.protocol,
			host: request.host,
			path: request.path || "/",
			query: request.query || "",
			status: extra.status || 0,
			error: extra.error || "",
			appName: appNameFromUA(headerValue(requestObject, "user-agent")),
			highlight: "",
			source: extra.source || "proxy",
			websocket: false,
			flags: extra.flags || {},
			scriptErrors: [],
			request: {
				headers: requestHeaders,
				...presentBody(requestBody, requestObject)
			},
			response: {
				headers: responseHeaders,
				...presentBody(responseBody, responseObject)
			}
		};
	}
	addFlow(flow) {
		if (!this.shouldCapture({
			method: flow.method,
			host: flow.host,
			path: flow.path,
			query: flow.query || ""
		})) return;
		flow.no = ++this.sequence;
		this.flows.push(flow);
		if (this.flows.length > 2e3) this.flows.splice(0, this.flows.length - 2e3);
		this.emit("flow", this.summary(flow));
		this.emit("status", this.status());
	}
	async compose(input) {
		const method = String(input.method || "GET").toUpperCase();
		const headers = {};
		for (const line of String(input.headers || "").split(/\r?\n/)) {
			const index = line.indexOf(":");
			if (index > 0) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
		}
		const request = contextFromUrl(input.url, method, headers);
		const fake = new PassThroughResponse();
		const flow = await this.execute({
			request,
			body: Buffer.from(input.body || ""),
			rawHeaders: objectToPairs(headers).flat(),
			response: fake,
			started: Date.now(),
			source: "compose"
		});
		return flow ? this.summary(flow) : null;
	}
	async repeat(id) {
		const flow = this.getFlow(id);
		if (!flow) return null;
		return this.compose({
			method: flow.method,
			url: flow.url,
			headers: flow.request.headers.map(([name, value]) => `${name}: ${value}`).join("\n"),
			body: flow.request.text || ""
		});
	}
	highlight(id, color) {
		const flow = this.getFlow(id);
		if (!flow) return null;
		flow.highlight = color || "";
		const summary = this.summary(flow);
		this.emit("flow-update", summary);
		return summary;
	}
	toHar() {
		return { log: {
			version: "1.2",
			creator: {
				name: "Flowman",
				version: "1.0.0"
			},
			entries: this.flows.map((flow) => ({
				startedDateTime: new Date(flow.startedAt).toISOString(),
				time: flow.duration || 0,
				request: {
					method: flow.method,
					url: flow.url,
					httpVersion: "HTTP/1.1",
					headers: (flow.request.headers || []).map(([name, value]) => ({
						name,
						value
					})),
					queryString: [],
					cookies: [],
					headersSize: -1,
					bodySize: flow.request.size || 0,
					postData: flow.request.text ? {
						mimeType: flow.request.contentType || "text/plain",
						text: flow.request.text
					} : void 0
				},
				response: {
					status: flow.status,
					statusText: String(flow.status),
					httpVersion: "HTTP/1.1",
					headers: (flow.response.headers || []).map(([name, value]) => ({
						name,
						value
					})),
					cookies: [],
					content: {
						size: flow.response.size || 0,
						mimeType: flow.response.contentType || "",
						text: flow.response.text || ""
					},
					redirectURL: "",
					headersSize: -1,
					bodySize: flow.response.size || 0
				},
				cache: {},
				timings: {
					send: 0,
					wait: flow.duration || 0,
					receive: 0
				}
			}))
		} };
	}
	async syncReverse() {
		await Promise.all(this.reverseServers.map(closeServer));
		this.reverseServers = [];
		for (const rule of this.rules.reverseProxies || []) {
			if (rule.enabled === false || !rule.listenPort || !rule.targetUrl) continue;
			const server = http.default.createServer((req, res) => {
				let target;
				try {
					target = new url.URL(req.url || "/", rule.targetUrl);
					const fixed = new url.URL(rule.targetUrl);
					target.protocol = fixed.protocol;
					target.host = fixed.host;
				} catch (error) {
					this.writePlain(res, 400, error.message);
					return;
				}
				const request = contextFromUrl(target.toString(), req.method || "GET", pairsToObject(req.rawHeaders || []));
				readBody(req, MAX_EDIT).then((read) => this.execute({
					request,
					body: read.body,
					rawHeaders: req.rawHeaders || [],
					response: res,
					started: Date.now(),
					source: "reverse"
				})).catch((error) => this.failResponse(res, error));
			});
			server.on("error", (error) => {
				this.lastError = `反向代理 ${rule.listenPort}: ${error.message}`;
				this.emit("status", this.status());
			});
			try {
				await listen(server, rule.listenPort);
				this.reverseServers.push(server);
			} catch (error) {
				this.lastError = `反向代理 ${rule.listenPort}: ${error.message}`;
			}
		}
	}
	onUpgrade(req, clientSocket, head, secure) {
		let request;
		try {
			if (secure || !/^https?:\/\//i.test(req.url || "")) {
				const hostHeader = req.headers.host || "";
				request = contextFromUrl(`${secure ? "https:" : "http:"}//${hostHeader}${req.url}`, req.method || "GET", {});
				const stamped = req.socket?.flowTarget || req.socket?._parent && req.socket._parent.flowTarget;
				if (secure && stamped) request = contextFromUrl(`https://${stamped.host}:${stamped.port}${req.url || "/"}`, req.method || "GET", {});
			} else request = contextFromUrl(req.url || "/", req.method || "GET", {});
		} catch (error) {
			clientSocket.destroy();
			return;
		}
		if (this.rules.block.enabled ? enabledRules(this.rules.block).find((rule) => requestMatches(rule, request)) : null) {
			clientSocket.destroy();
			return;
		}
		const upstream = request.protocol === "https" ? tls.default.connect({
			host: request.host,
			port: request.port,
			servername: request.host,
			...this.upstreamTls()
		}) : net.default.connect(request.port, request.host);
		const fail = (error) => {
			const flow = this.makeFlow(request, {
				started: Date.now(),
				source: "proxy",
				status: 502,
				error: error.message
			});
			flow.websocket = true;
			this.addFlow(flow);
			clientSocket.destroy();
			upstream.destroy();
		};
		upstream.on("error", fail);
		clientSocket.on("error", () => upstream.destroy());
		const ready = () => {
			const lines = [`${req.method} ${request.path}${request.query ? `?${request.query}` : ""} HTTP/1.1`];
			const raw = req.rawHeaders || [];
			for (let index = 0; index < raw.length; index += 2) {
				const key = String(raw[index]).toLowerCase();
				if (key === "upgrade" || key === "connection" || !HOP.has(key)) lines.push(`${raw[index]}: ${raw[index + 1]}`);
			}
			upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
			if (head && head.length) upstream.write(head);
			let buffer = Buffer.alloc(0);
			const onData = (chunk) => {
				buffer = Buffer.concat([buffer, chunk]);
				const split = buffer.indexOf("\r\n\r\n");
				if (split === -1) return;
				upstream.off("data", onData);
				const headerText = buffer.slice(0, split).toString("latin1");
				const status = Number((headerText.match(/^HTTP\/1\.[01] (\d+)/) || [])[1] || 101);
				clientSocket.write(buffer);
				upstream.pipe(clientSocket);
				clientSocket.pipe(upstream);
				const flow = this.makeFlow(request, {
					started: Date.now(),
					source: "proxy",
					status,
					requestHeaders: pairsFromRaw(raw),
					responseHeaders: headerText.split("\r\n").slice(1).map((line) => {
						const index = line.indexOf(":");
						return [line.slice(0, index), line.slice(index + 1).trim()];
					})
				});
				flow.websocket = true;
				this.addFlow(flow);
			};
			upstream.on("data", onData);
		};
		upstream.once(request.protocol === "https" ? "secureConnect" : "connect", ready);
	}
};
var PassThroughResponse = class {
	constructor() {
		this.headersSent = false;
		this.writableEnded = false;
		this.statusCode = 0;
		this.socket = { destroy() {} };
	}
	writeHead(status) {
		this.headersSent = true;
		this.statusCode = status;
	}
	end() {
		this.writableEnded = true;
		this.headersSent = true;
	}
	write() {}
};
function contentTypeFor(file) {
	return {
		".json": "application/json; charset=utf-8",
		".html": "text/html; charset=utf-8",
		".txt": "text/plain; charset=utf-8",
		".js": "text/javascript; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".svg": "image/svg+xml",
		".png": "image/png"
	}[path.default.extname(file).toLowerCase()] || "application/octet-stream";
}
function readHttpResponse(socket) {
	return new Promise((resolve, reject) => {
		let buffer = Buffer.alloc(0);
		const onError = (error) => reject(error);
		const onData = (chunk) => {
			buffer = Buffer.concat([buffer, chunk]);
			const split = buffer.indexOf("\r\n\r\n");
			if (split === -1) return;
			const lines = buffer.slice(0, split).toString("latin1").split("\r\n");
			const status = Number((lines[0].match(/^HTTP\/1\.[01] (\d+)/) || [])[1] || 0);
			const rawHeaders = [];
			for (const line of lines.slice(1)) {
				const index = line.indexOf(":");
				if (index > 0) rawHeaders.push(line.slice(0, index), line.slice(index + 1).trim());
			}
			const rest = buffer.slice(split + 4);
			const length = Number(headerValue(pairsToObject(rawHeaders), "content-length") || rest.length);
			const finish = (body) => {
				socket.off("data", onData);
				socket.off("error", onError);
				resolve({
					status,
					rawHeaders,
					body
				});
			};
			if (rest.length >= length) finish(rest.subarray(0, length));
			else {
				const chunks = [rest];
				let got = rest.length;
				socket.off("data", onData);
				const more = (chunk) => {
					chunks.push(chunk);
					got += chunk.length;
					if (got >= length) {
						socket.off("data", more);
						finish(Buffer.concat(chunks).subarray(0, length));
					}
				};
				socket.on("data", more);
			}
		};
		socket.on("data", onData);
		socket.on("error", onError);
	});
}
// electron/main/proxy/sample.ts
var PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Flowman 示例服务</title>
  <style>
    body { margin: 0; font: 15px/1.5 "PingFang SC", sans-serif; background: #f4f7fb; color: #172033; }
    main { max-width: 760px; margin: 48px auto; padding: 28px; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(20,40,80,.08); }
    button, a.btn { margin: 8px 8px 0 0; border: 0; background: #0a64d8; color: white; border-radius: 8px; padding: 8px 12px; display: inline-block; text-decoration: none; cursor: pointer; }
    pre { background: #101828; color: #e8eef9; padding: 12px; border-radius: 10px; overflow: auto; }
    img { margin-top: 12px; border: 1px solid #d7dfeb; border-radius: 8px; }
  </style>
</head>
<body>
  <main>
    <h1>Flowman 示例页</h1>
    <p>这个页面由本地示例服务提供。通过调试浏览器打开时，请求会经过 Flowman 代理。</p>
    <button id="hello">GET /hello</button>
    <button id="echo">POST /echo</button>
    <button id="secret">GET /secret</button>
    <a class="btn" href="/picture.svg">打开 SVG</a>
    <pre id="out">等待请求</pre>
  </main>
  <script>
    const out = document.getElementById("out");
    async function show(url, options) {
      const response = await fetch(url, options);
      const text = await response.text();
      out.textContent = response.status + " " + url + "\\n" + text;
    }
    document.getElementById("hello").onclick = () => show("/hello");
    document.getElementById("echo").onclick = () => show("/echo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ping: "pong" }) });
    document.getElementById("secret").onclick = () => show("/secret");
  <\/script>
</body>
</html>`;
var SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" rx="12" fill="#0a64d8"/><text x="20" y="48" fill="white" font-size="24" font-family="sans-serif">Flowman</text></svg>`;
function startSample(preferredPort) {
	const server = http.default.createServer((req, res) => {
		const url = new URL(req.url || "/", "http://127.0.0.1");
		if (url.pathname === "/" || url.pathname === "/index.html") {
			res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			res.end(PAGE);
			return;
		}
		if (url.pathname === "/hello") {
			res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify({
				ok: true,
				message: "hello from sample",
				query: url.search
			}));
			return;
		}
		if (url.pathname === "/echo") {
			const chunks = [];
			req.on("data", (chunk) => chunks.push(chunk));
			req.on("end", () => {
				const body = Buffer.concat(chunks).toString("utf8");
				res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({
					method: req.method,
					body
				}));
			});
			return;
		}
		if (url.pathname === "/secret") {
			res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
			res.end("secret-ok");
			return;
		}
		if (url.pathname === "/picture.svg") {
			res.writeHead(200, { "content-type": "image/svg+xml" });
			res.end(SVG);
			return;
		}
		res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
		res.end("not found");
	});
	return new Promise((resolve, reject) => {
		const tryListen = (port, attemptsLeft) => {
			const onError = (error) => {
				server.off("error", onError);
				if (error.code === "EADDRINUSE" && attemptsLeft > 0) tryListen(port + 1, attemptsLeft - 1);
				else reject(error);
			};
			server.once("error", onError);
			server.listen(port, "127.0.0.1", () => {
				server.off("error", onError);
				resolve({
					server,
					port
				});
			});
		};
		tryListen(preferredPort, 20);
	});
}
// electron/main/system-proxy.ts
var SystemProxyManager = class {
	constructor() {
		this.systemProxyOwned = false;
		this.systemProxyServices = [];
		this.systemProxyError = "";
	}
	listServices() {
		return new Promise((resolve) => {
			(0, child_process.execFile)("networksetup", ["-listallnetworkservices"], (error, stdout) => {
				if (error) return resolve({
					error: error.message,
					services: []
				});
				resolve({ services: stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("An asterisk") && !line.startsWith("*")) });
			});
		});
	}
	runNetworksetup(args) {
		return new Promise((resolve) => {
			(0, child_process.execFile)("networksetup", args, (error, stdout, stderr) => {
				resolve({
					ok: !error,
					message: error ? `${error.message} ${stderr || ""}`.trim() : stdout.trim()
				});
			});
		});
	}
	async disableRememberedServices() {
		const services = this.systemProxyServices.slice();
		const errors = [];
		for (const service of services) for (const args of [[
			"-setwebproxystate",
			service,
			"off"
		], [
			"-setsecurewebproxystate",
			service,
			"off"
		]]) {
			const result = await this.runNetworksetup(args);
			if (!result.ok) errors.push(`${service}: ${result.message}`);
		}
		if (errors.length) {
			this.systemProxyOwned = services.length > 0;
			this.systemProxyError = errors.join("；");
		} else {
			this.systemProxyServices = [];
			this.systemProxyOwned = false;
			this.systemProxyError = "";
		}
		return {
			ok: errors.length === 0,
			message: this.systemProxyError,
			services: this.systemProxyServices,
			enabled: false
		};
	}
	async setSystemProxy(enabled, port, proxyRunning, lastError = "") {
		if (!enabled) return this.disableRememberedServices();
		if (!proxyRunning) {
			this.systemProxyError = lastError || "代理还没启动";
			return {
				ok: false,
				message: this.systemProxyError,
				services: [],
				enabled: false
			};
		}
		const listed = await this.listServices();
		if (listed.error) {
			this.systemProxyError = listed.error;
			return {
				ok: false,
				message: this.systemProxyError,
				services: this.systemProxyServices,
				enabled: this.systemProxyOwned
			};
		}
		if (!listed.services.length) {
			this.systemProxyError = "没有找到已启用的网络服务";
			return {
				ok: false,
				message: this.systemProxyError,
				services: [],
				enabled: false
			};
		}
		const applied = new Set(this.systemProxyServices);
		const errors = [];
		for (const service of listed.services) {
			const web = await this.runNetworksetup([
				"-setwebproxy",
				service,
				"127.0.0.1",
				String(port)
			]);
			if (!web.ok) {
				errors.push(`${service}: ${web.message}`);
				continue;
			}
			const secure = await this.runNetworksetup([
				"-setsecurewebproxy",
				service,
				"127.0.0.1",
				String(port)
			]);
			if (!secure.ok) {
				errors.push(`${service}: ${secure.message}`);
				await this.runNetworksetup([
					"-setwebproxystate",
					service,
					"off"
				]);
				applied.delete(service);
				continue;
			}
			await this.runNetworksetup([
				"-setproxybypassdomains",
				service,
				"*.local",
				"169.254/16"
			]);
			applied.add(service);
		}
		this.systemProxyServices = [...applied];
		this.systemProxyOwned = this.systemProxyServices.length > 0;
		this.systemProxyError = errors.length ? this.systemProxyOwned ? `部分网络未接管：${errors.join("；")}` : errors.join("；") : "";
		return {
			ok: this.systemProxyOwned && errors.length === 0,
			message: this.systemProxyError,
			services: this.systemProxyServices,
			enabled: this.systemProxyOwned
		};
	}
	installCaToKeychain(caPath) {
		return new Promise((resolve) => {
			(0, child_process.execFile)("security", [
				"add-trusted-cert",
				"-r",
				"trustRoot",
				"-p",
				"ssl",
				"-k",
				path.default.join(os.default.homedir(), "Library/Keychains/login.keychain-db"),
				caPath
			], (error) => {
				if (error) resolve({
					ok: false,
					message: `安装失败: ${error.message}`
				});
				else resolve({
					ok: true,
					message: "Flowman CA 证书已成功安装并信任到系统钥匙串！"
				});
			});
		});
	}
};
// electron/main/index.ts
var mainWindow = null;
var proxy;
var certs;
var rules;
var samplePort = 0;
var rulesPath = "";
var sysProxy = new SystemProxyManager();
function send(channel, payload) {
	if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}
function loadRules() {
	try {
		return normalizeRules(JSON.parse(fs.default.readFileSync(rulesPath, "utf8")));
	} catch {
		return normalizeRules({});
	}
}
function saveRules(next) {
	rules = normalizeRules(next);
	fs.default.mkdirSync(path.default.dirname(rulesPath), { recursive: true });
	fs.default.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
	return rules;
}
function statePayload() {
	return {
		...proxy.status(),
		samplePort,
		systemProxy: sysProxy.systemProxyOwned,
		systemProxyServices: sysProxy.systemProxyServices,
		systemProxyError: sysProxy.systemProxyError,
		caFingerprint: certs.fingerprint(),
		caPath: path.default.join(certs.directory, "ca-cert.pem"),
		caDerPath: path.default.join(certs.directory, "ca-cert.der")
	};
}
async function setSystemProxy(enabled) {
	const result = await sysProxy.setSystemProxy(enabled, proxy.port, proxy.status().running, proxy.lastError);
	send("status", statePayload());
	return result;
}
function seedSampleFlow() {
	if (!samplePort || !proxy || !proxy.status().running) return Promise.resolve();
	return new Promise((resolve) => {
		const req = http.default.request({
			host: "127.0.0.1",
			port: proxy.port,
			method: "GET",
			path: `http://127.0.0.1:${samplePort}/hello`,
			headers: {
				host: `127.0.0.1:${samplePort}`,
				"user-agent": "Flowman"
			}
		}, (res) => {
			res.resume();
			res.on("end", resolve);
		});
		req.on("error", () => resolve());
		req.setTimeout(4e3, () => {
			req.destroy();
			resolve();
		});
		req.end();
	});
}
async function openBrowser(url) {
	const browserSession = electron.session.fromPartition("persist:flowman-debug");
	await browserSession.setProxy({
		proxyRules: `http://127.0.0.1:${proxy.port}`,
		proxyBypassRules: "<-loopback>"
	});
	browserSession.setCertificateVerifyProc((_request, callback) => callback(0));
	const window = new electron.BrowserWindow({
		width: 1040,
		height: 760,
		title: "Flowman 调试浏览器",
		backgroundColor: "#f4f7fb",
		webPreferences: {
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			webviewTag: true
		}
	});
	const targetUrl = url || (samplePort ? `http://127.0.0.1:${samplePort}/` : `http://127.0.0.1:${proxy.port}/`);
	if (process.env.VITE_DEV_SERVER_URL) await window.loadURL(`${process.env.VITE_DEV_SERVER_URL}browser.html?url=${encodeURIComponent(targetUrl)}`);
	else await window.loadFile(path.default.join(__dirname, "../../dist/browser.html"), { query: { url: targetUrl } });
}
function buildMenu() {
	electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate([
		{
			label: "Flowman",
			submenu: [
				{
					label: "关于 Flowman",
					click: () => {
						if (mainWindow) electron.dialog.showMessageBox(mainWindow, {
							type: "info",
							title: "关于 Flowman",
							message: "Flowman (Vue 3 + TS + Vite)",
							detail: "现代化的本地 HTTP/HTTPS 调试代理。采用 Vue 3、TypeScript 与 Vite 现代架构重构实现。"
						});
					}
				},
				{ type: "separator" },
				{
					role: "quit",
					label: "退出"
				}
			]
		},
		{
			label: "文件",
			submenu: [
				{
					label: "清除会话",
					accelerator: "Shift+Cmd+Backspace",
					click: () => proxy.clear()
				},
				{
					label: "导出 HAR",
					click: () => exportHar()
				},
				{
					label: "导出 CA 证书",
					click: () => exportCa()
				}
			]
		},
		{
			label: "视图",
			submenu: [
				{
					role: "reload",
					label: "重新加载"
				},
				{
					role: "toggleDevTools",
					label: "开发者工具"
				},
				{
					role: "togglefullscreen",
					label: "进入全屏"
				}
			]
		},
		{
			label: "工具",
			submenu: [
				{
					label: "Compose",
					accelerator: "Cmd+N",
					click: () => send("menu", "compose")
				},
				{
					label: "工具页",
					accelerator: "Cmd+T",
					click: () => send("menu", "tools")
				},
				{
					label: "调试浏览器",
					click: () => openBrowser()
				}
			]
		}
	]));
}
async function exportHar() {
	if (!mainWindow) return { ok: false };
	const result = await electron.dialog.showSaveDialog(mainWindow, {
		defaultPath: "flowman-session.har",
		filters: [{
			name: "HAR",
			extensions: ["har"]
		}]
	});
	if (result.canceled || !result.filePath) return { ok: false };
	fs.default.writeFileSync(result.filePath, JSON.stringify(proxy.toHar(), null, 2));
	return {
		ok: true,
		filePath: result.filePath
	};
}
async function exportCa() {
	if (!mainWindow) return { ok: false };
	const result = await electron.dialog.showSaveDialog(mainWindow, {
		defaultPath: "flowman-ca.pem",
		filters: [{
			name: "PEM",
			extensions: ["pem"]
		}, {
			name: "DER",
			extensions: ["cer", "der"]
		}]
	});
	if (result.canceled || !result.filePath) return { ok: false };
	if (result.filePath.endsWith(".cer") || result.filePath.endsWith(".der")) fs.default.writeFileSync(result.filePath, certs.der());
	else fs.default.writeFileSync(result.filePath, certs.caCertPem);
	return {
		ok: true,
		filePath: result.filePath
	};
}
function registerIpc() {
	electron.ipcMain.handle("state", () => statePayload());
	electron.ipcMain.handle("recording", async (_event, value) => {
		proxy.setRecording(value);
		if (value) await setSystemProxy(true);
		return statePayload();
	});
	electron.ipcMain.handle("clear", () => {
		proxy.clear();
		return statePayload();
	});
	electron.ipcMain.handle("rules:get", () => rules);
	electron.ipcMain.handle("rules:save", async (_event, next) => {
		let updateError = "";
		try {
			await proxy.updateRules(next);
			saveRules(next);
		} catch (error) {
			updateError = error.message;
			proxy.lastError = error.message;
		}
		return {
			ok: !updateError,
			error: updateError,
			rules,
			state: statePayload()
		};
	});
	electron.ipcMain.handle("flows", () => proxy.listSummaries());
	electron.ipcMain.handle("flow", (_event, id) => proxy.getFlow(id));
	electron.ipcMain.handle("search", (_event, query) => proxy.search(query));
	electron.ipcMain.handle("export-har", () => exportHar());
	electron.ipcMain.handle("export-ca", () => exportCa());
	electron.ipcMain.handle("install-ca", async () => {
		const caPath = path.default.join(certs.directory, "ca-cert.pem");
		return sysProxy.installCaToKeychain(caPath);
	});
	electron.ipcMain.handle("reveal-ca", () => {
		electron.shell.showItemInFolder(path.default.join(certs.directory, "ca-cert.pem"));
		return true;
	});
	electron.ipcMain.handle("repeat", (_event, id) => proxy.repeat(id));
	electron.ipcMain.handle("compose", (_event, payload) => proxy.compose(payload));
	electron.ipcMain.handle("break:resolve", (_event, payload) => {
		return proxy.resolveBreakpoint(payload.id, payload.decision);
	});
	electron.ipcMain.handle("system-proxy", (_event, enabled) => setSystemProxy(enabled));
	electron.ipcMain.handle("browser", (_event, url) => openBrowser(url));
	electron.ipcMain.handle("select-file", async () => {
		if (!mainWindow) return "";
		const result = await electron.dialog.showOpenDialog(mainWindow, { properties: ["openFile"] });
		return result.canceled ? "" : result.filePaths[0];
	});
	electron.ipcMain.handle("highlight", (_event, payload) => {
		return proxy.highlight(payload.id, payload.color);
	});
}
function createWindow() {
	mainWindow = new electron.BrowserWindow({
		width: 1380,
		height: 880,
		minWidth: 1040,
		minHeight: 680,
		title: "Flowman",
		titleBarStyle: "hiddenInset",
		trafficLightPosition: {
			x: 16,
			y: 18
		},
		backgroundColor: "#e8edf3",
		webPreferences: {
			preload: path.default.join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(path.default.join(__dirname, "../../dist/index.html"));
}
electron.app.whenReady().then(async () => {
	const userData = electron.app.getPath("userData");
	rulesPath = path.default.join(userData, "rules.json");
	certs = new CertStore(path.default.join(userData, "certs"));
	certs.load();
	fs.default.writeFileSync(path.default.join(certs.directory, "ca-cert.der"), certs.der());
	rules = loadRules();
	proxy = new DebugProxy({
		certStore: certs,
		rules
	});
	proxy.on("flow", (flow) => send("flow", flow));
	proxy.on("flow-update", (flow) => send("flow-update", flow));
	proxy.on("breakpoint", (data) => send("breakpoint", data));
	proxy.on("status", () => send("status", statePayload()));
	proxy.on("cleared", () => send("cleared"));
	try {
		samplePort = (await startSample(9108)).port;
	} catch (error) {
		samplePort = 0;
		proxy.lastError = `示例服务启动失败: ${error.message}`;
	}
	try {
		await proxy.start(rules.port);
	} catch (error) {
		const originalPort = rules.port;
		let startedFallback = false;
		if (rules.port !== 9001) try {
			await proxy.start(9001);
			rules.port = 9001;
			saveRules(rules);
			proxy.lastError = `端口 ${originalPort} 已被占用，已自动切换至端口 9001`;
			startedFallback = true;
		} catch {}
		if (!startedFallback) proxy.lastError = `代理端口 ${originalPort} 启动失败: ${error.message}`;
	}
	registerIpc();
	buildMenu();
	await seedSampleFlow();
	if (proxy.recording) await setSystemProxy(true);
	createWindow();
});
var quitting = false;
electron.app.on("before-quit", (event) => {
	if (quitting) return;
	event.preventDefault();
	quitting = true;
	const owned = sysProxy.systemProxyOwned;
	sysProxy.systemProxyOwned = false;
	(owned ? sysProxy.disableRememberedServices() : Promise.resolve()).finally(async () => {
		if (proxy) await proxy.stop();
		electron.app.exit(0);
	});
});
electron.app.on("window-all-closed", () => {
	electron.app.quit();
});
electron.app.on("activate", () => {
	if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
