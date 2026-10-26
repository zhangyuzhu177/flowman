import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { URL } from 'url';
import type { FlowDetail, FlowSummary, FlowmanRules, BodyRepresentation, BreakpointDecision, BreakpointEvent } from '../../../src/types/flow';
import { CertStore } from './certs';
import { matchPattern, requestMatches, enabledRules } from './rules';
import { applyScripts } from './scripting';

const MAX_CAPTURE = 1024 * 1024;
const MAX_EDIT = 8 * 1024 * 1024;
const HOP = new Set([
  'connection',
  'proxy-connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

function closeServer(server: http.Server | null): Promise<void> {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBody(stream: NodeJS.ReadableStream, limit: number): Promise<{ body: Buffer; total: number; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    stream.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total <= limit) chunks.push(chunk);
    });
    stream.on('end', () => resolve({ body: Buffer.concat(chunks), total, truncated: total > limit }));
    stream.on('error', reject);
  });
}

export function pairsFromRaw(rawHeaders: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let index = 0; index < rawHeaders.length; index += 2) {
    pairs.push([rawHeaders[index], rawHeaders[index + 1]]);
  }
  return pairs;
}

export function pairsToObject(input: any, keepHop = false): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  if (!input) return headers;
  if (!Array.isArray(input)) {
    if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        const lower = key.toLowerCase();
        if (!keepHop && HOP.has(lower)) continue;
        headers[lower] = value as string | string[];
      }
    }
    return headers;
  }
  if (input.length === 0) return headers;

  if (Array.isArray(input[0])) {
    for (const [name, value] of input) {
      if (name == null) continue;
      const key = String(name).toLowerCase();
      if (!keepHop && HOP.has(key)) continue;
      if (headers[key] == null) headers[key] = value;
      else if (Array.isArray(headers[key])) (headers[key] as string[]).push(value);
      else headers[key] = [headers[key] as string, value];
    }
  } else {
    for (let index = 0; index < input.length; index += 2) {
      const name = input[index];
      const value = input[index + 1];
      if (name == null) continue;
      const key = String(name).toLowerCase();
      if (!keepHop && HOP.has(key)) continue;
      if (headers[key] == null) headers[key] = value;
      else if (Array.isArray(headers[key])) (headers[key] as string[]).push(value);
      else headers[key] = [headers[key] as string, value];
    }
  }
  return headers;
}

export function objectToPairs(headers: Record<string, any> | undefined): [string, string][] {
  const pairs: [string, string][] = [];
  if (!headers) return pairs;
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) value.forEach((item) => pairs.push([name, String(item)]));
    else if (value != null) pairs.push([name, String(value)]);
  }
  return pairs;
}

export function headerValue(headers: Record<string, any> | undefined, name: string): string {
  if (!headers) return '';
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value.join(', ');
  return value == null ? '' : String(value);
}

function decodeBuffer(buffer: Buffer, encoding: string): Buffer {
  const value = String(encoding || '').toLowerCase();
  try {
    if (value.includes('br')) return zlib.brotliDecompressSync(buffer);
    if (value.includes('gzip')) return zlib.gunzipSync(buffer);
    if (value.includes('deflate')) return zlib.inflateSync(buffer);
  } catch (error) {
    return buffer;
  }
  return buffer;
}

function looksText(buffer: Buffer): boolean {
  if (!buffer.length) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 1000));
  let odd = 0;
  for (const byte of sample) if (byte === 0) return false;
  else if (byte < 9 || (byte > 13 && byte < 32)) odd += 1;
  return odd / sample.length < 0.08;
}

export function presentBody(buffer: Buffer, headers: Record<string, any>): BodyRepresentation {
  const contentType = headerValue(headers, 'content-type');
  const decoded = decodeBuffer(buffer, headerValue(headers, 'content-encoding'));
  const textLike = /json|text|xml|javascript|svg|x-www-form-urlencoded|graphql|\+xml/i.test(contentType) || looksText(decoded);
  const clipped = decoded.subarray(0, MAX_CAPTURE);
  return {
    size: buffer.length,
    decodedSize: decoded.length,
    truncated: decoded.length > MAX_CAPTURE,
    contentType,
    text: textLike ? clipped.toString('utf8') : '',
    base64: !textLike && decoded.length <= 400000 ? decoded.toString('base64') : '',
  };
}

