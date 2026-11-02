// 開発用の小さな静的サーバー。public/ のファイルはルートのパスで返す。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

export function serve(port = Number(process.env.PORT || 5173)) {
  const server = http.createServer(async (req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p.endsWith('/')) p += 'index.html';
    for (const base of [root, join(root, 'public')]) {
      try {
        const body = await readFile(join(base, p));
        res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
        return res.end(body);
      } catch { /* 次の場所を探す */ }
    }
    res.writeHead(404); res.end('not found');
  });
  return new Promise(r => server.listen(port, () => r(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await serve();
  console.log(`http://localhost:${s.address().port}/`);
}
