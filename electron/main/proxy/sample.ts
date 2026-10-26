import http from 'http';

const PAGE = `<!doctype html>
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
  </script>
</body>
</html>`;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" rx="12" fill="#0a64d8"/><text x="20" y="48" fill="white" font-size="24" font-family="sans-serif">Flowman</text></svg>`;

export function startSample(preferredPort: number): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    if (url.pathname === '/hello') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, message: 'hello from sample', query: url.search }));
      return;
    }
    if (url.pathname === '/echo') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ method: req.method, body }));
      });
      return;
    }
    if (url.pathname === '/secret') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('secret-ok');
      return;
    }
    if (url.pathname === '/picture.svg') {
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      res.end(SVG);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });

  return new Promise((resolve, reject) => {
    const tryListen = (port: number, attemptsLeft: number) => {
      const onError = (error: any) => {
        server.off('error', onError);
        if (error.code === 'EADDRINUSE' && attemptsLeft > 0) tryListen(port + 1, attemptsLeft - 1);
        else reject(error);
      };
      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', onError);
        resolve({ server, port });
      });
    };
    tryListen(preferredPort, 20);
  });
}
