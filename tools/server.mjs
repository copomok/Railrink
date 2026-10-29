import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {appRoot, sourceRoot, runtimeSource, tokenSource, sharedFiles} from './source.mjs';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
// Validate the configured shared source before accepting requests. No writes to either checkout.
sharedFiles();
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405).end(); return;}
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    let body, type;
    if (pathname === '/shared/runtime.js') {body = runtimeSource(); type=mime['.js'];}
    else if (pathname === '/shared/tokens.css') {body=tokenSource(); type=mime['.css'];}
    else if (pathname === '/shared/source.json') {body=JSON.stringify({repository:'copomok/NIMBYRAILTABLE',files:sharedFiles(),mode:'game-simulation'}); type=mime['.json'];}
    else {
      const original = pathname.startsWith('/NIMBYRAILTABLE/');
      let relative = original ? pathname.slice('/NIMBYRAILTABLE/'.length) : pathname.slice(1);
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      const allowed = original ? /^(index\.html|sw\.js|manifest\.json|(?:assets|data|js|pages)\/[\w/.-]+)$/ : /^(index\.html|(?:css|js)\/[\w.-]+)$/;
      if (relative.split('/').some(s=>s.startsWith('.')) || !allowed.test(relative)) {res.writeHead(404).end('Not found');return;}
      const root = original ? sourceRoot : appRoot;
      const filename = await fs.realpath(path.join(root, relative));
      if (!filename.startsWith((await fs.realpath(root))+path.sep)) {res.writeHead(403).end();return;}
      body=await fs.readFile(filename); type=mime[path.extname(filename)] || 'application/octet-stream';
      // This deployment has a local RailLink entry. Standalone upstream deployments keep a relative link.
      if (original && relative==='index.html') body=body.toString().replace('href="../Railrink/" data-raillink-entry', 'href="/" data-raillink-entry');
    }
    res.writeHead(200, {'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);
  } catch (error) {
    res.writeHead(error.code==='ENOENT'?404:500, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('파일을 불러올 수 없습니다. 공통 데이터 연결과 서버 로그를 확인하세요.');
    console.error(error.message);
  }
});
server.listen(Number(process.env.PORT || 4173), process.env.HOST || '127.0.0.1', () => console.log('RailLink and NIMBY Rail listening on port '+(process.env.PORT || 4173)));
