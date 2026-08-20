# AETHER-IT Project Charter

## Mission

Create a multi-tenant, VPS-hosted infrastructure digital-twin and audit platform that helps teams understand the state of their systems, map physical and logical relationships, and operate with stronger evidence and workflow discipline.

## Goals

- model infrastructure as a maintainable digital twin,
- capture device, link, IP, task, and asset records in a single project record,
- provide an audit workflow for infrastructure completeness,
- support AI-assisted project questions grounded in real data,
- export project records for review, reporting, and handoff,
- deploy and operate the product in a realistic VPS environment.

## Primary users

- IT operations engineers
- infrastructure teams
- MSPs and consultants
- physical security and facilities operators
- technical project managers

## Core use cases

1. Create a project or company record.
2. Add devices, services, and connectivity.
3. Document topology and asset details.
4. Manage IP allocations and security rules.
5. Run audit checks against the project.
6. Ask questions grounded in project topology and inventory.
7. Export the project and share the result.

## In-scope capabilities

- auth and RBAC
- multi-tenant project isolation
- device and topology management
- imports and manual discovery capture
- IP and security state management
- operational tasks
- project audit readiness scoring
- AI assistance grounded in saved project context
- deployment with Docker and Nginx

## Out-of-scope for current phase

- autonomous live scanning
- autonomous code or configuration deployment
- production SSO and enterprise identity federation
- full compliance certification
- comprehensive asset domain modeling for every facility type
- HTTPS without a domain and cert infrastructure

## Success criteria

- users can create and manage real project records,
- the topology reflects real infrastructure relationships,
- users can record ports, media types, and link metadata,
- audit and readiness checks provide useful operational guidance,
- AI responses are grounded and traceable to project context,
- exports are usable in reviews and handoff processes.

## Risk and constraints

- the product is not a substitute for direct infrastructure validation,
- some dashboard values are informational only until telemetry sources are connected,
- production exposure requires domain-based HTTPS and hardening,
- secrets and credentials must be tracked and rotated carefully.
