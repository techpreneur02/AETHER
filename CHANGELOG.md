# Changelog

All notable changes to AETHER-IT are documented here.

## 2026-08-22 - Controlled operations, security tools, and dashboard frames

### Added

- Remote Operations workspace for admin-gated Linux VPS, Windows Server, and cPanel diagnostics.
- Server-side operations runner with fixed command catalog, target availability checks, timeout handling, output caps, and unconfigured-target rejection.
- Security Tools workspace with catalog cards for Wireshark/tshark, Nmap, Kali Linux, Splunk, Nessus, OpenVAS, and tcpdump.
- Guarded security-tool API endpoints for catalog status, launch profiles, capture plans, version checks, and bounded Nmap host discovery.
- Docker API image support for lightweight `nmap` and `tcpdump` binaries.
- Environment toggles for remote-operation targets and disabled-by-default security tooling.
- Safe configuration profiles for Windows Server baseline, firewall policy baseline, and network validation plans.
- Dashboard frame controls to show/hide the left navigation and AI assistant, adjust their widths, and move VPS Engine status above the workspace tabs.
- Client assessment and requirements-design workflow with scored evaluation, deterministic recommendations, and optional AI narrative.
- Universal infrastructure import for CSV, JSON, XML, TXT, and LOG files with duplicate suppression and clear binary rejection.

### Changed

- README now describes controlled operations and security-tool readiness instead of treating all live operations as out of scope.
- In-app Knowledge Base now includes Remote Operations, Security Tools, dashboard frame controls, and secure enablement guidance.
- Docker Compose now passes remote-operation and security-tool environment settings into the API service.
- Audit and import pages now reflect universal file ingestion rather than CSV/Nmap-only import language.

### Safety Notes

- Remote Operations is not an unrestricted browser shell. Only named diagnostics can run.
- Security tools are disabled by default with `AETHER_SECURITY_TOOLS_ENABLED=false`.
- SSH uses explicit server-side key paths and strict known_hosts verification.
- cPanel tokens, SSH keys, Splunk/Nessus/OpenVAS endpoints, and similar secrets must stay on the server and outside browser code.
- Scanning customer or production networks requires written authorization, scope, maintenance window, and rollback/escalation ownership.

### Validation

- Backend API suite: `39 passed`.
- Frontend production build: `25/25` static routes generated.
- VPS health: API health returns `ok`, root `/`, `/operations`, and `/security-tools` return HTTP 200.
- MongoDB and backup containers were preserved during app-only deployments.
