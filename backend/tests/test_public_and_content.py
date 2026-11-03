def test_public_site_only_shows_published_and_visible(client):
    site = client.get("/api/v1/public/site").json()
    slugs = {p["slug"] for p in site["projects"]}
    assert {"school-management-system", "mosaic", "portfolio-website", "buzhub-platform"} <= slugs
    assert "tondeai" not in slugs  # draft
    orgs = [e["organization"] for e in site["experience"]]
    assert orgs == ["SilverLandTech", "Techinika"]  # hidden drafts excluded
    assert site["profile"]["full_name"] == "Jean Claude Ishimwe"
    assert "photo_id" not in site["profile"]
    assert site["education"][0]["period_label"] == "Expected July 2028"


def test_public_project_and_article_404s(client):
    assert client.get("/api/v1/public/projects/school-management-system").status_code == 200
    assert client.get("/api/v1/public/projects/tondeai").status_code == 404
    assert client.get("/api/v1/public/articles/missing").status_code == 404
    assert client.get("/api/v1/public/resume").status_code == 404


def test_contact_flow_and_validation(client, owner):
    anonymous = client.__class__(client.app)
    ok = anonymous.post("/api/v1/contact", json={"name": "Ada", "email": "ada@example.com", "message": "Hello there, nice work!"})
    assert ok.status_code == 201
    bad = anonymous.post("/api/v1/contact", json={"name": "A", "email": "nope", "message": "short"})
    assert bad.status_code == 422
    fields = {f["field"] for f in bad.json()["error"]["fields"]}
    assert {"name", "email", "message"} <= fields
    trap = anonymous.post(
        "/api/v1/contact", json={"name": "Bot", "email": "b@example.com", "message": "buy things now!!", "website": "x"}
    )
    assert trap.status_code == 400
    inbox = owner.get("/api/v1/admin/messages").json()
    assert inbox["unread"] == 1 and inbox["items"][0]["email"] == "ada@example.com"


def test_contact_rate_limit(client):
    payload = {"name": "Ada", "email": "ada@example.com", "message": "Hello there, nice work!"}
    codes = [client.post("/api/v1/contact", json=payload).status_code for _ in range(6)]
    assert codes[:5] == [201] * 5 and codes[5] == 429


def test_profile_update_and_required_fields(owner, client):
    response = owner.patch("/api/v1/admin/profile", json={"hero_title": "Designing dependable", "is_available": False})
    assert response.status_code == 200
    assert client.get("/api/v1/public/site").json()["profile"]["hero_title"] == "Designing dependable"
    assert owner.patch("/api/v1/admin/profile", json={"full_name": None}).status_code == 422
    assert owner.patch("/api/v1/admin/profile", json={"unknown": 1}).status_code == 422
    bad_link = owner.patch("/api/v1/admin/profile", json={"social_links": [{"label": "X", "url": "javascript:alert(1)"}]})
    assert bad_link.status_code == 422
    assert owner.patch("/api/v1/admin/profile", json={"photo_id": 999}).status_code == 422


def test_project_lifecycle(owner, client):
    created = owner.post("/api/v1/admin/projects", json={"slug": "new-api", "title": "New API", "tech_stack": ["Go"]})
    assert created.status_code == 201
    project = created.json()
    assert project["status"] == "draft"
    assert owner.post("/api/v1/admin/projects", json={"slug": "new-api", "title": "Dup"}).status_code == 409
    assert owner.post("/api/v1/admin/projects", json={"slug": "Bad Slug", "title": "x"}).status_code == 422
    assert owner.post(f"/api/v1/admin/projects/{project['id']}/publish").status_code == 422  # summary missing
    owner.patch(f"/api/v1/admin/projects/{project['id']}", json={"summary": "Does a thing.", "is_featured": True})
    published = owner.post(f"/api/v1/admin/projects/{project['id']}/publish")
    assert published.json()["status"] == "published"
    assert client.get("/api/v1/public/projects/new-api").status_code == 200
    owner.post(f"/api/v1/admin/projects/{project['id']}/unpublish")
    assert client.get("/api/v1/public/projects/new-api").status_code == 404
    assert owner.delete(f"/api/v1/admin/projects/{project['id']}").status_code == 204


