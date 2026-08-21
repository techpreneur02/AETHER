from fastapi.testclient import TestClient

from backend.main import app, store


client = TestClient(app)


def setup_function() -> None:
    store.reset()


def test_health_reports_non_secret_runtime_state() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["service"] == "aether-it-api"
    assert response.json()["storage"] in {"sqlite", "memory"}
    assert response.json()["gemini"] in {"configured", "unconfigured"}


def test_viewer_role_guard_rejects_writes() -> None:
    token = register("viewer@example.com")
    user = store.find_user_by_email("viewer@example.com")
    assert user is not None
    user.role = "viewer"
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Viewer Twin"})

    assert project.status_code == 403


def test_admin_can_list_members_and_cannot_remove_last_admin() -> None:
    token = register("member-admin@example.com")
    user = store.find_user_by_email("member-admin@example.com")
    assert user is not None
    headers = {"Authorization": f"Bearer {token}"}

    members = client.get("/organization/members", headers=headers)
    role_change = client.patch(f"/organization/members/{user.id}/role", headers=headers, json={"role": "viewer"})

    assert members.status_code == 200
    assert members.json()[0]["role"] == "admin"
    assert role_change.status_code == 409


def register(email: str) -> str:
    response = client.post(
        "/auth/register",
        json={"email": email, "password": "correct-horse", "organization_name": "Example Org"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def test_register_create_and_list_project() -> None:
    token = register("admin@example.com")
    response = client.post(
        "/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "HQ Twin", "description": "Primary site"},
    )

    assert response.status_code == 201
    project_id = response.json()["id"]
    projects = client.get("/projects", headers={"Authorization": f"Bearer {token}"})
    assert projects.status_code == 200
    assert [project["id"] for project in projects.json()] == [project_id]


def test_project_isolation_between_organizations() -> None:
    first_token = register("first@example.com")
    project = client.post(
        "/projects",
        headers={"Authorization": f"Bearer {first_token}"},
        json={"name": "Private Twin"},
    ).json()
    second_token = register("second@example.com")

    response = client.get(
        f"/projects/{project['id']}",
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert response.status_code == 404


def test_topology_round_trip_is_scoped_to_project() -> None:
    token = register("topology@example.com")
    project = client.post(
        "/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Topology Twin"},
    ).json()
    topology = {
        "nodes": [{"id": "core-01", "name": "Core switch", "kind": "device"}],
        "links": [],
    }

    saved = client.put(
        f"/projects/{project['id']}/topology",
        headers={"Authorization": f"Bearer {token}"},
        json=topology,
    )
    loaded = client.get(
        f"/projects/{project['id']}/topology",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert saved.status_code == 200
    assert loaded.status_code == 200
    assert loaded.json() == topology


def test_graph_and_dashboard_endpoints_use_project_topology() -> None:
    token = register("graph-dashboard@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Graph API Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    topology = {"nodes": [{"id": "edge", "name": "Edge firewall", "kind": "device"}], "links": []}

    saved = client.put(f"/api/graph?project_id={project['id']}", headers=headers, json=topology)
    graph = client.get(f"/api/graph?project_id={project['id']}", headers=headers)
    dashboard = client.get(f"/api/dashboard?project_id={project['id']}", headers=headers)
    stripped_graph = client.get(f"/graph?project_id={project['id']}", headers=headers)
    stripped_dashboard = client.get(f"/dashboard?project_id={project['id']}", headers=headers)

    assert saved.status_code == 200
    assert graph.json() == topology
    assert dashboard.status_code == 200
    assert dashboard.json()["node_count"] == 1
    assert dashboard.json()["link_count"] == 0
    assert stripped_graph.json() == topology
    assert stripped_dashboard.json()["node_count"] == 1


def test_topology_rejects_other_organization() -> None:
    owner_token = register("owner-topology@example.com")
    project = client.post(
        "/projects",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"name": "Protected topology"},
    ).json()
    other_token = register("other-topology@example.com")

    response = client.get(
        f"/projects/{project['id']}/topology",
        headers={"Authorization": f"Bearer {other_token}"},
    )

    assert response.status_code == 404


def test_device_crud_updates_project_topology() -> None:
    token = register("device@example.com")
    project = client.post(
        "/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Device Twin"},
    ).json()
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        f"/projects/{project['id']}/devices",
        headers=headers,
        json={"name": "Core switch", "kind": "device"},
    )
    loaded = client.get(f"/projects/{project['id']}/topology", headers=headers)
    updated = client.patch(f"/projects/{project['id']}/devices/{created.json()['id']}", headers=headers, json={"name": "Cisco core", "kind": "device", "vendor": "Cisco", "model": "Catalyst 9500"})
    deleted = client.delete(f"/projects/{project['id']}/devices/{created.json()['id']}", headers=headers)
    empty = client.get(f"/projects/{project['id']}/topology", headers=headers)

    assert created.status_code == 201
    assert loaded.json()["nodes"][0]["name"] == "Core switch"
    assert updated.status_code == 200
    assert updated.json()["model"] == "Catalyst 9500"
    assert deleted.status_code == 204
    assert empty.json()["nodes"] == []


def test_link_crud_requires_project_devices() -> None:
    token = register("links@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Link Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    first = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Switch A"}).json()
    second = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Switch B"}).json()

    created = client.post(f"/projects/{project['id']}/links", headers=headers, json={"source": first["id"], "target": second["id"], "medium": "ethernet"})
    deleted = client.delete(f"/projects/{project['id']}/links/{first['id']}/{second['id']}", headers=headers)
    invalid = client.post(f"/projects/{project['id']}/links", headers=headers, json={"source": first["id"], "target": "missing", "medium": "fiber"})

    assert created.status_code == 201
    assert len(created.json()["links"]) == 1
    assert deleted.status_code == 200
    assert deleted.json()["links"] == []
    assert invalid.status_code == 422


