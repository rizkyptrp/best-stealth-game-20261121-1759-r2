// The Quiet Floor — local playtest server.
// Serves game/ on http://localhost:8080 so the game can be played and
// screenshotted in a desktop browser. Node 22, standard library only.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = join(dirname(fileURLToPath(import.meta.url)), 'game');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = join(gameDir, decodeURIComponent(path));
  if (!file.startsWith(gameDir) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  try {
    const data = readFileSync(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
    });
    res.end(data);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('read error');
  }
});

server.listen(8080, () => {
  console.log('The Quiet Floor — http://localhost:8080');
});