def test_reorder_requires_complete_list(owner):
    ids = [p["id"] for p in owner.get("/api/v1/admin/projects").json()]
    assert owner.post("/api/v1/admin/projects/reorder", json={"ids": ids[:2]}).status_code == 422
    assert owner.post("/api/v1/admin/projects/reorder", json={"ids": list(reversed(ids))}).status_code == 200
    assert [p["id"] for p in owner.get("/api/v1/admin/projects").json()] == list(reversed(ids))


def test_skills_crud_visibility_and_duplicates(owner, client):
    categories = owner.get("/api/v1/admin/skill-categories").json()
    backend = categories[0]
    created = owner.post("/api/v1/admin/skills", json={"category_id": backend["id"], "name": "Redis"})
    assert created.status_code == 201
    assert owner.post("/api/v1/admin/skills", json={"category_id": backend["id"], "name": "Redis"}).status_code == 409
    owner.patch(f"/api/v1/admin/skills/{created.json()['id']}", json={"is_visible": False})
    public_names = [s["name"] for s in client.get("/api/v1/public/site").json()["skills"][0]["skills"]]
    assert "Redis" not in public_names
    assert owner.delete(f"/api/v1/admin/skill-categories/{backend['id']}").status_code == 204
    assert len(owner.get("/api/v1/admin/skill-categories").json()) == len(categories) - 1


def test_experience_education_certifications(owner, client):
    exp = owner.post(
        "/api/v1/admin/experiences",
        json={"organization": "GS Mutara", "role": "Teaching Assistant", "period_label": "2025", "highlights": ["Taught"]},
    )
    assert exp.status_code == 201
    hidden = [e for e in owner.get("/api/v1/admin/experiences").json() if not e["is_visible"]]
    for item in hidden:
        owner.patch(f"/api/v1/admin/experiences/{item['id']}", json={"is_visible": True})
    assert len(client.get("/api/v1/public/site").json()["experience"]) == 5
    assert owner.patch(f"/api/v1/admin/experiences/{exp.json()['id']}", json={"role": None}).status_code == 422
    cert = owner.post("/api/v1/admin/certifications", json={"name": "AWS", "credential_url": "ftp://x"})
    assert cert.status_code == 422
    edu = owner.get("/api/v1/admin/education").json()[0]
    assert owner.patch(f"/api/v1/admin/education/{edu['id']}", json={"status": "Year 2"}).json()["status"] == "Year 2"


def test_article_publishing(owner, client):
    article = owner.post(
        "/api/v1/admin/articles", json={"slug": "fastapi-auth", "title": "FastAPI auth", "tags": ["fastapi"]}
    ).json()
    assert owner.post(f"/api/v1/admin/articles/{article['id']}/publish").status_code == 422
    owner.patch(f"/api/v1/admin/articles/{article['id']}", json={"excerpt": "How sessions work.", "body": "# Title\n\nBody " * 50})
    assert owner.post(f"/api/v1/admin/articles/{article['id']}/publish").status_code == 200
    listed = client.get("/api/v1/public/articles").json()
    assert listed[0]["slug"] == "fastapi-auth" and "body" not in listed[0]
    detail = client.get("/api/v1/public/articles/fastapi-auth").json()
    assert detail["body"].startswith("# Title") and detail["reading_minutes"] >= 1
    assert owner.get("/api/v1/admin/articles?status=draft").json() == []


def test_overview_reports_real_counts_only(owner):
    data = owner.get("/api/v1/admin/overview").json()
    assert data["projects"] == {"published": 4, "draft": 4}
    assert data["articles"] == {"published": 0, "draft": 0}
    assert data["messages"]["unread"] == 0
    assert "visits" in data  # None when the counter store is unreachable, never invented
