# AETHER-IT Operational Guidelines

## Purpose

These guidelines define how AETHER-IT should be operated when using remote diagnostics, security-tool workflows, AI guidance, and VPS deployment.

## Visibility for Copilot Support

To let Copilot inspect the live UI safely:

1. Sign in through the shared browser tab yourself.
2. Leave the authenticated page open and shared with Copilot.
3. Do not paste passwords, SSH keys, API tokens, recovery codes, or cPanel tokens into chat.
4. If a page is already authenticated in another browser tab, share that tab instead of sending credentials.
5. For terminal prompts requiring secrets, type the secret directly into the terminal yourself.

Copilot can inspect visible UI state, route status, screenshots, accessible page snapshots, logs, code, and non-secret command output.

## Remote Operations Rules

Remote Operations supports bounded diagnostics for Linux VPS, Windows Server, and cPanel targets. It must not be treated as a general web shell.

Allowed patterns:

- Target status checks.
- Ping and trace route to authorized destinations.
- Network summary and DNS lookups.
- Service status and recent logs for named services.
- cPanel account, domain, and email inventory through cPanel UAPI.
- AI explanation of returned output.

Required controls:

- Administrator role for execution.
- Server-side credentials only.
- Strict SSH known_hosts verification.
- Explicit identity files mounted read-only.
- Time limits and output caps.
- Clear refusal when a target is not configured.

## Security Tool Rules

The Security Tools page may show Wireshark/tshark, Nmap, Kali Linux, Splunk, Nessus, OpenVAS, and tcpdump readiness. Execution must remain disabled unless authorization is documented.

Before enabling security tools:

1. Confirm written authorization and scope.
2. Confirm target hosts, CIDR ranges, time window, and escalation owner.
3. Confirm that scanning will not violate customer, ISP, hosting, or legal restrictions.
4. Keep `AETHER_SECURITY_TOOLS_ENABLED=false` until approval is complete.
5. Enable only the smallest required tool and workflow.
6. Capture output as evidence and attach it to the project record or ticket.

Do not use the platform for exploitation, evasion, credential theft, persistence, destructive testing, or scanning systems outside approved scope.

## Dashboard Operating Pattern

The main dashboard supports adjustable frames:

- Hide or show the left navigation.
- Hide or show the AI assistant.
- Adjust navigation and AI panel widths.
- Keep the VPS Engine status visible above the tabs.

Use this layout for troubleshooting sessions where the topology canvas, packet simulation, AI explanation, and tool outputs need more room.

## Deployment Guidelines

For application-only releases:

```powershell
ssh root@162.35.104.112 "cd /opt/aether-it; git pull --ff-only origin main; docker compose build api frontend nginx; docker compose up -d --no-deps api frontend nginx; docker compose restart nginx"
```

For frontend-only releases:

```powershell
ssh root@162.35.104.112 "cd /opt/aether-it; git pull --ff-only origin main; docker compose build frontend nginx; docker compose up -d --no-deps frontend nginx; docker compose restart nginx"
```

Always preserve MongoDB unless a database migration or restore is explicitly approved. Do not restart or remove `mongo`, `mongo-backup`, `mongo_data`, or `mongo_backups` for UI/API-only releases.

## Release Checklist

Before pushing or deploying:

1. Review `git status --short` and `git diff --check`.
2. Run backend tests: `.\.venv\Scripts\python.exe -m pytest tests/test_api.py -q`.
3. Run frontend build: `npm --prefix frontend run build`.
4. Commit with a focused message.
5. Push to `origin/main`.
6. Deploy only required services with `--no-deps`.
7. Verify `/api/health`, `/`, `/operations`, and `/security-tools`.
8. Confirm the OpenAPI paths exist for new API endpoints.
9. Record the commit SHA and validation result in the changelog or release notes.

## Secret Handling

Never commit or paste:

- `AETHER_SECRET_KEY`
- `GEMINI_API_KEY`
- SSH private keys
- cPanel tokens
- Splunk/Nessus/OpenVAS credentials
- database passwords or backup encryption keys

Store secrets only in server environment files, secret stores, or deployment-specific protected paths.
