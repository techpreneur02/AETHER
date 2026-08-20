# PROJECT AETHER-IT

- Build the VPS-hosted SaaS MVP described in the project brief. Offline mode is out of scope for v1.
- Use React/TypeScript, Tailwind CSS, React Flow, Konva, Axios, and React Query on the frontend.
- Use FastAPI, Pydantic v2, NetworkX, MongoDB, JWT/bcrypt auth, Jinja2, and the Google GenAI SDK on the backend.
- Keep strict schemas under `backend/models/` and keep NetworkX state aligned through `backend/core/graph.py`.
- Enforce `org_id` filtering on every tenant-scoped backend query.
- Gemini is server-side only; it fills approved template variables and never emits raw device commands.
- v1 discovery is manual/import-based. Do not implement live LAN scanning, auto-push, SNMP, ONVIF, SIA, OSDP, compliance auditing, or autonomous code execution.
- Prefer a high-density, keyboard-first dark dashboard with no modal traps and no offline-mode messaging.
- Validate core changes with `.venv\\Scripts\\python.exe -m pytest tests/test_core.py -v`.
- Keep Windows workstation and Docker Compose deployment compatibility in mind.
