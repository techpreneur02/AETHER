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


def test_remote_operations_refuse_unconfigured_targets_without_executing(monkeypatch) -> None:
    monkeypatch.delenv("AETHER_OPS_LINUX_SSH_HOST", raising=False)
    monkeypatch.delenv("AETHER_OPS_LINUX_SSH_USER", raising=False)
    token = register("operations-admin@example.com")

    targets = client.get("/operations/targets", headers={"Authorization": f"Bearer {token}"})
    response = client.post("/operations/run", headers={"Authorization": f"Bearer {token}"}, json={"target": "linux_vps", "command": "ping", "argument": "example.com"})

    assert targets.status_code == 200
    assert next(target for target in targets.json() if target["target"] == "linux_vps")["available"] is False
    assert response.status_code == 409
    assert "Set AETHER_OPS_LINUX_SSH_HOST" in response.json()["detail"]


def test_helpdesk_requires_authentication() -> None:
    response = client.post("/ai/helpdesk", json={"query": "How do I edit a topology link?"})

    assert response.status_code == 401


def test_helpdesk_answers_from_product_guide(monkeypatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    token = register("helpdesk@example.com")
    response = client.post(
        "/ai/helpdesk",
        headers={"Authorization": f"Bearer {token}"},
        json={"query": "How do I connect devices and assign ports on the topology?"},
    )

    assert response.status_code == 200
    assert "Select a wire" in response.json()["answer"]
    assert "Build and edit the topology" in response.json()["sources"]
    assert response.json()["ai_suggested"] is False


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


def test_client_assessment_is_scored_saved_and_project_scoped() -> None:
    token = register("assessment@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Assessment Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "client_contact": "IT Manager",
        "site_count": 2,
        "user_count": 180,
        "critical_services": ["ERP", "VoIP"],
        "current_pain_points": ["Single ISP", "Undocumented switching"],
        "security_controls": ["MFA", "EDR"],
        "backup_status": "partial",
        "documentation_quality": 2,
        "resilience": 2,
        "security": 3,
        "scalability": 2,
    }

    evaluated = client.put(f"/projects/{project['id']}/assessment", headers=headers, json=payload)
    loaded = client.get(f"/projects/{project['id']}", headers=headers)
    other_token = register("assessment-other@example.com")
    isolated = client.put(f"/projects/{project['id']}/assessment", headers={"Authorization": f"Bearer {other_token}"}, json=payload)

    assert evaluated.status_code == 200
    assert evaluated.json()["grade"] == "at_risk"
    assert evaluated.json()["gaps"]
    assert loaded.json()["client_assessment"]["user_count"] == 180
    assert isolated.status_code == 404


def test_network_design_uses_requirements_and_saved_assessment() -> None:
    token = register("design@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Design Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    client.put(f"/projects/{project['id']}/assessment", headers=headers, json={"site_count": 1, "user_count": 75, "backup_status": "none", "documentation_quality": 2, "resilience": 2, "security": 2, "scalability": 3})

    response = client.post(
        f"/projects/{project['id']}/design",
        headers=headers,
        json={"objectives": ["Remove downtime", "Secure guest Wi-Fi"], "availability_target": "mission_critical", "growth_percent": 50, "wireless_scope": "office", "preferred_vendors": ["Cisco", "Fortinet"], "segmentation_required": True, "budget_band": "strategic"},
    )
    loaded = client.get(f"/projects/{project['id']}", headers=headers)

    assert response.status_code == 200
    assert "firewall HA" in response.json()["architecture"][0]
    assert "vlan 50 guest" in response.json()["configurations"]["segmentation"]
    assert loaded.json()["network_design"]["requirements"]["growth_percent"] == 50


def test_safe_configuration_profiles_generate_review_artifacts() -> None:
    token = register("configuration-profiles@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Configuration Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}

    windows = client.post(f"/projects/{project['id']}/config/preview", headers=headers, json={"vendor": "windows_server", "hostname": "dc-01", "management_ip": "10.20.0.10", "vlan_id": 20})
    firewall = client.post(f"/projects/{project['id']}/config/preview", headers=headers, json={"vendor": "firewall_policy", "hostname": "edge-01", "management_ip": "10.20.0.0/24", "vlan_id": 20})
    validation = client.post(f"/projects/{project['id']}/config/preview", headers=headers, json={"vendor": "network_validation", "hostname": "hq", "management_ip": "10.20.0.1", "vlan_id": 20})

    assert windows.status_code == 200
    assert "Set-NetFirewallProfile" in windows.json()["generated_config"]
    assert "Default deny" in firewall.json()["generated_config"]
    assert "Non-invasive checks" in validation.json()["generated_config"]


def test_security_tool_catalog_and_disabled_scan_gate(monkeypatch) -> None:
    monkeypatch.delenv("AETHER_SECURITY_TOOLS_ENABLED", raising=False)
    token = register("security-tools@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    catalog = client.get("/security-tools/catalog", headers=headers)
    blocked_scan = client.post("/security-tools/run", headers=headers, json={"tool": "nmap", "action": "nmap_host_discovery", "target": "127.0.0.1"})

    assert catalog.status_code == 200
    assert {item["id"] for item in catalog.json()} >= {"wireshark", "nmap", "kali", "splunk", "nessus"}
    assert blocked_scan.status_code == 409


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

    created = client.post(f"/projects/{project['id']}/links", headers=headers, json={"source": first["id"], "target": second["id"], "medium": "ethernet", "source_port": "Gi1/0/1", "target_port": "Gi1/0/24"})
    deleted = client.delete(f"/projects/{project['id']}/links/{first['id']}/{second['id']}", headers=headers)
    invalid = client.post(f"/projects/{project['id']}/links", headers=headers, json={"source": first["id"], "target": "missing", "medium": "fiber", "source_port": "SFP1", "target_port": "SFP1"})

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
        json={"source": first["id"], "target": second["id"], "medium": "fiber", "source_port": "Eth1/1", "target_port": "Eth1/2", "operational_status": "down"},
    )
    loaded = client.get(f"/projects/{project['id']}/topology", headers=headers)

    assert created.status_code == 201
    assert updated.status_code == 200
    assert updated.json()["links"][0]["medium"] == "fiber"
    assert updated.json()["links"][0]["source_port"] == "Eth1/1"
    assert loaded.json()["links"][0]["target_port"] == "Eth1/2"
    assert loaded.json()["links"][0]["operational_status"] == "down"


def test_link_update_can_reassign_endpoints_and_ports() -> None:
    token = register("link-reassign@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Link reassign twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    first = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Core switch", "kind": "device"}).json()
    second = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Access switch", "kind": "device"}).json()
    third = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Server rack", "kind": "service"}).json()

    created = client.post(
        f"/projects/{project['id']}/links",
        headers=headers,
        json={"source": first["id"], "target": second["id"], "medium": "ethernet", "source_port": "Gi1/0/1", "target_port": "Gi1/0/24"},
    )
    updated = client.patch(
        f"/projects/{project['id']}/links/{first['id']}/{second['id']}",
        headers=headers,
        json={"source": first["id"], "target": third["id"], "medium": "fiber", "source_port": "Eth1/1", "target_port": "Eth2/1"},
    )
    loaded = client.get(f"/projects/{project['id']}/topology", headers=headers)

    assert created.status_code == 201
    assert updated.status_code == 200
    assert updated.json()["links"][0]["source"] == first["id"]
    assert updated.json()["links"][0]["target"] == third["id"]
    assert updated.json()["links"][0]["medium"] == "fiber"
    assert loaded.json()["links"][0]["target_port"] == "Eth2/1"


def test_link_creation_rejects_duplicate_connections() -> None:
    token = register("link-duplicate@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Duplicate link twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    first = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Core switch", "kind": "device"}).json()
    second = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Access switch", "kind": "device"}).json()

    first_create = client.post(f"/projects/{project['id']}/links", headers=headers, json={"source": first["id"], "target": second["id"], "medium": "ethernet", "source_port": "Gi1/0/1", "target_port": "Gi1/0/24"})
    reverse_duplicate = client.post(f"/projects/{project['id']}/links", headers=headers, json={"source": second["id"], "target": first["id"], "medium": "fiber", "source_port": "SFP1", "target_port": "SFP2"})

    assert first_create.status_code == 201
    assert reverse_duplicate.status_code == 409


def test_link_creation_requires_explicit_endpoint_ports() -> None:
    token = register("link-ports@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Port assignment twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    first = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Router"}).json()
    second = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Switch"}).json()

    response = client.post(
        f"/projects/{project['id']}/links",
        headers=headers,
        json={"source": first["id"], "target": second["id"], "medium": "ethernet"},
    )

    assert response.status_code == 422


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


