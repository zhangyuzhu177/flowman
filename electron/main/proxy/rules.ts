import crypto from 'crypto';
import type { FlowmanRules, GenericRule, SSLRule } from '../../../src/types/flow';

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

export const DEFAULT_RULES: FlowmanRules = {
  port: 9001,
  noCaching: false,
  ssl: {
    enabled: true,
    ignoreUpstreamTls: false,
    include: [{ id: 'ssl-all', enabled: true, pattern: '*' }],
    exclude: [],
  },
  allow: { enabled: false, rules: [] },
  block: { enabled: false, rules: [] },
  mapLocal: { enabled: false, rules: [] },
  mapRemote: { enabled: false, rules: [] },
  breakpoints: { enabled: false, rules: [] },
  scripts: { enabled: false, items: [] },
  reverseProxies: [],
  externalProxy: { enabled: false, protocol: 'http', host: '', port: 8080 },
  throttle: { enabled: false, latencyMs: 0, downloadKbps: 0 },
  pins: [],
};

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeRule(rule: any, index: number): GenericRule {
  const source = rule && typeof rule === 'object' ? rule : {};
  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId(`rule${index}`),
    enabled: source.enabled !== false,
    name: String(source.name || '未命名规则'),
    method: String(source.method || 'ANY').toUpperCase(),
    host: String(source.host || '*'),
    path: String(source.path || '*'),
    query: String(source.query || ''),
    action: source.action === 'hide' ? 'hide' : 'block',
    status: asNumber(source.status, 403),
    file: String(source.file || ''),
    contentType: String(source.contentType || ''),
    targetUrl: String(source.targetUrl || ''),
    preserveHost: Boolean(source.preserveHost),
    phase: ['request', 'response', 'both'].includes(source.phase) ? source.phase : 'both',
    code: typeof source.code === 'string' ? source.code : '',
    listenPort: asNumber(source.listenPort, 0),
  };
}

export function normalizeSslRule(rule: any, index: number): SSLRule {
  const source = rule && typeof rule === 'object' ? rule : {};
  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId(`ssl${index}`),
    enabled: source.enabled !== false,
    pattern: String(source.pattern || source.host || '*'),
  };
}

export function normalizeRules(input: any): FlowmanRules {
  const source = input && typeof input === 'object' ? input : {};
  const list = (value: any) => (Array.isArray(value) ? value.map(normalizeRule) : []);
  const sslList = (value: any) => (Array.isArray(value) ? value.map(normalizeSslRule) : []);

  return {
    port: Math.min(65535, Math.max(1, asNumber(source.port, DEFAULT_RULES.port))),
    noCaching: asBool(source.noCaching, false),
    ssl: {
      enabled: asBool(source.ssl && source.ssl.enabled, true),
      ignoreUpstreamTls: asBool(source.ssl && source.ssl.ignoreUpstreamTls, false),
      include: sslList(source.ssl && source.ssl.include).length
        ? sslList(source.ssl && source.ssl.include)
        : DEFAULT_RULES.ssl.include.map((item) => ({ ...item })),
      exclude: sslList(source.ssl && source.ssl.exclude),
    },
    allow: {
      enabled: asBool(source.allow && source.allow.enabled, false),
      rules: list(source.allow && source.allow.rules),
    },
    block: {
      enabled: asBool(source.block && source.block.enabled, false),
      rules: list(source.block && source.block.rules),
    },
    mapLocal: {
      enabled: asBool(source.mapLocal && source.mapLocal.enabled, false),
      rules: list(source.mapLocal && source.mapLocal.rules),
    },
    mapRemote: {
      enabled: asBool(source.mapRemote && source.mapRemote.enabled, false),
      rules: list(source.mapRemote && source.mapRemote.rules),
    },
    breakpoints: {
      enabled: asBool(source.breakpoints && source.breakpoints.enabled, false),
      rules: list(source.breakpoints && source.breakpoints.rules),
    },
    scripts: {
      enabled: asBool(source.scripts && source.scripts.enabled, false),
      items: Array.isArray(source.scripts && source.scripts.items)
        ? source.scripts.items.map((item: any, idx: number) => ({
            id: item.id || createId(`script${idx}`),
            enabled: item.enabled !== false,
            name: String(item.name || '未命名脚本'),
            code: typeof item.code === 'string' ? item.code : '',
          }))
        : [],
    },
    reverseProxies: Array.isArray(source.reverseProxies)
      ? source.reverseProxies
          .map((rule: any, idx: number) => ({
            id: rule.id || createId(`rev${idx}`),
            enabled: rule.enabled !== false,
            listenPort: asNumber(rule.listenPort, 0),
            targetUrl: String(rule.targetUrl || ''),
          }))
          .filter((rule: any) => rule.listenPort > 0)
      : [],
    externalProxy: {
      enabled: asBool(source.externalProxy && source.externalProxy.enabled, false),
      protocol: 'http',
      host: String((source.externalProxy && source.externalProxy.host) || ''),
      port: asNumber(source.externalProxy && source.externalProxy.port, 8080),
    },
    throttle: {
      enabled: asBool(source.throttle && source.throttle.enabled, false),
      latencyMs: Math.max(0, asNumber(source.throttle && source.throttle.latencyMs, 0)),
      downloadKbps: Math.max(0, asNumber(source.throttle && source.throttle.downloadKbps, 0)),
    },
    pins: Array.isArray(source.pins) ? source.pins.map(String) : [],
  };
}

export function wildcardToRegExp(pattern: string): RegExp {
  const source = String(pattern || '*');
  if (source === '*') return /^.*$/i;
  const escaped = source
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

export function matchPattern(pattern: string, value: string): boolean {
  const parts = String(pattern || '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!parts.length) return true;
  return parts.some((part) => wildcardToRegExp(part).test(String(value || '')));
}

export function requestMatches(
  rule: { enabled?: boolean; method?: string; host?: string; path?: string; query?: string },
  request: { method: string; host: string; path: string; query?: string }
): boolean {
  if (!rule || rule.enabled === false) return false;
  if (rule.method && rule.method !== 'ANY' && rule.method !== request.method) return false;
  if (!matchPattern(rule.host || '*', request.host)) return false;
  if (!matchPattern(rule.path || '*', request.path)) return false;
  if (rule.query) {
    const query = request.query || '';
    if (!query.includes(rule.query) && !matchPattern(rule.query, query)) return false;
  }
  return true;
}

export function enabledRules<T extends { enabled?: boolean }>(group: { enabled?: boolean; rules?: T[]; items?: T[] }): T[] {
  if (!group || group.enabled === false) return [];
  return (group.rules || group.items || []).filter((rule) => rule.enabled !== false);
}
