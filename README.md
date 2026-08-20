# AETHER-IT

AETHER-IT is a multi-tenant infrastructure digital-twin and audit platform for IT teams, MSPs, facilities teams, and physical security operators. The product captures company projects, asset inventories, network topology, IP allocations, security rules, operational tasks, and AI-assisted audit context in a single operational workspace.

## Product goal

Build a real SaaS platform that helps infrastructure teams:

- map devices, connections, networks, and physical assets into a digital twin,
- audit project completeness and operational readiness,
- create and manage technology assets with lifecycle context,
- store topology and inventory data in a project-safe, organization-scoped model,
- use AI grounded in the project topology to answer operational questions,
- export project records as JSON/PDF for handoff, review, and reporting.

## Project charter

### Mission

Create a practical, production-minded infrastructure operations platform that turns scattered infrastructure information into a governed, auditable, searchable digital twin.

### Vision

Provide a single command layer for infrastructure discovery, topology modeling, audit evidence, configuration preparation, and AI-assisted operational analysis for modern IT environments.

### Scope

In scope for this v1/v1.1 phase:

- user authentication and role-based access,
- organization and project isolation,
- device, link, and topology workflows,
- IP allocation and security rules,
- distributed tasks and operational records,
- audit intake and readiness scoring,
- AI context grounding based on project data,
- import workflows for CSV/Nmap-like discovery data,
- JSON/PDF export,
- Docker-based deployment and Nginx-proxied VPS hosting.

Out of scope for current phase:

- full production identity and SSO,
- live network scanning and autonomous device actions,
- external monitoring telemetry feeds,
- full compliance certification,
- complete domain models for every asset class,
- custom production certificate management without a domain.

## What has been built

### Backend

- FastAPI API with JWT authentication and organization-scoped access control
- Pydantic v2 models for users, projects, devices, topology, IP allocations, security rules, tasks, assets, and audit records
- MongoDB-backed production persistence with SQLite fallback for local development and test stability
- Persistent store abstraction layer for memory, SQLite, and Mongo
- Topology and graph operations for node creation, edit, movement, link creation, and deletion
- AI answer endpoint grounded in saved project data
- JSON and PDF export support
- Docker Compose deployment configuration

### Frontend

- Next.js 15 App Router dashboard
- Project selector and authenticated user session handling
- Device catalog and topology editor
- Node drag, grid snapping, keyboard movement, and handle-based connection creation
- Device and link editing with medium and port assignment
- Project audit page with readiness checks
- Asset inventory views for cameras, racks, power, wireless, and cabling
- Security, IP management, tasks, members, reports, and operations panels

### Infrastructure and operations

- VPS deployment on an Ubuntu host with Docker Compose
- Nginx reverse proxy and security headers
- MongoDB backup loop and archive retention
- Health checks and deployment hardening
- Local and remote backup verification workflow

## Product architecture

### Stack

- Frontend: Next.js, React, TypeScript, custom CSS, React Flow
- Backend: FastAPI, Python 3.11, Pydantic v2, NetworkX
- Persistence: MongoDB 7, SQLite fallback
- Auth: JWT + bcrypt
- AI: Google GenAI / Gemini, server-side only
- Deployment: Docker Compose + Nginx

### Core workflow

1. Create or select an organization project.
2. Add devices and infrastructure records.
3. Build or import topology data.
4. Assign connections, media type, and port assignments.
5. Review topology, IP data, security rules, and task state.
6. Run audit readiness checks.
7. Ask grounded AI questions about the existing project context.
8. Export the project as JSON or PDF for operations handoff.

## Repository structure

- backend/: FastAPI backend, models, persistence, API routes
- frontend/: Next.js dashboard and UI pages
- docs/: architecture assessments, charter, and product guidance
- deployment/: deployment configuration and nginx proxy configuration
- tests/: backend validation suite
- .github/: GitHub repository configuration and automation files

## Quick start

### Local Python API and tests

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m pytest tests/ -q
```

### Local API

```powershell
.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

### Local frontend

```powershell
npm --prefix frontend install
npm --prefix frontend run dev
```

### Docker local stack

```powershell
docker compose up --build
```

### Production-like VPS deployment

```powershell
docker compose up -d --build api frontend
# then restart nginx if the upstream config changed
docker compose restart nginx
```

## Current status

AETHER-IT is functionally at an MVP-to-early-pilot stage. The system already supports:

- project and org-scoped records,
- topology and device modeling,
- connection editing with port awareness,
- import data handling,
- security/IP/task workflows,
- audit readiness checks,
- AI-grounded project assistance,
- JSON/PDF export,
- VPS deployment and backup operations.

The core product direction is sound and the workflow is usable. The remaining work is focused on operational maturity: tighter domain models, more production-grade security controls, and more formal lifecycle workflows.

## Roadmap

### Near-term

- complete domain-specific asset models for racks, wireless, cameras, power, and cabling,
- improve audit evidence and scoring logic,
- add stronger validation and safer link editing rules,
- add formal audit history and change tracking.

### Medium-term

- secure domain and HTTPS deployment,
- better backup replication and recovery checks,
- stronger role and audit event controls,
- dedicated reports and compliance summaries.

### Longer-term

- external monitoring integrations,
- richer operational dashboards,
- advanced AI-driven recommendations,
- enterprise multi-site deployment support.

## Important notes

- The project is designed for IP-based deployment and should use HTTPS with a domain before production exposure to sensitive environments.
- The VPS password should be rotated if it was exposed in shared channels.
- The current dashboard and topology are functional, but some operational domains are still simulation-oriented rather than fully authoritative asset systems.

## License

This project is distributed under the MIT License unless a different repository-level policy is specified later.

## Repository readiness

The repository includes GitHub-ready project docs, gitignore rules, and automation scaffolding for CI and pull requests. The remaining step is to add the GitHub remote URL and push the branch.