def test_link_update_persists_port_details() -> None:
    token = register("link-edit@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Link edit twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    first = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Core switch", "kind": "device"}).json()
    second = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Access switch", "kind": "device"}).json()

    created = client.post(
        f"/projects/{project['id']}/links",
        headers=headers,
        json={"source": first["id"], "target": second["id"], "medium": "ethernet", "source_port": "Gi1/0/1", "target_port": "Gi1/0/24"},
    )
    updated = client.patch(
        f"/projects/{project['id']}/links/{first['id']}/{second['id']}",
        headers=headers,
        json={"source": first["id"], "target": second["id"], "medium": "fiber", "source_port": "Eth1/1", "target_port": "Eth1/2"},
    )
    loaded = client.get(f"/projects/{project['id']}/topology", headers=headers)

    assert created.status_code == 201
    assert updated.status_code == 200
    assert updated.json()["links"][0]["medium"] == "fiber"
    assert updated.json()["links"][0]["source_port"] == "Eth1/1"
    assert loaded.json()["links"][0]["target_port"] == "Eth1/2"


def test_link_creation_rejects_duplicate_connections() -> None:
    token = register("link-duplicate@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Duplicate link twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    first = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Core switch", "kind": "device"}).json()
    second = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Access switch", "kind": "device"}).json()

    first_create = client.post(f"/projects/{project['id']}/links", headers=headers, json={"source": first["id"], "target": second["id"], "medium": "ethernet"})
    reverse_duplicate = client.post(f"/projects/{project['id']}/links", headers=headers, json={"source": second["id"], "target": first["id"], "medium": "fiber"})

    assert first_create.status_code == 201
    assert reverse_duplicate.status_code == 409