def test_security_rule_enforcement_device_must_belong_to_project() -> None:
    token = register("security-device@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Scoped policy twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    firewall = client.post(
        f"/projects/{project['id']}/devices",
        headers=headers,
        json={"name": "Edge firewall", "kind": "device"},
    ).json()
    payload = {
        "name": "Firewall SSH deny",
        "action": "deny",
        "protocol": "tcp",
        "source": "any",
        "destination": "10.0.50.0/24",
        "port": "22",
    }

    created = client.post(
        f"/projects/{project['id']}/security-rules",
        headers=headers,
        json={**payload, "device_id": firewall["id"]},
    )
    invalid = client.post(
        f"/projects/{project['id']}/security-rules",
        headers=headers,
        json={**payload, "device_id": "other-project-firewall"},
    )

    assert created.status_code == 201
    assert created.json()["device_id"] == firewall["id"]
    assert invalid.status_code == 422


def test_packet_simulation_endpoint_is_project_scoped() -> None:
    token = register("simulation@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Simulation Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    source = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Client", "kind": "device", "vendor": "Dell"}).json()
    target = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Server", "kind": "service", "vendor": "HPE"}).json()
    client.post(
        f"/projects/{project['id']}/links",
        headers=headers,
        json={"source": source["id"], "target": target["id"], "medium": "ethernet", "source_port": "Eth0", "target_port": "NIC1"},
    )

    simulated = client.post(
        f"/projects/{project['id']}/simulate/packet",
        headers=headers,
        json={"source_device_id": source["id"], "target_device_id": target["id"], "protocol": "tcp", "port": 443},
    )
    other_token = register("simulation-other@example.com")
    isolated = client.post(
        f"/projects/{project['id']}/simulate/packet",
        headers={"Authorization": f"Bearer {other_token}"},
        json={"source_device_id": source["id"], "target_device_id": target["id"], "protocol": "icmp"},
    )

    assert simulated.status_code == 200
    assert simulated.json()["disposition"] == "delivered"
    assert [hop["name"] for hop in simulated.json()["hops"]] == ["Client", "Server"]
    assert isolated.status_code == 404


