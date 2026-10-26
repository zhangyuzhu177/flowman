import vm from 'vm';

export const TEMPLATE = `function onRequest(request) {
  // request.method, request.url, request.headers, request.body
  return request;
}

function onResponse(request, response) {
  // response.status, response.headers, response.body
  return response;
}
`;

export function runHook(code: string, hook: 'onRequest' | 'onResponse', request: any, response?: any): { skipped: boolean; value: any } {
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console: { log() {}, warn() {}, error() {} },
  });
  const script = new vm.Script(
    `${code}\n;this.__hook = (typeof ${hook} === "function") ? ${hook} : null;`
  );
  script.runInContext(context, { timeout: 150 });
  if (typeof (context as any).__hook !== 'function') {
    return { skipped: true, value: hook === 'onRequest' ? request : response };
  }
  const value = (context as any).__hook(request, response);
  return {
    skipped: false,
    value: value == null ? (hook === 'onRequest' ? request : response) : value,
  };
}

export function applyScripts(
  items: Array<{ enabled?: boolean; code?: string; name?: string }>,
  hook: 'onRequest' | 'onResponse',
  request: any,
  response?: any
): { request: any; response: any; errors: string[] } {
  let currentRequest = request;
  let currentResponse = response;
  const errors: string[] = [];
  for (const item of items) {
    if (!item || item.enabled === false || !item.code) continue;
    try {
      const result = runHook(item.code, hook, currentRequest, currentResponse);
      if (hook === 'onRequest' && result.value && typeof result.value === 'object') {
        currentRequest = result.value;
      }
      if (hook === 'onResponse' && result.value && typeof result.value === 'object') {
        currentResponse = result.value;
      }
    } catch (error: any) {
      errors.push(`${item.name || '脚本'}: ${error.message}`);
    }
  }
  return { request: currentRequest, response: currentResponse, errors };
}
