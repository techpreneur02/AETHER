# AETHER-IT Product Architecture Assessment

**Assessment date:** 2026-08-20  
**Product:** AETHER-IT Infrastructure Digital Twin and Audit Platform  
**Deployment:** Ubuntu VPS at `162.35.104.112`  
**Current access model:** IP-based HTTP; HTTPS is pending a domain name

## 1. Executive Assessment

AETHER-IT has reached a functional MVP state for infrastructure audit intake and project-based topology management. The deployed product can authenticate users, isolate organizations, create company/project records, capture devices and connections, import discovery data, generate configuration previews, query Gemini using persisted project context, and produce JSON/PDF exports.

The central product workflow is now present:

1. Create or select a company audit record.
2. Record infrastructure assets.
3. Record connections and media types.
4. Import technician-generated discovery data.
5. Review the topology simulation.
6. Audit gaps across topology, IPAM, security, tasks, and project metadata.
7. Ask project AI questions grounded in the saved topology.
8. Export the project as JSON or PDF.

The main architectural limitation is that some operational domains are currently topology-derived read-only views rather than dedicated resources. Cameras, racks, power, wireless, cabling, and services can be inspected when represented in topology, but they do not yet have complete domain-specific CRUD models.

**Overall maturity:** Functional MVP / early production pilot  
**Core workflow readiness:** High  
**Domain model completeness:** Medium  
**Operational telemetry maturity:** Low  
**Production hardening:** Medium, with IP-only HTTP intentionally selected

## 2. Product Charter Interpretation

The working product brief established AETHER-IT as a multi-tenant SaaS tool for small and mid-sized infrastructure teams. The product is intended to help technicians and infrastructure operators turn existing network information into a maintained digital twin, audit record, safe configuration workspace, and AI-assisted operational view.

The repository does not contain a formal charter file. The authoritative requirements were provided through the product brief and subsequent implementation decisions in the working session. This document is therefore an implementation assessment against that brief, not a compliance certificate against a versioned charter document.

## 3. Implemented Architecture

### Backend

- Python 3.11
- FastAPI
- Pydantic v2 validation
- MongoDB 7 for VPS persistence
- In-memory store for local development/tests
- NetworkX support in the backend core
- JWT authentication using HS256
- Role model: `admin`, `tech`, `viewer`
- Organization-scoped project and resource access
- Editor guard for write operations
- Admin guard for membership role changes
- Last-admin protection
- Jinja2 Safe Mode configuration templates
- WeasyPrint PDF export with native GTK/Pango/Cairo runtime libraries
- Gemini integration through the server-side Google GenAI SDK

### Frontend

- Next.js 15 App Router
- React and TypeScript
- Custom CSS design system
- Lucide icons
- React Flow via `@xyflow/react`
- Client-side authenticated API calls
- Project-scoped operational pages
- Dashboard topology editor and audit intake workflow

### Deployment

- Docker Compose
- API container
- Next.js frontend container
- Internal MongoDB container
- Internal API and Mongo ports
- Container Nginx on host port `8080`
- Host Nginx on port `80` reverse proxying to container Nginx
- Restart policies for services
- Mongo backup loop with archive retention
- Mongo backup healthcheck requiring a recent archive
- Local off-server backup copy verified by SHA-256
- Security headers on Nginx responses

## 4. Functional Capability Matrix

### Fully functional and API-backed

- Registration and login
- JWT session handling
- Organization isolation
- Viewer write restrictions
- Project/company record creation
- Project selection
- Device/site/service creation and deletion
- Topology save/load
- Connection creation through form
- Connection creation through React Flow handles
- Connection deletion through graph edge interaction
- Ethernet, fiber, and wireless link media
- Dragged topology position persistence
- CSV device import
- Nmap XML import
- IP allocation create/list/delete
- Security rule create/list/delete
- Task create/update/delete
- Task status changes
- Member listing and role changes
- Floorplan upload
- Floorplan marker movement
- Safe Mode config preview
- Gemini project queries
- JSON export
- PDF export
- Infrastructure Audit intake page
- Audit readiness checks
- Project report summaries
- Backup archive generation and health monitoring

