# AGCX MCP server (reference)

A tiny bridge that lets any **Model Context Protocol** client — Claude Desktop and
others — drive AGCX as one of your agents. It exposes the agent's manifest as MCP
tools and forwards each call to the API with your agent key.

It's dependency-free (Node's built-in `fetch` + stdio) and holds **no authority of
its own**: the AGCX server enforces manifest-only access, read-only, the
single-session lease and the full ABAC ceiling. The bridge can't exceed what the
key was granted — if it tried, the server returns 403 and the tool call surfaces
as an error.

## Setup

1. In AGCX → **Agent Access**, mint a key for the agent you want (NEO, Aukat, …).
   Copy the secret — it's shown once.
2. In the same dialog, open **Get the agentic file**, choose the **MCP** format,
   and **Download** it (e.g. `agcx-neo-mcp.json`).
3. Point the bridge at that file, with your key in the environment:

   ```bash
   AGCX_AGENT_KEY=agk_live_… node server.mjs ./agcx-neo-mcp.json
   ```

The base URL is read from the manifest; set `AGCX_BASE_URL` to override it.

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agcx-neo": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-server/server.mjs",
        "/absolute/path/to/agcx-neo-mcp.json"
      ],
      "env": { "AGCX_AGENT_KEY": "agk_live_…" }
    }
  }
}
```

Restart Claude Desktop; the agent's tools appear. Ask it *"how's the pipeline?"*
and it calls NEO through AGCX — scoped to exactly your permissions.

## What it does

- `initialize` → announces the tool capability.
- `tools/list` → the operations from the manifest (e.g. `listAccounts`, `askNeo`).
- `tools/call` → substitutes path params, forwards query/body, calls the API with
  the bearer key, returns the JSON response.

## What it deliberately does not do

- Store or log your key beyond the running process.
- Expose anything not in the manifest — and even if it did, the server refuses it.
- Attempt writes — agent keys are read-only until the approval-queue phase.

This is a reference. For production you'd add reconnect/backoff and package it as a
proper binary, but the security model lives on the server, not here.