export function appNameFromUA(userAgent: string): string {
  const source = String(userAgent || '');
  const known: [RegExp, string][] = [
    [/Postman/i, 'Postman'],
    [/curl\//i, 'curl'],
    [/python-requests|aiohttp|httpx/i, 'Python'],
    [/Go-http-client/i, 'Go'],
    [/Flowman/i, 'Flowman'],
    [/Electron/i, 'Electron'],
    [/Edg\//i, 'Edge'],
    [/Chrome\//i, 'Chrome'],
    [/Firefox\//i, 'Firefox'],
    [/Safari\//i, 'Safari'],
  ];
  for (const [pattern, name] of known) if (pattern.test(source)) return name;
  return '未知应用';
}

function contextFromUrl(urlString: string, method: string, headers: Record<string, any>) {
  const url = new URL(urlString);
  return {
    method: method.toUpperCase(),
    protocol: url.protocol.replace(':', ''),
    host: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    path: url.pathname || '/',
    query: url.search.startsWith('?') ? url.search.slice(1) : '',
    url: url.toString(),
    headers,
  };
}

export class DebugProxy extends EventEmitter {
  certStore: CertStore;
  rules: FlowmanRules;
  flows: FlowDetail[];
  sequence = 0;
  recording = true;
  server: http.Server | null = null;
  secureHttp: http.Server | null = null;
  reverseServers: http.Server[] = [];
  pendingBreaks = new Map<string, { resolve: (decision: BreakpointDecision) => void; timer: NodeJS.Timeout }>();
  port: number;
  lastError = '';

  constructor({ certStore, rules }: { certStore: CertStore; rules: FlowmanRules }) {
    super();
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
      error: this.lastError || '',
    };
  }

  async start(port: number): Promise<void> {
    await this.stop();
    this.port = port;
    this.rules.port = port;
    this.secureHttp = http.createServer((req, res) => {
      this.onHttp(req, res, true).catch((error) => this.failResponse(res, error));
    });
    this.secureHttp.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket as net.Socket, head, true));
    this.secureHttp.on('clientError', (_error, socket) => socket.destroy());

    this.server = http.createServer((req, res) => {
      this.onHttp(req, res, false).catch((error) => this.failResponse(res, error));
    });
    this.server.on('connect', (req, socket, head) => this.onConnect(req, socket as net.Socket, head));
    this.server.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket as net.Socket, head, false));
    this.server.on('clientError', (_error, socket) => {
      if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    await listen(this.server, port);
    await this.syncReverse();
    this.lastError = '';
    this.emit('status', this.status());
  }

  async stop(): Promise<void> {
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

  async updateRules(rules: FlowmanRules): Promise<void> {
    const previous = this.port;
    const wasListening = Boolean(this.server && this.server.listening);
    this.rules = rules;
    if (rules.port !== previous || !wasListening) await this.start(rules.port);
    else await this.syncReverse();
    this.emit('status', this.status());
  }

  setRecording(recording: boolean): void {
    this.recording = Boolean(recording);
    this.emit('status', this.status());
  }

  clear(): void {
    this.flows = [];
    this.emit('cleared');
    this.emit('status', this.status());
  }

  listSummaries(): FlowSummary[] {
    return this.flows.map((flow) => this.summary(flow));
  }

  getFlow(id: string): FlowDetail | null {
    return this.flows.find((flow) => flow.id === id) || null;
  }

  search(query: string): FlowSummary[] {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return this.listSummaries();
    return this.flows
      .filter((flow) => {
        const haystack = [
          flow.url,
          flow.method,
          String(flow.status || ''),
          flow.appName,
          flow.request.text,
          flow.response.text,
          JSON.stringify(flow.request.headers),
          JSON.stringify(flow.response.headers),
        ].join('\n').toLowerCase();
        return haystack.includes(needle);
      })
      .map((flow) => this.summary(flow));
  }

  summary(flow: FlowDetail): FlowSummary {
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
      contentType: (flow.response && flow.response.contentType) || '',
      responseSize: (flow.response && flow.response.size) || 0,
      requestSize: (flow.request && flow.request.size) || 0,
      flags: flow.flags,
    };
  }

  shouldCapture(request: { method: string; host: string; path: string; query?: string }): boolean {
    if (!this.recording) return false;
    if (!this.rules.allow.enabled) return true;
    return enabledRules(this.rules.allow).some((rule) => requestMatches(rule, request));
  }

  shouldIntercept(host: string): boolean {
    if (!this.rules.ssl.enabled) return false;
    const included = (this.rules.ssl.include || []).filter((rule) => rule.enabled !== false);
    const excluded = (this.rules.ssl.exclude || []).filter((rule) => rule.enabled !== false);
    const matchInclude = included.some((rule) => matchPattern(rule.pattern || '*', host));
    if (!matchInclude) return false;
    return !excluded.some((rule) => matchPattern(rule.pattern || '*', host));
  }

  onConnect(req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer): void {
    const [host, portRaw] = String(req.url || '').split(':');
    const port = Number(portRaw || 443);
    clientSocket.on('error', () => {});
    if (!host || !this.shouldIntercept(host)) {
      this.tunnel(clientSocket, head, host, port);
      return;
    }
    const issued = this.certStore.issue(host);
    const secureContext = tls.createSecureContext({ key: issued.key, cert: issued.cert });
    (clientSocket as any).flowTarget = { host, port };
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length) clientSocket.unshift(head);
    const tlsSocket = new tls.TLSSocket(clientSocket, { isServer: true, secureContext });
    (tlsSocket as any).flowTarget = { host, port };
    tlsSocket.on('error', (error) => {
      const flow = this.makeFlow({
        method: 'CONNECT',
        url: `https://${host}${port && port !== 443 ? `:${port}` : ''}`,
        protocol: 'https',
        host,
        port,
        path: '/',
        query: '',
      }, {
        started: Date.now(),
        source: 'proxy',
        status: 526,
        error: `SSL 握手失败: ${error.message}（需在系统钥匙串中信任 Flowman CA）`,
        flags: { sslFailed: true },
      });
      this.addFlow(flow);
      clientSocket.destroy();
    });
    tlsSocket.once('secure', () => {
      if (this.secureHttp) this.secureHttp.emit('connection', tlsSocket);
    });
  }

  tunnel(clientSocket: net.Socket, head: Buffer, host: string, port: number): void {
    const started = Date.now();
    const flow = this.makeFlow({
      method: 'CONNECT',
      url: `https://${host}${port && port !== 443 ? `:${port}` : ''}`,
      protocol: 'https',
      host,
      port,
      path: '/',
      query: '',
    }, {
      started,
      source: 'proxy',
      status: 200,
      flags: { tunnel: true },
      responseHeaders: [['x-flowman-tunnel', 'tcp']],
    });
    let clientBytes = 0;
    let serverBytes = 0;
    const upstream = net.connect(port, host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length) upstream.write(head);
      clientSocket.on('data', (chunk) => { clientBytes += chunk.length; });
      upstream.on('data', (chunk) => { serverBytes += chunk.length; });
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
      this.addFlow(flow);
    });
    const finalize = (error?: Error) => {
      if (error && flow.status === 200) {
        flow.status = 502;
        flow.error = error.message;
      }
      flow.duration = Date.now() - started;
      if (flow.request) flow.request.size = clientBytes;
      if (flow.response) flow.response.size = serverBytes;
      this.emit('flow-update', this.summary(flow));
      upstream.destroy();
      clientSocket.destroy();
    };
    upstream.on('error', finalize);
    upstream.on('close', () => finalize());
    clientSocket.on('error', finalize);
    clientSocket.on('close', () => finalize());
  }

  async onHttp(req: http.IncomingMessage, res: http.ServerResponse, secure: boolean): Promise<void> {
    const started = Date.now();
    let request: any;
    if (secure || !/^https?:\/\//i.test(req.url || '')) {
      const hostHeader = req.headers.host || 'unknown';
      const proto = secure ? 'https:' : 'http:';
      request = contextFromUrl(`${proto}//${hostHeader}${req.url}`, req.method || 'GET', pairsToObject(req.rawHeaders || []));
      const stamped = (req.socket as any)?.flowTarget || ((req.socket as any)?._parent && (req.socket as any)._parent.flowTarget);
      if (secure && stamped) {
        request.host = stamped.host;
        request.port = stamped.port;
        request.protocol = 'https';
        const pathAndQuery = req.url || '/';
        request.url = `https://${stamped.host}${stamped.port && stamped.port !== 443 ? `:${stamped.port}` : ''}${pathAndQuery}`;
        const parsed = new URL(request.url);
        request.path = parsed.pathname;
        request.query = parsed.search.startsWith('?') ? parsed.search.slice(1) : '';
      }
    } else {
      request = contextFromUrl(req.url || '/', req.method || 'GET', pairsToObject(req.rawHeaders || []));
    }
    const contentLength = Number(req.headers['content-length'] || 0);
    const modifying = this.needsBuffer(request);
    if (!modifying && contentLength <= MAX_EDIT) {
      await this.streamForward(req, res, request, started);
      return;
    }
    const read = await readBody(req, MAX_EDIT);
    if (read.truncated) {
      this.writePlain(res, 413, '请求体超过 Flowman 可编辑上限（8MB）');
      this.addFlow(this.makeFlow(request, { status: 413, error: 'body too large', started, source: 'proxy' }));
      return;
    }
    await this.execute({
      request,
      body: read.body,
      rawHeaders: req.rawHeaders || [],
      response: res,
      started,
      source: 'proxy',
    });
  }

  needsBuffer(request: any): boolean {
    return Boolean(
      (this.rules.block.enabled && enabledRules(this.rules.block).some((rule) => requestMatches(rule, request))) ||
      (this.rules.mapLocal.enabled && enabledRules(this.rules.mapLocal).some((rule) => requestMatches(rule, request))) ||
      (this.rules.mapRemote.enabled && enabledRules(this.rules.mapRemote).some((rule) => requestMatches(rule, request))) ||
      (this.rules.breakpoints.enabled && enabledRules(this.rules.breakpoints).some((rule) => requestMatches(rule, request))) ||
      (this.rules.scripts.enabled && enabledRules(this.rules.scripts).length)
    );
  }

  async streamForward(req: http.IncomingMessage, res: http.ServerResponse, request: any, started: number): Promise<void> {
    const headers = pairsToObject(req.rawHeaders || []);
    if (this.rules.noCaching) this.applyNoCache(headers);
    const requestHeaders = pairsFromRaw(req.rawHeaders || []);
    const reqChunks: Buffer[] = [];
    const flowBase = this.makeFlow(request, { started, source: 'proxy', requestHeaders, requestBody: Buffer.alloc(0) });
    try {
      if (this.rules.throttle.latencyMs) await sleep(this.rules.throttle.latencyMs);
      const onReqChunk = (chunk: Buffer) => {
        if (reqChunks.reduce((acc, c) => acc + c.length, 0) < MAX_CAPTURE) reqChunks.push(chunk);
      };
      const upstream = await this.openUpstream(request, req.method || 'GET', headers, req, onReqChunk);
      const chunks: Buffer[] = [];
      let size = 0;
      res.writeHead(upstream.status, this.headersForRaw(upstream.rawHeaders, null));
      upstream.stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= MAX_CAPTURE) chunks.push(chunk);
        if (!this.writeThrottled(res, chunk)) res.write(chunk);
      });
      await new Promise((resolve, reject) => {
        upstream.stream.on('end', resolve);
        upstream.stream.on('error', reject);
      });
      res.end();
      const body = Buffer.concat(chunks);
      const reqBody = Buffer.concat(reqChunks);
      flowBase.status = upstream.status;
      if (reqBody.length > 0) {
        flowBase.request = {
          headers: requestHeaders,
          ...presentBody(reqBody, headers),
        };
      }
      flowBase.response = presentBody(body, pairsToObject(upstream.rawHeaders));
      flowBase.response.headers = pairsFromRaw(upstream.rawHeaders);
      flowBase.response.size = size;
      flowBase.duration = Date.now() - started;
      this.addFlow(flowBase);
    } catch (error: any) {
      if (!res.headersSent) this.writePlain(res, 502, error.message);
      else res.end();
      flowBase.status = 502;
      flowBase.error = error.message;
      flowBase.duration = Date.now() - started;
      this.addFlow(flowBase);
    }
  }

  writeThrottled(res: http.ServerResponse, chunk: Buffer): boolean {
    const kbps = this.rules.throttle.enabled ? this.rules.throttle.downloadKbps : 0;
    if (!kbps) return false;
    const bytesPerSecond = (kbps * 1024) / 8;
    const delay = Math.min(2000, (chunk.length / bytesPerSecond) * 1000);
    res.write(chunk);
    if (res.socket) (res.socket as any).pause?.();
    setTimeout(() => res.socket && (res.socket as any).resume?.(), delay);
    return true;
  }

  async execute({ request, body, rawHeaders, response, started, source }: any): Promise<FlowDetail | null> {
    const flags: Record<string, boolean> = {};
    let headers = pairsToObject(rawHeaders && rawHeaders.length ? rawHeaders : objectToPairs(request.headers || {}));
    let method = request.method;
    let current = { ...request };
    let payload = body || Buffer.alloc(0);
    const scriptErrors: string[] = [];

    const block = this.rules.block.enabled
      ? enabledRules(this.rules.block).find((rule) => requestMatches(rule, current))
      : null;
    if (block) {
      if (block.action === 'hide') {
        response.socket?.destroy();
        return null;
      }
      const message = Buffer.from('Blocked by Flowman');
      this.writePlain(response, block.status || 403, message.toString());
      const flow = this.makeFlow(current, {
        started,
        source,
        status: block.status || 403,
        flags: { blocked: true },
        requestHeaders: objectToPairs(headers),
        requestBody: payload,
        responseHeaders: [['content-type', 'text/plain']],
        responseBody: message,
      });
      this.addFlow(flow);
      return flow;
    }

    const local = this.rules.mapLocal.enabled
      ? enabledRules(this.rules.mapLocal).find((rule) => requestMatches(rule, current))
      : null;
    if (local) {
      flags.mappedLocal = true;
      let fileBody = Buffer.from('map local file missing');
      let status = 404;
      try {
        fileBody = fs.readFileSync(local.file || '');
        status = 200;
      } catch (error: any) {
        fileBody = Buffer.from(error.message);
      }
      const type = local.contentType || contentTypeFor(local.file || '');
      response.writeHead(status, {
        'content-type': type,
        'content-length': fileBody.length,
        'x-flowman-map': 'local',
      });
      response.end(fileBody);
      const flow = this.makeFlow(current, {
        started,
        source,
        status,
        flags,
        requestHeaders: objectToPairs(headers),
        requestBody: payload,
        responseHeaders: [['content-type', type]],
        responseBody: fileBody,
      });
      this.addFlow(flow);
      return flow;
    }

    const remote = this.rules.mapRemote.enabled
      ? enabledRules(this.rules.mapRemote).find((rule) => requestMatches(rule, current))
      : null;
    if (remote && remote.targetUrl) {
      flags.mappedRemote = true;
      const target = new URL(remote.targetUrl);
      const next = new URL(current.url);
      next.protocol = target.protocol;
      next.hostname = target.hostname;
      next.port = target.port;
      if (target.pathname && target.pathname !== '/') next.pathname = target.pathname;
      if (target.search) next.search = target.search;
      current = contextFromUrl(next.toString(), method, headers);
      if (!remote.preserveHost) headers.host = target.host;
    }

    if (this.rules.noCaching) this.applyNoCache(headers);

    const breakpoint = this.matchingBreakpoint(current);
    if (breakpoint && breakpoint.phase !== 'response') {
      const decision = await this.askBreakpoint({
        phase: 'request',
        request: this.publicRequest(method, current.url, headers, payload),
      });
      if (!decision || decision.action === 'abort') {
        this.writePlain(response, 499, 'Breakpoint aborted');
        return null;
      }
      const edited = decision.request || {};
      method = String(edited.method || method).toUpperCase();
      current = contextFromUrl(edited.url || current.url, method, (edited.headers as any) || headers);
      headers = (edited.headers as any) || headers;
      payload = Buffer.from(edited.body || '');
    }

    if (this.rules.scripts.enabled) {
      const scripted = applyScripts(
        enabledRules(this.rules.scripts),
        'onRequest',
        this.publicRequest(method, current.url, headers, payload)
      );
      scriptErrors.push(...scripted.errors);
      if (scripted.request) {
        flags.scripted = true;
        method = String(scripted.request.method || method).toUpperCase();
        headers = scripted.request.headers || headers;
        payload = Buffer.from(scripted.request.body || '');
        current = contextFromUrl(scripted.request.url || current.url, method, headers);
      }
    }

    if (this.rules.throttle.latencyMs) await sleep(this.rules.throttle.latencyMs);

    let upstream: any;
    try {
      upstream = await this.fetch(current.url, method, headers, payload);
    } catch (error: any) {
      this.writePlain(response, 502, error.message);
      const flow = this.makeFlow(current, {
        started,
        source,
        status: 502,
        error: error.message,
        flags,
        requestHeaders: objectToPairs(headers),
        requestBody: payload,
      });
      flow.scriptErrors = scriptErrors;
      this.addFlow(flow);
      return flow;
    }

    let status = upstream.status;
    let responseHeaders = pairsToObject(upstream.rawHeaders);
    let responseBody = upstream.body;

    if (breakpoint && breakpoint.phase !== 'request') {
      const decision = await this.askBreakpoint({
        phase: 'response',
        request: this.publicRequest(method, current.url, headers, payload),
        response: this.publicResponse(status, responseHeaders, responseBody),
      });
      if (!decision || decision.action === 'abort') {
        this.writePlain(response, 499, 'Breakpoint aborted');
        return null;
      }
      if (decision.response) {
        status = Number(decision.response.status || status);
        responseHeaders = (decision.response.headers as any) || responseHeaders;
        responseBody = Buffer.from(decision.response.body || '');
        delete responseHeaders['content-encoding'];
      }
    }

    if (this.rules.scripts.enabled) {
      const scripted = applyScripts(
        enabledRules(this.rules.scripts),
        'onResponse',
        this.publicRequest(method, current.url, headers, payload),
        this.publicResponse(status, responseHeaders, responseBody)
      );
      scriptErrors.push(...scripted.errors);
      if (scripted.response) {
        flags.scripted = true;
        status = Number(scripted.response.status || status);
        responseHeaders = scripted.response.headers || responseHeaders;
        responseBody = Buffer.from(scripted.response.body || '');
        delete responseHeaders['content-encoding'];
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
      responseBody,
    });
    flow.scriptErrors = scriptErrors;
    this.addFlow(flow);
    return flow;
  }

  matchingBreakpoint(request: any) {
    if (!this.rules.breakpoints.enabled) return null;
    return enabledRules(this.rules.breakpoints).find((rule) => requestMatches(rule, request)) || null;
  }

  askBreakpoint(payload: BreakpointEvent): Promise<BreakpointDecision> {
    const id = crypto.randomBytes(6).toString('hex');
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingBreaks.delete(id);
        resolve({ action: 'continue' });
      }, 120000);
      this.pendingBreaks.set(id, { resolve, timer });
      this.emit('breakpoint', { id, ...payload });
    });
  }

  resolveBreakpoint(id: string, decision: BreakpointDecision): boolean {
    const pending = this.pendingBreaks.get(id);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pendingBreaks.delete(id);
    pending.resolve(decision || { action: 'continue' });
    return true;
  }

  applyNoCache(headers: Record<string, any>): void {
    delete headers['if-none-match'];
    delete headers['if-modified-since'];
    headers['cache-control'] = 'no-cache';
    headers.pragma = 'no-cache';
  }

  publicRequest(method: string, url: string, headers: Record<string, any>, body: Buffer) {
    return {
      method,
      url,
      headers: { ...headers },
      body: body.toString('utf8'),
    };
  }

  publicResponse(status: number, headers: Record<string, any>, body: Buffer) {
    const decoded = decodeBuffer(body, headerValue(headers, 'content-encoding'));
    return {
      status,
      headers: { ...headers },
      body: decoded.toString('utf8'),
    };
  }

  async fetch(urlString: string, method: string, headers: Record<string, any>, body: Buffer): Promise<{ status: number; rawHeaders: string[]; body: Buffer }> {
    const url = new URL(urlString);
    const outbound = { ...headers };
    delete outbound['content-length'];
    if (body.length) outbound['content-length'] = String(body.length);
    outbound.connection = 'close';
    const external = this.rules.externalProxy;
    if (external.enabled && external.host && external.port && url.protocol === 'http:') {
      return this.bufferedRequest({
        hostname: external.host,
        port: Number(external.port),
        method,
        path: url.href,
        headers: outbound,
        body,
      });
    }
    if (external.enabled && external.host && external.port && url.protocol === 'https:') {
      const tunnel = await this.connectTunnel(external.host, Number(external.port), url.hostname, Number(url.port || 443));
      return this.bufferedTlsRequest(tunnel, url, method, outbound, body);
    }
    return this.bufferedRequest({
      protocol: url.protocol,
      hostname: url.hostname,
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
      servername: url.hostname,
      method,
      path: `${url.pathname}${url.search}`,
      headers: outbound,
      body,
      tls: url.protocol === 'https:',
    });
  }

  upstreamTls() {
    return {
      ca: [...tls.rootCertificates, this.certStore.caCertPem],
      rejectUnauthorized: !this.rules.ssl.ignoreUpstreamTls,
    };
  }

  bufferedRequest(options: any): Promise<{ status: number; rawHeaders: string[]; body: Buffer }> {
    const library = options.tls || options.protocol === 'https:' ? https : http;
    const tlsOptions = options.tls || options.protocol === 'https:' ? this.upstreamTls() : {};
    return new Promise((resolve, reject) => {
      const req = library.request({
        hostname: options.hostname,
        port: options.port,
        method: options.method,
        path: options.path,
        headers: options.headers,
        servername: options.servername,
        agent: false,
        timeout: 30000,
        ...tlsOptions,
      }, (res) => {
        readBody(res, MAX_EDIT).then((read) => {
          resolve({ status: res.statusCode || 0, rawHeaders: res.rawHeaders, body: read.body });
        }).catch(reject);
      });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('upstream timeout')));
      if (options.body && options.body.length) req.write(options.body);
      req.end();
    });
  }

  openUpstream(request: any, method: string, headers: Record<string, any>, incoming?: NodeJS.ReadableStream, onReqChunk?: (chunk: Buffer) => void): Promise<{ status: number; rawHeaders: string[]; stream: http.IncomingMessage }> {
    const outbound = { ...headers, connection: 'close' };
    return new Promise((resolve, reject) => {
      const library = request.protocol === 'https' ? https : http;
      const req = library.request({
        hostname: request.host,
        port: request.port,
        method,
        path: `${request.path}${request.query ? `?${request.query}` : ''}`,
        headers: outbound,
        servername: request.host,
        agent: false,
        timeout: 30000,
        ...(request.protocol === 'https' ? this.upstreamTls() : {}),
      }, (res) => resolve({ status: res.statusCode || 0, rawHeaders: res.rawHeaders, stream: res }));
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('upstream timeout')));
      if (incoming) {
        if (onReqChunk) (incoming as any).on('data', onReqChunk);
        incoming.pipe(req);
      } else req.end();
    });
  }

  connectTunnel(proxyHost: string, proxyPort: number, host: string, port: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = net.connect(proxyPort, proxyHost, () => {
        socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
      });
      let buffer = Buffer.alloc(0);
      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        const index = buffer.indexOf('\r\n\r\n');
        if (index === -1) return;
        socket.off('data', onData);
        const header = buffer.slice(0, index).toString('latin1');
        if (!/^HTTP\/1\.[01] 200/i.test(header)) {
          socket.destroy();
          reject(new Error(header.split('\r\n')[0] || 'external proxy rejected CONNECT'));
          return;
        }
        const rest = buffer.slice(index + 4);
        if (rest.length) socket.unshift(rest);
        resolve(socket);
      };
      socket.on('data', onData);
      socket.on('error', reject);
    });
  }

  bufferedTlsRequest(socket: net.Socket, url: URL, method: string, headers: Record<string, any>, body: Buffer): Promise<{ status: number; rawHeaders: string[]; body: Buffer }> {
    return new Promise((resolve, reject) => {
      const tlsSocket = tls.connect({
        socket,
        servername: url.hostname,
        ...this.upstreamTls(),
      }, () => {
        const lines = [`${method} ${url.pathname}${url.search} HTTP/1.1`];
        for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
        tlsSocket.write(`${lines.join('\r\n')}\r\n\r\n`);
        if (body.length) tlsSocket.write(body);
        readHttpResponse(tlsSocket).then(resolve).catch(reject);
      });
      tlsSocket.on('error', reject);
    });
  }

  headersForRaw(rawHeaders: string[], body: Buffer | null): string[] {
    const pairs: string[] = [];
    for (let index = 0; index < rawHeaders.length; index += 2) {
      const name = rawHeaders[index];
      const lower = name.toLowerCase();
      if (HOP.has(lower)) continue;
      if (body && lower === 'content-length') continue;
      pairs.push(name, rawHeaders[index + 1]);
    }
    if (body) pairs.push('Content-Length', String(body.length));
    return pairs;
  }

  headersForObject(headers: Record<string, any>, body: Buffer): string[] {
    const pairs: string[] = [];
    for (const [name, value] of Object.entries(headers || {})) {
      if (HOP.has(name.toLowerCase())) continue;
      if (name.toLowerCase() === 'content-length') continue;
      pairs.push(name, Array.isArray(value) ? value.join(', ') : String(value));
    }
    pairs.push('Content-Length', String(body.length));
    return pairs;
  }

  writePlain(res: http.ServerResponse, status: number, message: string): void {
    if (res.headersSent || res.writableEnded) return;
    const body = Buffer.from(String(message));
    res.writeHead(status, {
      'content-type': 'text/plain; charset=utf-8',
      'content-length': body.length,
      connection: 'close',
    });
    res.end(body);
  }

  failResponse(res: http.ServerResponse, error: Error): void {
    this.lastError = error.message;
    this.writePlain(res, 502, error.message);
    this.emit('status', this.status());
  }

  makeFlow(request: any, extra: any = {}): FlowDetail {
    const requestBody = extra.requestBody || Buffer.alloc(0);
    const responseBody = extra.responseBody || Buffer.alloc(0);
    const requestHeaders = extra.requestHeaders || (request.headers ? (Array.isArray(request.headers) ? request.headers : objectToPairs(request.headers)) : []);
    const responseHeaders = extra.responseHeaders || [];
    const requestObject = pairsToObject(requestHeaders);
    const responseObject = pairsToObject(responseHeaders);
    return {
      id: crypto.randomBytes(8).toString('hex'),
      no: 0,
      startedAt: extra.started || Date.now(),
      duration: extra.started ? Date.now() - extra.started : 0,
      method: request.method,
      url: request.url,
      protocol: request.protocol,
      host: request.host,
      path: request.path || '/',
      query: request.query || '',
      status: extra.status || 0,
      error: extra.error || '',
      appName: appNameFromUA(headerValue(requestObject, 'user-agent')),
      highlight: '',
      source: extra.source || 'proxy',
      websocket: false,
      flags: extra.flags || {},
      scriptErrors: [],
      request: {
        headers: requestHeaders,
        ...presentBody(requestBody, requestObject),
      },
      response: {
        headers: responseHeaders,
        ...presentBody(responseBody, responseObject),
      },
    };
  }

  addFlow(flow: FlowDetail): void {
    if (!this.shouldCapture({ method: flow.method, host: flow.host, path: flow.path, query: flow.query || '' })) return;
    flow.no = ++this.sequence;
    this.flows.push(flow);
    if (this.flows.length > 2000) this.flows.splice(0, this.flows.length - 2000);
    this.emit('flow', this.summary(flow));
    this.emit('status', this.status());
  }

  async compose(input: any): Promise<FlowSummary | null> {
    const method = String(input.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    for (const line of String(input.headers || '').split(/\r?\n/)) {
      const index = line.indexOf(':');
      if (index > 0) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    }
    const request = contextFromUrl(input.url, method, headers);
    const fake = new PassThroughResponse();
    const flow = await this.execute({
      request,
      body: Buffer.from(input.body || ''),
      rawHeaders: objectToPairs(headers).flat(),
      response: fake,
      started: Date.now(),
      source: 'compose',
    });
    return flow ? this.summary(flow) : null;
  }

  async repeat(id: string): Promise<FlowSummary | null> {
    const flow = this.getFlow(id);
    if (!flow) return null;
    return this.compose({
      method: flow.method,
      url: flow.url,
      headers: flow.request.headers.map(([name, value]) => `${name}: ${value}`).join('\n'),
      body: flow.request.text || '',
    });
  }

  highlight(id: string, color: string): FlowSummary | null {
    const flow = this.getFlow(id);
    if (!flow) return null;
    flow.highlight = color || '';
    const summary = this.summary(flow);
    this.emit('flow-update', summary);
    return summary;
  }

  toHar(): any {
    return {
      log: {
        version: '1.2',
        creator: { name: 'Flowman', version: '1.0.0' },
        entries: this.flows.map((flow) => ({
          startedDateTime: new Date(flow.startedAt).toISOString(),
          time: flow.duration || 0,
          request: {
            method: flow.method,
            url: flow.url,
            httpVersion: 'HTTP/1.1',
            headers: (flow.request.headers || []).map(([name, value]) => ({ name, value })),
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: flow.request.size || 0,
            postData: flow.request.text ? { mimeType: flow.request.contentType || 'text/plain', text: flow.request.text } : undefined,
          },
          response: {
            status: flow.status,
            statusText: String(flow.status),
            httpVersion: 'HTTP/1.1',
            headers: (flow.response.headers || []).map(([name, value]) => ({ name, value })),
            cookies: [],
            content: { size: flow.response.size || 0, mimeType: flow.response.contentType || '', text: flow.response.text || '' },
            redirectURL: '',
            headersSize: -1,
            bodySize: flow.response.size || 0,
          },
          cache: {},
          timings: { send: 0, wait: flow.duration || 0, receive: 0 },
        })),
      },
    };
  }

  async syncReverse(): Promise<void> {
    await Promise.all(this.reverseServers.map(closeServer));
    this.reverseServers = [];
    for (const rule of this.rules.reverseProxies || []) {
      if (rule.enabled === false || !rule.listenPort || !rule.targetUrl) continue;
      const server = http.createServer((req, res) => {
        let target: URL;
        try {
          target = new URL(req.url || '/', rule.targetUrl);
          const fixed = new URL(rule.targetUrl);
          target.protocol = fixed.protocol;
          target.host = fixed.host;
        } catch (error: any) {
          this.writePlain(res, 400, error.message);
          return;
        }
        const request = contextFromUrl(target.toString(), req.method || 'GET', pairsToObject(req.rawHeaders || []));
        readBody(req, MAX_EDIT).then((read) => this.execute({
          request,
          body: read.body,
          rawHeaders: req.rawHeaders || [],
          response: res,
          started: Date.now(),
          source: 'reverse',
        })).catch((error) => this.failResponse(res, error));
      });
      server.on('error', (error) => {
        this.lastError = `反向代理 ${rule.listenPort}: ${error.message}`;
        this.emit('status', this.status());
      });
      try {
        await listen(server, rule.listenPort);
        this.reverseServers.push(server);
      } catch (error: any) {
        this.lastError = `反向代理 ${rule.listenPort}: ${error.message}`;
      }
    }
  }

  onUpgrade(req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer, secure: boolean): void {
    let request: any;
    try {
      if (secure || !/^https?:\/\//i.test(req.url || '')) {
        const hostHeader = req.headers.host || '';
        request = contextFromUrl(`${secure ? 'https:' : 'http:'}//${hostHeader}${req.url}`, req.method || 'GET', {});
        const stamped = (req.socket as any)?.flowTarget || ((req.socket as any)?._parent && (req.socket as any)._parent.flowTarget);
        if (secure && stamped) {
          request = contextFromUrl(`https://${stamped.host}:${stamped.port}${req.url || '/'}`, req.method || 'GET', {});
        }
      } else {
        request = contextFromUrl(req.url || '/', req.method || 'GET', {});
      }
    } catch (error) {
      clientSocket.destroy();
      return;
    }
    const block = this.rules.block.enabled
      ? enabledRules(this.rules.block).find((rule) => requestMatches(rule, request))
      : null;
    if (block) {
      clientSocket.destroy();
      return;
    }
    const upstream = request.protocol === 'https'
      ? tls.connect({ host: request.host, port: request.port, servername: request.host, ...this.upstreamTls() })
      : net.connect(request.port, request.host);
    const fail = (error: Error) => {
      const flow = this.makeFlow(request, { started: Date.now(), source: 'proxy', status: 502, error: error.message });
      flow.websocket = true;
      this.addFlow(flow);
      clientSocket.destroy();
      upstream.destroy();
    };
    upstream.on('error', fail);
    clientSocket.on('error', () => upstream.destroy());
    const ready = () => {
      const lines = [`${req.method} ${request.path}${request.query ? `?${request.query}` : ''} HTTP/1.1`];
      const raw = req.rawHeaders || [];
      for (let index = 0; index < raw.length; index += 2) {
        const key = String(raw[index]).toLowerCase();
        if (key === 'upgrade' || key === 'connection' || !HOP.has(key)) {
          lines.push(`${raw[index]}: ${raw[index + 1]}`);
        }
      }
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (head && head.length) upstream.write(head);
      let buffer = Buffer.alloc(0);
      const onData = (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        const split = buffer.indexOf('\r\n\r\n');
        if (split === -1) return;
        upstream.off('data', onData);
        const headerText = buffer.slice(0, split).toString('latin1');
        const status = Number((headerText.match(/^HTTP\/1\.[01] (\d+)/) || [])[1] || 101);
        clientSocket.write(buffer);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
        const flow = this.makeFlow(request, {
          started: Date.now(),
          source: 'proxy',
          status,
          requestHeaders: pairsFromRaw(raw),
          responseHeaders: headerText.split('\r\n').slice(1).map((line) => {
            const index = line.indexOf(':');
            return [line.slice(0, index), line.slice(index + 1).trim()];
          }),
        });
        flow.websocket = true;
        this.addFlow(flow);
      };
      upstream.on('data', onData);
    };
    upstream.once(request.protocol === 'https' ? 'secureConnect' : 'connect', ready);
  }
}