### Functional read-only or heuristic-backed

These routes load real project data but do not yet represent dedicated domain resources:

- Cameras
- Racks
- Power
- Wireless
- Cabling
- Services
- Compliance summaries
- Reports summaries

These views infer categories from topology names and types. For example, a topology node containing `camera`, `UPS`, `rack`, or `wireless` may be classified into a corresponding view. This is useful for an MVP demonstration and initial audit, but it is not sufficient for authoritative asset management.

### Informational or simulated controls

- System health percentage on the dashboard
- CPU, memory, and PoE values in the detail panel
- Camera preview playback state
- Notification data and acknowledgment state
- Project terminal command panel
- Some vendor/status/site filter behavior
- Vulnerability tab content
- Port inventory content
- L4-L7 layer semantics

These controls are explicitly not connected to live infrastructure telemetry or a dedicated data model.

## 5. Infrastructure Audit Workflow

The `/audit` page is the primary product workflow for the stated infrastructure-audit goal.

It currently supports:

- Creating a company/site audit record through the project model
- Selecting a company project
- Adding devices, sites, and services
- Adding links with media type
- Importing CSV or Nmap XML discovery results
- Reading topology node and link counts
- Reading IP allocations
- Reading security rules
- Reading task state
- Checking project description quality
- Producing a readiness score
- Linking each failed check to the appropriate workspace

### Audit score inputs

The current audit score checks:

- At least one topology node exists
- Link endpoints refer to existing topology nodes
- At least one IP allocation exists
- At least one security rule exists
- No open tasks remain
- Project description exists

This is a useful MVP completeness score. It should not yet be marketed as a compliance certification or security assessment score.

## 6. AI Architecture Assessment

Gemini is server-side and project-grounded. The AI query endpoint receives the persisted topology and returns grounding counts for nodes and links.

This is the correct security direction because the Gemini API key is not exposed to the browser.

Important behavior:

- An empty project correctly produces an empty-context response.
- The dashboard now exposes a `Load demo` action that persists demo topology into an empty project.
- Imported or manually recorded nodes and links are the preferred source for AI context.
- AI output is not a replacement for a network engineer’s verification.

### AI limitations

- No dedicated asset-domain grounding yet for racks, power, cameras, and wireless configuration.
- No persistent AI conversation history.
- No formal prompt/version registry.
- No human feedback or correction workflow.
- No policy-controlled action execution; AI is advisory.

## 7. Security and Multi-Tenancy Assessment

### Positive controls

- JWT authentication is required for protected API routes.
- Organization IDs are checked on project/resource access.
- Viewer write attempts are blocked.
- Admin-only member role changes are enforced.
- The final admin cannot demote themselves if it would remove all administrators.
- API and Mongo ports are internal-only in Docker Compose.
- Gemini remains server-side.
- `.env` is excluded from deployment archives and protected on the VPS.
- Nginx adds `nosniff`, frame-deny, referrer, and permissions headers.

### Remaining security work

- HTTPS requires a domain and certificate.
- VPS password rotation is required because credentials were exposed during the working session.
- SSH key authentication should replace password login.
- Rate limiting is not implemented.
- Audit logs for sensitive actions are not implemented.
- Notification and terminal actions are not yet persisted as an auditable event stream.
- Dedicated external backup replication is not automated.

## 8. Persistence and Data Model Assessment

### Current persisted entities

- Users
- Projects
- Topology nodes
- Topology links
- IP allocations
- Security rules
- Tasks
- Membership roles
- Floorplan metadata/files

### Missing domain entities

- Company/customer profile separate from project
- Physical sites and buildings
- Rooms/floors/racks
- Rack units and equipment placement
- Camera records and feed metadata
- Wireless access point records
- Power circuits, UPS, PDU, and PoE budgets
- Cable records, port endpoints, patch panels, and cable identifiers
- Vendor/model/serial/firmware fields on devices
- Device operational status and telemetry samples
- Audit findings with severity, evidence, owner, and remediation status
- Immutable change/audit events

## 9. Known Technical Risks