def test_ip_allocation_crud_is_scoped_and_rejects_duplicates() -> None:
    token = register("ipam@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "IPAM Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(f"/projects/{project['id']}/ip-allocations", headers=headers, json={"address": "10.10.1.20", "subnet": "255.255.255.0", "description": "Core switch"})
    duplicate = client.post(f"/projects/{project['id']}/ip-allocations", headers=headers, json={"address": "10.10.1.20", "subnet": "255.255.255.0"})
    listed = client.get(f"/projects/{project['id']}/ip-allocations", headers=headers)
    deleted = client.delete(f"/projects/{project['id']}/ip-allocations/{created.json()['id']}", headers=headers)
    other_token = register("ipam-other@example.com")
    isolated = client.get(f"/projects/{project['id']}/ip-allocations", headers={"Authorization": f"Bearer {other_token}"})

    assert created.status_code == 201
    assert duplicate.status_code == 409
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert deleted.status_code == 204
    assert isolated.status_code == 404


def test_security_rule_crud_is_scoped_and_rejects_equivalent_rules() -> None:
    token = register("security@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Security Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"name": "Block inbound SSH", "action": "deny", "protocol": "tcp", "source": "0.0.0.0/0", "destination": "10.10.1.20", "port": "22"}

    created = client.post(f"/projects/{project['id']}/security-rules", headers=headers, json=payload)
    duplicate = client.post(f"/projects/{project['id']}/security-rules", headers=headers, json=payload)
    listed = client.get(f"/projects/{project['id']}/security-rules", headers=headers)
    deleted = client.delete(f"/projects/{project['id']}/security-rules/{created.json()['id']}", headers=headers)
    other_token = register("security-other@example.com")
    isolated = client.get(f"/projects/{project['id']}/security-rules", headers={"Authorization": f"Bearer {other_token}"})

    assert created.status_code == 201
    assert duplicate.status_code == 409
    assert listed.json()[0]["name"] == "Block inbound SSH"
    assert deleted.status_code == 204
    assert isolated.status_code == 404


def test_task_lifecycle_is_scoped_to_project() -> None:
    token = register("tasks@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Tasks Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"title": "Review firewall policy", "priority": "high", "status": "open", "assignee": "tech@example.com", "due_date": "2026-08-30"}

    created = client.post(f"/projects/{project['id']}/tasks", headers=headers, json=payload)
    updated = client.patch(f"/projects/{project['id']}/tasks/{created.json()['id']}", headers=headers, json={**payload, "status": "done"})
    listed = client.get(f"/projects/{project['id']}/tasks", headers=headers)
    deleted = client.delete(f"/projects/{project['id']}/tasks/{created.json()['id']}", headers=headers)
    other_token = register("tasks-other@example.com")
    isolated = client.get(f"/projects/{project['id']}/tasks", headers={"Authorization": f"Bearer {other_token}"})

    assert created.status_code == 201
    assert updated.status_code == 200
    assert updated.json()["status"] == "done"
    assert listed.status_code == 200
    assert deleted.status_code == 204
    assert isolated.status_code == 404


def test_infrastructure_asset_crud_is_scoped_to_project() -> None:
    token = register("assets@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Asset Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"category": "camera", "name": "Lobby camera", "status": "active", "location": "Main lobby", "details": "PoE ceiling camera"}

    created = client.post(f"/projects/{project['id']}/assets", headers=headers, json=payload)
    listed = client.get(f"/projects/{project['id']}/assets?category=camera", headers=headers)
    deleted = client.delete(f"/projects/{project['id']}/assets/{created.json()['id']}", headers=headers)
    other_token = register("assets-other@example.com")
    isolated = client.get(f"/projects/{project['id']}/assets", headers={"Authorization": f"Bearer {other_token}"})

    assert created.status_code == 201
    assert listed.json()[0]["name"] == "Lobby camera"
    assert deleted.status_code == 204
    assert isolated.status_code == 404


def test_floorplan_upload_stores_metadata_without_embedding_file() -> None:
    token = register("floorplan@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Floorplan Twin"}).json()

    response = client.post(
        f"/projects/{project['id']}/floorplan",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("level-1.png", b"fake-png-content", "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["floorplan_content_type"] == "image/png"
    assert response.json()["floorplan_path"].endswith(".png")


def test_device_position_is_persisted_in_topology() -> None:
    token = register("position@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Position Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    device = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Camera 01"}).json()

    response = client.patch(
        f"/projects/{project['id']}/devices/{device['id']}/position",
        headers=headers,
        json={"floorplan_x": 0.35, "floorplan_y": 0.72},
    )

    assert response.status_code == 200
    assert response.json()["nodes"][0]["floorplan_x"] == 0.35
    assert response.json()["nodes"][0]["floorplan_y"] == 0.72


def test_csv_import_adds_typed_devices() -> None:
    token = register("csv@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "CSV Twin"}).json()
    response = client.post(
        f"/projects/{project['id']}/import/csv",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("devices.csv", b"name,kind\nAccess Switch,device\nLobby,site\n", "text/csv")},
    )

    assert response.status_code == 200
    assert response.json() == {"imported": 2, "topology_nodes": 2}


def test_nmap_xml_import_adds_hosts() -> None:
    token = register("nmap@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Nmap Twin"}).json()
    xml = b'''<?xml version="1.0"?><nmaprun><host><status state="up"/><address addr="10.0.0.2" addrtype="ipv4"/><hostnames><hostname name="core-switch"/></hostnames></host><host><status state="up"/><address addr="10.0.0.3" addrtype="ipv4"/></host></nmaprun>'''

    response = client.post(
        f"/projects/{project['id']}/import/nmap",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("scan.xml", xml, "application/xml")},
    )

    assert response.status_code == 200
    assert response.json() == {"imported": 2, "topology_nodes": 2}


def test_project_json_export_is_organization_scoped() -> None:
    token = register("export@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Export Twin"}).json()
    response = client.get(f"/projects/{project['id']}/export/json", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["project"]["name"] == "Export Twin"
    assert response.json()["topology"] == {"nodes": [], "links": []}


def test_project_pdf_export_returns_pdf(monkeypatch) -> None:
    token = register("pdf@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "PDF Twin"}).json()
    monkeypatch.setattr("backend.main.render_as_built_pdf", lambda project, topology: b"%PDF-1.7 fake")

    response = client.get(f"/projects/{project['id']}/export/pdf", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_safe_config_preview_renders_only_approved_variables() -> None:
    token = register("config@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Config Twin"}).json()
    response = client.post(
        f"/projects/{project['id']}/config/preview",
        headers={"Authorization": f"Bearer {token}"},
        json={"vendor": "cisco_ios", "hostname": "core-01", "management_ip": "10.0.0.2", "vlan_id": 10},
    )

    assert response.status_code == 200
    assert "hostname core-01" in response.json()["generated_config"]
    assert response.json()["ai_suggested"] is False


def test_ai_query_is_project_grounded_when_gemini_is_unconfigured(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    token = register("ai@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "AI Twin"}).json()
    response = client.post(
        f"/projects/{project['id']}/ai/query",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": "show me PoE devices"},
    )

    assert response.status_code == 200
    assert "not configured" in response.json()["answer"]
    assert response.json()["grounded_node_count"] == 0


def test_ai_query_cache_marks_reused_response(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    token = register("ai-cache@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "AI Cache Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"query": "show me devices"}

    client.post(f"/projects/{project['id']}/ai/query", headers=headers, json=payload)
    second = client.post(f"/projects/{project['id']}/ai/query", headers=headers, json=payload)

    assert second.status_code == 200
    assert second.json()["cached"] is True