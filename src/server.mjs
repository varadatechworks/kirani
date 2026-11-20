import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {correlationId,safeApiError} from './shared/skeleton/observability.mjs';
const port=Number(process.env.PORT??3000);
const server=http.createServer((req,res)=>{const cid=correlationId(req.headers['x-correlation-id']);res.setHeader('x-correlation-id',cid);res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('x-content-type-options','nosniff');res.setHeader('cache-control','no-store');if(req.method==='GET'&&req.url==='/health/live'){res.writeHead(200);return res.end(JSON.stringify({status:'ok',service:'kirani-api',correlationId:cid}))}if(req.method==='GET'&&req.url==='/health/ready'){const ready=process.env.DATABASE_URL?true:false;res.writeHead(ready?200:503);return res.end(JSON.stringify({status:ready?'ready':'not_ready',correlationId:cid}))}const e=safeApiError(404,cid,'NOT_FOUND');res.writeHead(e.status);res.end(JSON.stringify(e.body))});
server.listen(port,'0.0.0.0',()=>process.stdout.write(JSON.stringify({event:'server_started',port})+'\\n'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
