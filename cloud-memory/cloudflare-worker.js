const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

function response(body, status = 200) {
    return new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function authorize(request, env) {
    if (!env.SYNC_TOKEN) return true;
    return request.headers.get('Authorization') === 'Bearer ' + env.SYNC_TOKEN;
}

function parseRecord(row) {
    if (!row) return null;
    try { return JSON.parse(row.payload); } catch (_) { return null; }
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
        if (!authorize(request, env)) return response({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        if (request.method === 'GET' && url.pathname === '/health') return response({ ok: true, storage: 'D1' });

        if (request.method === 'GET' && url.pathname === '/list') {
            const scope = url.searchParams.get('scope') || '';
            if (!scope) return response({ error: 'scope is required' }, 400);
            const result = await env.MEMORY_DB.prepare('SELECT payload FROM memories WHERE scope = ? ORDER BY updated_at DESC LIMIT 5000').bind(scope).all();
            return response({ records: result.results.map(parseRecord).filter(Boolean) });
        }

        if (request.method === 'POST' && url.pathname === '/search') {
            const body = await request.json();
            const scope = body?.scope?.namespace || body?.scope || '';
            const query = String(body?.query || '').trim();
            if (!scope || !query) return response({ error: 'scope and query are required' }, 400);
            const limit = Math.max(1, Math.min(Number(body.limit) || 6, 20));
            const result = await env.MEMORY_DB.prepare('SELECT payload FROM memories WHERE scope = ? AND content LIKE ? ORDER BY updated_at DESC LIMIT ?').bind(scope, '%' + query + '%', limit).all();
            return response({ records: result.results.map(parseRecord).filter(Boolean) });
        }

        const match = url.pathname.match(/^\/records\/([^/]+)$/);
        if (match && request.method === 'PUT') {
            const record = await request.json();
            const id = decodeURIComponent(match[1]);
            const scope = String(record.scope || '');
            if (!scope || !record.bindingId || id !== String(record.id)) return response({ error: 'valid id, scope and bindingId are required' }, 400);
            const now = new Date().toISOString();
            const stored = { ...record, id, updatedAt: record.updatedAt || now };
            await env.MEMORY_DB.prepare('INSERT INTO memories (scope, id, binding_id, content, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(scope, id) DO UPDATE SET binding_id = excluded.binding_id, content = excluded.content, payload = excluded.payload, updated_at = excluded.updated_at').bind(scope, id, record.bindingId, String(record.content || ''), JSON.stringify(stored), now).run();
            return response(stored);
        }

        if (match && request.method === 'DELETE') {
            const scope = url.searchParams.get('scope') || '';
            if (!scope) return response({ error: 'scope is required' }, 400);
            await env.MEMORY_DB.prepare('DELETE FROM memories WHERE scope = ? AND id = ?').bind(scope, decodeURIComponent(match[1])).run();
            return response(null, 204);
        }
        return response({ error: 'Not found' }, 404);
    }
};