class PassThroughResponse {
  headersSent = false;
  writableEnded = false;
  statusCode = 0;
  socket = { destroy() {} };
  writeHead(status: number) {
    this.headersSent = true;
    this.statusCode = status;
  }
  end() {
    this.writableEnded = true;
    this.headersSent = true;
  }
  write() {}
}

function contentTypeFor(file: string): string {
  const extension = path.extname(file).toLowerCase();
  const types: Record<string, string> = {
    '.json': 'application/json; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  return types[extension] || 'application/octet-stream';
}

function readHttpResponse(socket: net.Socket): Promise<{ status: number; rawHeaders: string[]; body: Buffer }> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const onError = (error: Error) => reject(error);
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const split = buffer.indexOf('\r\n\r\n');
      if (split === -1) return;
      const headerText = buffer.slice(0, split).toString('latin1');
      const lines = headerText.split('\r\n');
      const status = Number((lines[0].match(/^HTTP\/1\.[01] (\d+)/) || [])[1] || 0);
      const rawHeaders: string[] = [];
      for (const line of lines.slice(1)) {
        const index = line.indexOf(':');
        if (index > 0) rawHeaders.push(line.slice(0, index), line.slice(index + 1).trim());
      }
      const rest = buffer.slice(split + 4);
      const length = Number(headerValue(pairsToObject(rawHeaders), 'content-length') || rest.length);
      const finish = (body: Buffer) => {
        socket.off('data', onData);
        socket.off('error', onError);
        resolve({ status, rawHeaders, body });
      };
      if (rest.length >= length) finish(rest.subarray(0, length));
      else {
        const chunks = [rest];
        let got = rest.length;
        socket.off('data', onData);
        const more = (chunk: Buffer) => {
          chunks.push(chunk);
          got += chunk.length;
          if (got >= length) {
            socket.off('data', more);
            finish(Buffer.concat(chunks).subarray(0, length));
          }
        };
        socket.on('data', more);
      }
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
}
