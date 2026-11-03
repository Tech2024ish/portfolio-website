import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

_tmp = tempfile.mkdtemp(prefix="portfolio-tests-")
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": f"sqlite:///{Path(_tmp, 'test.db').as_posix()}",
        "STORAGE_BACKEND": "local",
        "LOCAL_MEDIA_DIR": str(Path(_tmp, "media")),
        "COOKIE_SECURE": "false",
        "CORS_ORIGINS": "http://localhost:5173,https://goslish.vercel.app",
        "RESEND_API_KEY": "",
        "MAIL_FROM": "",
    }
)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import models.entities  # noqa: E402,F401
from core import db as core_db  # noqa: E402
from core.security import hash_password  # noqa: E402
from main import app  # noqa: E402
from models.entities import OwnerUser  # noqa: E402
from routers.v1.public import contact_throttle  # noqa: E402
from services import email as email_service  # noqa: E402
from services.auth import login_throttle  # noqa: E402
from services.seed import seed_initial_content  # noqa: E402

OWNER_EMAIL = "owner@example.com"
OWNER_PASSWORD = "Correct-Horse-42!"
CSRF = {"X-Requested-With": "portfolio-admin"}


@pytest.fixture(autouse=True)
def database():
    engine = core_db.get_engine()
    core_db.Base.metadata.drop_all(engine)
    core_db.Base.metadata.create_all(engine)
    with Session(engine) as session:
        seed_initial_content(session)
        session.add(OwnerUser(email=OWNER_EMAIL, display_name="Owner", password_hash=hash_password(OWNER_PASSWORD)))
        session.commit()
    login_throttle._failures.clear()
    contact_throttle.hits.clear()
    email_service.set_sender(None)
    yield engine


@pytest.fixture
def client():
    return TestClient(app)


def login(client: TestClient) -> TestClient:
    response = client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, headers=CSRF)
    assert response.status_code == 200, response.text
    client.headers.update(CSRF)
    return client


@pytest.fixture
def owner(client):
    return login(client)


@pytest.fixture
def db_session(database):
    with Session(database) as session:
        yield session
