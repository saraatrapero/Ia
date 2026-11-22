import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    database = tmp_path / "test.db"
    storage = tmp_path / "storage"
    monkeypatch.setenv("TRAPERO_DATABASE", str(database))
    monkeypatch.setenv("TRAPERO_STORAGE", str(storage))
    monkeypatch.setenv("TRAPERO_APP_SECRET", "test-secret")
    from app.main import app
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_login_and_dashboard(client):
    registered = client.post("/api/auth/register", json={"email": "owner@trapero.ai", "password": "segura-123"})
    assert registered.status_code == 200
    token = registered.json()["token"]

    logged = client.post("/api/auth/login", json={"email": "owner@trapero.ai", "password": "segura-123"})
    assert logged.status_code == 200
    assert logged.json()["token"]

    dashboard = client.get("/api/dashboard", headers={"Authorization": "Bearer " + token})
    assert dashboard.status_code == 200
    assert dashboard.json()["conversations"] == 0
