import { handleMcp, type Env } from './cosense-mcp.js';

/** Deploy behind Sites' authenticated, owner-private gateway only. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/mcp') return handleMcp(request, env);
    if (pathname === '/' && request.method === 'GET') {
      return new Response('<!doctype html><html lang="ja"><meta charset="utf-8"><title>Cosense MCP</title><h1>Cosense MCP</h1><p>ChatGPTの専用プラグインから利用する、自分専用のCosense接続です。</p></html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return new Response('Not found', { status: 404 });
  },
};