def test_packet_simulation_endpoint_reports_unreachable_devices() -> None:
    token = register("simulation-unreachable@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Isolated Devices"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    source = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Client"}).json()
    target = client.post(f"/projects/{project['id']}/devices", headers=headers, json={"name": "Server"}).json()

    simulated = client.post(
        f"/projects/{project['id']}/simulate/packet",
        headers=headers,
        json={"source_device_id": source["id"], "target_device_id": target["id"], "protocol": "icmp"},
    )

    assert simulated.status_code == 200
    assert simulated.json()["disposition"] == "unreachable"
    assert simulated.json()["reachable"] is False
    assert simulated.json()["hops"] == []


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


def test_auto_import_detects_json_and_skips_duplicate_names() -> None:
    token = register("auto-import@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Universal Import Twin"}).json()
    headers = {"Authorization": f"Bearer {token}"}
    document = b'{"devices":[{"hostname":"core-01","vendor":"Cisco","model":"C9500"},{"name":"core-01"},{"name":"Server Cluster","kind":"service","manufacturer":"HPE"}]}'

    response = client.post(
        f"/projects/{project['id']}/import/auto",
        headers=headers,
        files={"file": ("inventory.json", document, "application/json")},
    )
    topology = client.get(f"/projects/{project['id']}/topology", headers=headers)

    assert response.status_code == 200
    assert response.json()["source_format"] == "json"
    assert response.json()["imported"] == 2
    assert response.json()["skipped"] == 1
    assert topology.json()["nodes"][0]["model"] == "C9500"


def test_auto_import_rejects_unreadable_binary_evidence() -> None:
    token = register("binary-import@example.com")
    project = client.post("/projects", headers={"Authorization": f"Bearer {token}"}, json={"name": "Binary Import Twin"}).json()

    response = client.post(
        f"/projects/{project['id']}/import/auto",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("inventory.xlsx", b"\xff\xfe\x00\x81", "application/octet-stream")},
    )

    assert response.status_code == 422
    assert "Export it as CSV" in response.json()["detail"]


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