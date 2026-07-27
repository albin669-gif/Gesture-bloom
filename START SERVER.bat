@echo off
title 🌸 Bloom - Local Server
echo.
echo  ================================
echo   🌸 Bloom - Starting Server...
echo  ================================
echo.
echo  Server starting on http://localhost:5500
echo  Opening browser automatically...
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Start server in background and open browser
start "" "http://localhost:5500"
node -e "const http=require('http'),fs=require('fs'),path=require('path');const dir='%~dp0';const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript'};http.createServer((req,res)=>{const fp=path.join(dir,req.url==='/'?'index.html':req.url.slice(1));try{const d=fs.readFileSync(fp);res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'text/plain','Cache-Control':'no-store'});res.end(d)}catch(e){res.writeHead(404);res.end('Not found')}}).listen(5500,()=>console.log('  ✅ Server running at http://localhost:5500\n  Close this window to stop.'))"

pause
