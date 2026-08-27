# Software Bill of Materials — AGCX (CXM-Tool)

**Application:** AGCX — AI-native CX platform (Zeron)
**Repository:** antigravitysoham-eng/CXM-Tool · branch `feat/cx-platform` · commit `d8b10d1`
**Generated:** 2026-07-18
**Formats:** human-readable (this file) + machine-readable CycloneDX 1.6 JSON (see below)

This SBOM covers the three deployable components of the application. Only the
**direct** dependencies are listed below with their purpose; the complete
dependency graph (direct + transitive, with PURLs, hashes and licenses) is in
the CycloneDX files.

| Component | Manifest | Direct deps | Full graph (CycloneDX) |
|---|---|---|---|
| Frontend (React/Vite SPA) | `package.json` | 5 runtime + 9 dev | `sbom/frontend.cdx.json` (199 components) |
| Backend (Express/SQLite API) | `server/package.json` | 13 runtime + 2 dev | `sbom/server.cdx.json` (308 components) |
| MCP bridge (reference) | `mcp-server/package.json` | 0 — dependency-free | n/a (Node built-ins only) |

Runtime: **Node.js** (`>=18` for the MCP bridge; the app is developed on Node 24). SQLite is embedded via `sqlite3`.

---

## 1. Frontend — `cx-tool` v0.0.0

React 19 single-page app built with Vite; charts via Recharts, icons via Lucide.

**Runtime dependencies**

| Package | Version | License | Purpose |
|---|---|---|---|
| `lucide-react` | 0.575.0 | ISC | Icon set |
| `react` | 19.2.4 | MIT | UI library |
| `react-dom` | 19.2.4 | MIT | React DOM renderer |
| `react-router-dom` | 7.13.1 | MIT | Client-side routing |
| `recharts` | 3.7.0 | MIT | Charts (dashboards, funnels, KPIs) |

**Dev / build dependencies**

| Package | Version | License | Purpose |
|---|---|---|---|
| `@eslint/js` | 9.39.3 | — | ESLint recommended config |
| `@types/react` | 19.2.14 | — | React type defs (editor/lint) |
| `@types/react-dom` | 19.2.3 | — | React DOM type defs |
| `@vitejs/plugin-react` | 5.1.4 | — | Vite React plugin (Fast Refresh) |
| `eslint` | 9.39.3 | MIT | Linter |
| `eslint-plugin-react-hooks` | 7.0.1 | MIT | Rules-of-hooks lint |
| `eslint-plugin-react-refresh` | 0.4.26 | MIT | Fast-refresh lint |
| `globals` | 16.5.0 | MIT | Global identifiers for ESLint |
| `vite` | 7.3.1 | MIT | Build tool + dev server |

---

## 2. Backend — `cx-tool-server` v1.0.0

Express 4 API over an embedded SQLite database, with JWT auth, bcrypt password
hashing, Zod validation, and Excel/PDF export.

**Runtime dependencies**

| Package | Version | License | Purpose |
|---|---|---|---|
| `bcrypt` | 5.1.1 | MIT | Password hashing (native) |
| `compression` | 1.8.1 | MIT | gzip responses |
| `cors` | 2.8.6 | MIT | CORS allowlist middleware |
| `dotenv` | 17.4.2 | BSD-2-Clause | Env var loading |
| `exceljs` | 4.4.0 | MIT | Excel import/export |
| `express` | 4.22.2 | MIT | HTTP server framework |
| `express-rate-limit` | 8.6.0 | MIT | Rate limiting middleware |
| `helmet` | 8.3.0 | MIT | Security headers |
| `jsonwebtoken` | 9.0.3 | MIT | JWT signing/verification |
| `pdfkit` | 0.19.1 | MIT | PDF report generation |
| `sqlite` | 5.1.1 | MIT | Promise wrapper over sqlite3 |
| `sqlite3` | 6.0.1 | BSD-3-Clause | SQLite driver (native) |
| `zod` | 4.4.3 | MIT | Request/schema validation |

**Dev / build dependencies**

| Package | Version | License | Purpose |
|---|---|---|---|
| `nodemon` | 3.1.14 | MIT | Dev auto-restart |
| `vitest` | 4.1.10 | MIT | Test runner |

---

## 3. MCP bridge — `agcx-mcp-server` v1.0.0

A **dependency-free** reference Model Context Protocol server (`mcp-server/server.mjs`).
It uses only Node.js built-ins (`fs`, `readline`, global `fetch`), so it has no
third-party supply chain of its own. Engine: `node >=18`.

---

## Regenerating this SBOM

The machine-readable CycloneDX files are produced with the official generator:

```bash
# from the repo root (frontend)
npx @cyclonedx/cyclonedx-npm@latest --output-file sbom/frontend.cdx.json --output-format JSON
# from server/ (backend)
cd server && npx @cyclonedx/cyclonedx-npm@latest --output-file ../sbom/server.cdx.json --output-format JSON
```

The CycloneDX JSON is the source of truth for automated tooling (vulnerability
scanning, license compliance, provenance). This markdown is a convenience summary
of the direct dependencies and their role in the application.
