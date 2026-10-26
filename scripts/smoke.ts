import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import https from 'https';
import net from 'net';
import tls from 'tls';
import { CertStore } from '../electron/main/proxy/certs';
import { DebugProxy } from '../electron/main/proxy/engine';
import { normalizeRules } from '../electron/main/proxy/rules';
import { startSample } from '../electron/main/proxy/sample';

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function proxyRequest(port: number, method: string, url: string, body?: string): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: url,
        headers: { host: new URL(url).host, 'content-type': 'application/json' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function proxyHttps(proxyPort: number, host: string, port: number, requestPath: string, ca: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, '127.0.0.1', () => {
      socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
    });
    let buffer = Buffer.alloc(0);
    socket.on('error', reject);
    socket.on('data', function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      const split = buffer.indexOf('\r\n\r\n');
      if (split === -1) return;
      socket.off('data', onData);
      const header = buffer.slice(0, split).toString('latin1');
      if (!/^HTTP\/1\.[01] 200/i.test(header)) {
        reject(new Error(header.split('\r\n')[0]));
        return;
      }
      const rest = buffer.slice(split + 4);
      if (rest.length) socket.unshift(rest);
      const secure = tls.connect({ socket, servername: host, ca }, () => {
        secure.write(`GET ${requestPath} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
      });
      const chunks: Buffer[] = [];
      secure.on('data', (chunk) => chunks.push(chunk));
      secure.on('error', reject);
      secure.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  });
}

async function listen(server: http.Server | https.Server, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'flowman-smoke-'));
  const certs = new CertStore(path.join(directory, 'certs'));
  certs.load();
  const rules = normalizeRules({ port: 19001 });
  const proxy = new DebugProxy({ certStore: certs, rules });
  const sample = await startSample(19108);
  const issued = certs.issue('127.0.0.1');
  const secureServer = https.createServer({ key: issued.key, cert: issued.cert }, (req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ secure: true, path: req.url }));
  });
  await listen(secureServer, 19443);
  await proxy.start(19001);

  const hello = await proxyRequest(19001, 'GET', `http://127.0.0.1:${sample.port}/hello`);
  assert(hello.status === 200 && hello.body.includes('hello from sample'), `http proxy failed: ${hello.status} ${hello.body}`);
  assert(proxy.flows.some((flow) => flow.path === '/hello'), 'hello was not recorded');

  const mappedFile = path.join(directory, 'mapped.json');
  fs.writeFileSync(mappedFile, '{"mapped":true}');
  await proxy.updateRules(
    normalizeRules({
      port: 19001,
      mapLocal: { enabled: true, rules: [{ enabled: true, method: 'GET', host: '127.0.0.1', path: '/mapped', file: mappedFile }] },
    })
  );
  const mapped = await proxyRequest(19001, 'GET', `http://127.0.0.1:${sample.port}/mapped`);
  assert(mapped.status === 200 && mapped.body.includes('"mapped":true'), `map local failed: ${mapped.status} ${mapped.body}`);

  await proxy.updateRules(
    normalizeRules({
      port: 19001,
      block: { enabled: true, rules: [{ enabled: true, method: 'GET', host: '*', path: '/secret', action: 'block', status: 403 }] },
    })
  );
  const blocked = await proxyRequest(19001, 'GET', `http://127.0.0.1:${sample.port}/secret`);
  assert(blocked.status === 403, `block failed: ${blocked.status}`);

  const before = proxy.flows.length;
  await proxy.updateRules(
    normalizeRules({
      port: 19001,
      allow: { enabled: true, rules: [{ enabled: true, method: 'GET', host: '*', path: '/hello' }] },
    })
  );
  const ignored = await proxyRequest(19001, 'POST', `http://127.0.0.1:${sample.port}/echo`, '{"n":1}');
  assert(ignored.status === 200 && ignored.body.includes('POST'), `allow list failed closed: ${ignored.status} ${ignored.body}`);
  assert(proxy.flows.length === before, 'allow list recorded a non-matching request');

  await proxy.updateRules(
    normalizeRules({
      port: 19001,
      scripts: {
        enabled: true,
        items: [
          {
            enabled: true,
            name: 'mark',
            code: "function onResponse(request, response) { response.body = JSON.stringify({ scripted: true }); response.headers['content-type'] = 'application/json'; return response; }",
          },
        ],
      },
    })
  );
  const scripted = await proxyRequest(19001, 'GET', `http://127.0.0.1:${sample.port}/hello`);
  assert(scripted.body.includes('"scripted":true'), `script failed: ${scripted.body}`);

  let sawBreak = false;
  proxy.once('breakpoint', (event) => {
    sawBreak = event.phase === 'request';
    proxy.resolveBreakpoint(event.id, {
      action: 'continue',
      request: {
        ...event.request,
        headers: { ...event.request.headers, 'x-flowman-test': 'yes' },
      },
    });
  });
  await proxy.updateRules(
    normalizeRules({
      port: 19001,
      breakpoints: { enabled: true, rules: [{ enabled: true, method: 'GET', host: '*', path: '/hello', phase: 'request' }] },
    })
  );
  const paused = await proxyRequest(19001, 'GET', `http://127.0.0.1:${sample.port}/hello`);
  assert(sawBreak, 'breakpoint did not fire');
  assert(paused.status === 200, `breakpoint continue failed: ${paused.status}`);

  await proxy.updateRules(normalizeRules({ port: 19001 }));
  const httpsBody = await proxyHttps(19001, '127.0.0.1', 19443, '/secure', certs.caCertPem);
  assert(httpsBody.includes('"secure":true'), `https mitm failed: ${httpsBody.slice(0, 300)}`);
  assert(proxy.flows.some((flow) => flow.protocol === 'https' && flow.path === '/secure'), 'https flow missing');

  const har = proxy.toHar();
  assert(har.log.entries.length === proxy.flows.length, 'har size mismatch');
  console.log(`smoke ok flows=${proxy.flows.length} sample=${sample.port}`);
  await proxy.stop();
  sample.server.close();
  secureServer.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