1. **Local memory storage is ephemeral.** Restarting the local API removes local accounts and projects. The VPS uses MongoDB and is persistent.
2. **Domain-specific views use heuristics.** Asset classification based on names can be inaccurate.
3. **Telemetry is simulated.** Dashboard resource values should not be interpreted as live monitoring.
4. **The dashboard source recently required formatting.** `frontend/app/page.tsx` had very long JSX lines, which made safe incremental editing difficult. It has now been formatted with Prettier.
5. **The topology and audit workflows are more mature than the asset domains.** The product should prioritize domain models before adding more dashboard decoration.
6. **IP-only HTTP is not suitable for sensitive production use.** HTTPS and secure cookie/session improvements should be prioritized when a domain is available.

## 10. Product Architect Assessment

### What is structurally sound

- The core data path is coherent: project -> topology -> audit/AI/export.
- The backend has a clear store abstraction supporting memory and Mongo implementations.
- Write authorization is centralized through FastAPI dependencies.
- React Flow is used for the graph surface rather than a hand-built graph renderer.
- Import and export workflows are aligned with the audit use case.
- The audit page now provides a focused intake and review surface.

### What should be refactored next

- Split the dashboard into components for filters, layers, topology canvas, details, alerts, and operations popovers.
- Move asset-domain routes to shared typed components.
- Add a domain-level `Company` or `CustomerSite` model separate from `Project`.
- Add a generic `Asset` model only if the team accepts a category/type discriminator; otherwise use dedicated domain collections.
- Add persistent audit findings instead of calculating all checks transiently.
- Add explicit API response/error handling and session recovery to every routed page, not only the dashboard.
- Add browser-level tests for the actual audit workflow.

## 11. Recommended Roadmap

### Phase 1: Stabilize the audit MVP

- Run the full browser acceptance flow against production.
- Record a real company audit with devices, links, and imported discovery data.
- Confirm AI node/link grounding after data capture.
- Persist and display audit findings.
- Add delete/edit actions for audit records where appropriate.
- Rotate VPS credentials and install SSH keys.

### Phase 2: Complete physical asset management

- Add dedicated asset schemas and CRUD for cameras, racks, power, wireless, and cabling.
- Add vendor, model, serial, firmware, location, status, and ownership fields.
- Connect each domain to the topology by asset ID rather than name matching.
- Add domain-specific reports and audit checks.

### Phase 3: Operational telemetry

- Add controlled technician import of status/telemetry snapshots.
- Store health observations with timestamps and source.
- Replace hardcoded CPU/memory/PoE values with imported observations.
- Add notification generation from persisted audit findings and task state.

### Phase 4: Production hardening

- Configure a domain and HTTPS.
- Automate off-server backup replication.
- Add rate limiting and security event logs.
- Add browser E2E tests in CI.
- Add deployment rollback verification.

## 12. Acceptance Test Checklist

A product architect should verify this exact flow:

- [ ] Register an organization.
- [ ] Create a company audit record.
- [ ] Add a site node.
- [ ] Add a firewall, core switch, access switch, and server.
- [ ] Add at least three connections using different media.
- [ ] Drag nodes and reload to verify positions persist.
- [ ] Delete a graph link and reload to verify deletion persists.
- [ ] Import a CSV or Nmap file.
- [ ] Allocate IP addresses.
- [ ] Add at least one security rule.
- [ ] Add a remediation task.
- [ ] Open Infrastructure Audit and verify readiness findings.
- [ ] Ask Gemini a topology question and confirm grounding counts are nonzero.
- [ ] Generate Safe Mode configuration preview.
- [ ] Download JSON and PDF exports.
- [ ] Verify viewer cannot create or modify data.
- [ ] Verify backup container is healthy and a recent archive exists.

## 13. Bottom Line

AETHER-IT is a credible infrastructure-audit and digital-twin MVP with a working core workflow and live VPS deployment. The product is ready for a controlled pilot with technician-entered or imported infrastructure data.

It is not yet a complete infrastructure management platform because several physical domains remain read-only and heuristic-backed, telemetry is simulated, and HTTPS is not configured. The highest-value next investment is dedicated asset persistence and an evidence-based audit finding model, not more visual dashboard controls.
