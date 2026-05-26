# MCP spike against `mcp.orth.sh`

**Date:** 2026-05-25
**Phase:** 1, step 4 of `SPEC.md` §13
**Time budget:** 30 min hard cap (user directive)
**Time used:** ~15 min
**Outcome:** REST stays locked per `SPEC.md` §2 decision 1. MCP transport via AI SDK 6 is not viable against this server today.

## What the spec asked

> Spike `mcp.orth.sh` with `experimental_createMCPClient`. Document the result.

User's bail conditions (immediate fallback to REST if either hits):
1. SSE streaming through Vercel function does not work cleanly (chunks out of order, or buffering kills the stream).
2. Auth flow requires anything more than a bearer token in the MCP client config.

## What I did

### 1. Probed `mcp.orth.sh` root with bearer auth

```
GET https://mcp.orth.sh/  (Authorization: Bearer orth_live_...)
200 OK, 163ms, application/json
```

Body:
```json
{
  "service": "MCP Proxy powered by Orthogonal",
  "version": "1.0.0",
  "description": "Universal MCP gateway supporting both API key and OAuth authentication",
  "endpoints": {
    "POST /": "JSON-RPC (API key or OAuth)",
    "GET /sse": "SSE transport",
    "POST /message": "SSE messages",
    "GET /.well-known/oauth-protected-resource": "OAuth resource metadata",
    "GET /.well-known/oauth-authorization-server": "OAuth server metadata",
    "POST /oauth/register": "Dynamic client registration"
  }
}
```

Bearer auth accepted at the gateway. **Bail condition 2 (auth) does NOT trigger.** OAuth is supported but optional.

### 2. Confirmed SSE handshake works at the wire level

```
GET https://mcp.orth.sh/sse  (Authorization: Bearer ..., Accept: text/event-stream)
200 OK, content-type: text/event-stream
event: endpoint
data: /message?sessionId=1779753150706
```

Server emits the canonical MCP SSE "endpoint" event with a session-bound message URL. This is the older MCP SSE transport pattern (per the 2024-11-05 spec); newer servers use streamable HTTP (POST /mcp) which returns 404 here.

### 3. Installed `@ai-sdk/mcp@1.0.43` and wrote `scripts/mcp-spike.ts`

AI SDK 6 moved MCP into its own package and dropped the `experimental_` prefix. Function is now `createMCPClient` from `@ai-sdk/mcp`.

The spike script:
- Creates the client with `transport: { type: "sse", url: "https://mcp.orth.sh/sse", headers: { Authorization: "Bearer ..." } }`
- Calls `client.tools()` to enumerate tools
- Executes the Tomba email-verifier tool once
- Closes the client

All steps wrapped in `Promise.race` with a 15-second timeout.

### 4. Ran the spike

```
[...]  createMCPClient              starting
[FAIL] createMCPClient              15011ms  Error: timeout after 15000ms

FAIL: createMCPClient failed; cannot proceed.
```

`createMCPClient` never resolves. The SSE connection opens (curl confirms), but the AI SDK client never completes the JSON-RPC `initialize` handshake within 15 seconds. **Bail condition 1 (SSE does not stream cleanly) triggers.**

### 5. Confirmed MCP works server-side via the alternative transport

To isolate whether MCP itself is broken or only the AI SDK SSE client integration:

```
POST https://mcp.orth.sh/  (Authorization: Bearer ..., Content-Type: application/json)
Body: {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"orthogonal-chat-spike","version":"0.0.1"}}}

200 OK, 228ms
Response: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"Orthogonal MCP","version":"1.0.0"}}}
```

Server responds in 228ms with `protocolVersion: 2024-11-05` (older). Client sent `2025-03-26` (newer). The server downgrades to its supported version in the response.

So MCP **is reachable**. The SSE transport in AI SDK 6 either:
- Sends a protocol version the server cannot complete the SSE handshake for
- Implements only the streamable HTTP transport variant (which this server returns 404 for)
- Has a buffering/timeout issue between the SSE channel and the session-bound POST channel

I did not dig deeper. Beyond the 30-min cap and the locked REST decision, the answer is "do not use MCP via AI SDK against this server today."

## Decision

**REST stays locked.** This validates `SPEC.md` §2 decision 1.

Reasons:
1. AI SDK 6 `createMCPClient` SSE transport does not establish a session with `mcp.orth.sh` (bail condition 1).
2. Even if it worked, MCP would add a network layer the build does not need. Direct `/v1/run` over REST gives us per-endpoint typed tools, build-time discovery, and the cross-conversation cache key shape we want.
3. The spec already accounts for this in §2 decision 1: "Spike briefly first; if it does not stream cleanly through Vercel functions, drop it."

## What would unblock MCP migration later

For the post-submission "deferred work" list (`SPEC.md` §14):

- AI SDK adds back-compat for the 2024-11-05 SSE transport pattern (or this server upgrades to streamable HTTP).
- Or: write a custom `MCPTransport` that implements the older SSE handshake against `mcp.orth.sh`'s `/sse` + `/message?sessionId=` pair.
- Either path is post-MVP scope.

## Files

- `scripts/mcp-spike.ts`: the spike script (kept for reproduction; not run at build time).
- `package.json`: `pnpm mcp-spike` script entry.
- `@ai-sdk/mcp` dependency: kept installed for potential future use; ~80KB, no runtime impact when not imported.
