import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { correlationId, safeApiError } from './shared/skeleton/observability.mjs';

const port = Number(process.env.PORT ?? 3000);
const root = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
const server = http.createServer(async (req,res) => {
  const cid = correlationId(req.headers['x-correlation-id']);
  res.setHeader('x-correlation-id',cid);
  res.setHeader('x-content-type-options','nosniff');
  res.setHeader('referrer-policy','strict-origin-when-cross-origin');
  res.setHeader('permissions-policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('cache-control','no-store');
  if (req.method === 'GET' && req.url === '/health/live') {
    res.writeHead(200,{'content-type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({status:'ok',service:'kirani-api',correlationId:cid}));
  }
  if (req.method === 'GET' && req.url === '/health/ready') {
    const ready = Boolean(process.env.DATABASE_URL);
    res.writeHead(ready?200:503,{'content-type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({status:ready?'ready':'not_ready',correlationId:cid}));
  }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html' || req.url === '/manifest.webmanifest')) {
    const file = req.url === '/manifest.webmanifest' ? 'manifest.webmanifest' : 'index.html';
    try {
      const body = await readFile(resolve(root,file));
      res.writeHead(200,{'content-type':types[extname(file)],'content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
      return res.end(body);
    } catch {
      const e = safeApiError(500,cid,'WEB_ASSET_UNAVAILABLE');
      res.writeHead(e.status,{'content-type':'application/json; charset=utf-8'});
      return res.end(JSON.stringify(e.body));
    }
  }
  const e = safeApiError(404,cid,'NOT_FOUND');
  res.writeHead(e.status,{'content-type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(e.body));
});
server.listen(port,'0.0.0.0',()=>process.stdout.write(JSON.stringify({event:'server_started',port})+'\n'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
