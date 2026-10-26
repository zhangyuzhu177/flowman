export interface FlowSummary {
  id: string;
  no: number;
  startedAt: number;
  duration: number;
  method: string;
  url: string;
  protocol: string;
  host: string;
  path: string;
  query?: string;
  status: number;
  error?: string;
  appName: string;
  highlight?: string;
  source: string;
  websocket: boolean;
  contentType: string;
  responseSize: number;
  requestSize: number;
  flags: {
    blocked?: boolean;
    mappedLocal?: boolean;
    mappedRemote?: boolean;
    scripted?: boolean;
    tunnel?: boolean;
    sslFailed?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface BodyRepresentation {
  size: number;
  decodedSize: number;
  truncated: boolean;
  contentType: string;
  text: string;
  base64: string;
}

export interface FlowDetail extends FlowSummary {
  scriptErrors?: string[];
  request: BodyRepresentation & {
    headers: [string, string][];
  };
  response: BodyRepresentation & {
    headers: [string, string][];
  };
}

export interface SSLRule {
  id: string;
  enabled: boolean;
  pattern: string;
}

export interface GenericRule {
  id: string;
  enabled: boolean;
  name: string;
  method: string;
  host: string;
  path: string;
  query?: string;
  action?: 'block' | 'hide';
  status?: number;
  file?: string;
  contentType?: string;
  targetUrl?: string;
  preserveHost?: boolean;
  phase?: 'request' | 'response' | 'both';
  code?: string;
  listenPort?: number;
}

export interface ScriptItem {
  id: string;
  enabled: boolean;
  name: string;
  code: string;
}

export interface ReverseProxyRule {
  id: string;
  enabled: boolean;
  listenPort: number;
  targetUrl: string;
}

export interface FlowmanRules {
  port: number;
  noCaching: boolean;
  ssl: {
    enabled: boolean;
    ignoreUpstreamTls: boolean;
    include: SSLRule[];
    exclude: SSLRule[];
  };
  allow: { enabled: boolean; rules: GenericRule[] };
  block: { enabled: boolean; rules: GenericRule[] };
  mapLocal: { enabled: boolean; rules: GenericRule[] };
  mapRemote: { enabled: boolean; rules: GenericRule[] };
  breakpoints: { enabled: boolean; rules: GenericRule[] };
  scripts: { enabled: boolean; items: ScriptItem[] };
  reverseProxies: ReverseProxyRule[];
  externalProxy: {
    enabled: boolean;
    protocol: string;
    host: string;
    port: number;
  };
  throttle: {
    enabled: boolean;
    latencyMs: number;
    downloadKbps: number;
  };
  pins: string[];
}

export interface ProxyState {
  running: boolean;
  port: number;
  recording: boolean;
  flowCount: number;
  address: string;
  ssl: boolean;
  error: string;
  samplePort: number;
  systemProxy: boolean;
  systemProxyServices: string[];
  systemProxyError: string;
  caFingerprint: string;
  caPath: string;
  caDerPath: string;
}

export interface BreakpointEvent {
  id: string;
  phase: 'request' | 'response';
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
  };
}

export interface BreakpointDecision {
  action: 'continue' | 'abort';
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
  };
  response?: {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
  };
}

export interface ComposePayload {
  method: string;
  url: string;
  headers: string;
  body: string;
}

export interface FlowmanApi {
  getState: () => Promise<ProxyState>;
  setRecording: (value: boolean) => Promise<ProxyState>;
  clear: () => Promise<ProxyState>;
  getRules: () => Promise<FlowmanRules>;
  saveRules: (rules: FlowmanRules) => Promise<{ ok: boolean; error?: string; rules: FlowmanRules; state: ProxyState }>;
  listFlows: () => Promise<FlowSummary[]>;
  getFlow: (id: string) => Promise<FlowDetail | null>;
  search: (query: string) => Promise<FlowSummary[]>;
  exportHar: () => Promise<{ ok: boolean; filePath?: string }>;
  exportCa: () => Promise<{ ok: boolean; filePath?: string }>;
  installCa: () => Promise<{ ok: boolean; message: string }>;
  revealCa: () => Promise<boolean>;
  repeat: (id: string) => Promise<FlowSummary | null>;
  compose: (payload: ComposePayload) => Promise<FlowSummary | null>;
  resolveBreak: (payload: { id: string; decision: BreakpointDecision }) => Promise<boolean>;
  setSystemProxy: (enabled: boolean) => Promise<{ ok: boolean; message: string; services: string[]; enabled: boolean }>;
  openBrowser: (url?: string) => Promise<void>;
  selectFile: () => Promise<string>;
  highlight: (id: string, color: string) => Promise<FlowSummary | null>;
  onFlow: (callback: (flow: FlowSummary) => void) => () => void;
  onFlowUpdate: (callback: (flow: FlowSummary) => void) => () => void;
  onBreak: (callback: (data: BreakpointEvent) => void) => () => void;
  onStatus: (callback: (status: ProxyState) => void) => () => void;
  onCleared: (callback: () => void) => () => void;
  onMenu: (callback: (action: string) => void) => () => void;
}

declare global {
  interface Window {
    flowman: FlowmanApi;
  }
}
