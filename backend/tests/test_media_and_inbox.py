import io

from PIL import Image

from services import email as email_service
from services.email import SendResult


def png_bytes(size=(4, 3)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, "green").save(buffer, format="PNG")
    return buffer.getvalue()


PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def upload(owner, data, name="file.png", content_type="image/png"):
    return owner.post("/api/v1/admin/media", files={"file": (name, data, content_type)})


def test_upload_image_and_pdf(owner):
    image = upload(owner, png_bytes(), "../../evil name.png")
    assert image.status_code == 201
    body = image.json()
    assert body["kind"] == "image" and (body["width"], body["height"]) == (4, 3)
    assert ".." not in body["filename"] and "/" not in body["filename"]
    assert owner.get(body["url"]).status_code == 200  # served by local storage
    pdf = upload(owner, PDF, "cv.pdf", "application/pdf")
    assert pdf.status_code == 201 and pdf.json()["kind"] == "document"


def test_upload_rejects_disguised_and_unsafe_files(owner):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    assert upload(owner, svg, "a.svg", "image/svg+xml").status_code == 415
    assert upload(owner, b"<html>hi</html>", "photo.png", "image/png").status_code == 415
    assert upload(owner, b"", "empty.png").status_code == 422


def test_upload_size_limit(owner, monkeypatch):
    from routers.v1 import admin_media

    monkeypatch.setattr(admin_media, "READ_LIMIT_BYTES", 100)
    assert upload(owner, png_bytes((200, 200))).status_code == 413


def test_media_search_filter_replace_and_delete(owner):
    image = upload(owner, png_bytes(), "portrait.png").json()
    upload(owner, PDF, "resume.pdf", "application/pdf")
    assert owner.get("/api/v1/admin/media?kind=document").json()["total"] == 1
    assert owner.get("/api/v1/admin/media?q=portrait").json()["items"][0]["id"] == image["id"]
    replaced = owner.put(f"/api/v1/admin/media/{image['id']}/file", files={"file": ("new.png", png_bytes((8, 8)), "image/png")})
    assert replaced.status_code == 200
    assert replaced.json()["id"] == image["id"] and replaced.json()["width"] == 8
    assert owner.get(image["url"]).status_code == 404  # old file removed
    wrong_kind = owner.put(f"/api/v1/admin/media/{image['id']}/file", files={"file": ("x.pdf", PDF, "application/pdf")})
    assert wrong_kind.status_code == 422
    owner.patch("/api/v1/admin/profile", json={"photo_id": image["id"]})
    in_use = owner.delete(f"/api/v1/admin/media/{image['id']}")
    assert in_use.status_code == 409 and "Profile photo" in in_use.json()["detail"]
    owner.patch("/api/v1/admin/profile", json={"photo_id": None})
    assert owner.delete(f"/api/v1/admin/media/{image['id']}").status_code == 204


def test_resume_management(owner, client):
    image = upload(owner, png_bytes()).json()
    pdf = upload(owner, PDF, "cv.pdf", "application/pdf").json()
    assert owner.put("/api/v1/admin/resume", json={"media_id": image["id"]}).status_code == 422
    assert owner.put("/api/v1/admin/resume", json={"media_id": pdf["id"]}).json()["active"]["id"] == pdf["id"]
    redirect = client.get("/api/v1/public/resume", follow_redirects=False)
    assert redirect.status_code == 307 and redirect.headers["location"] == pdf["url"]
    assert client.get("/api/v1/public/site").json()["profile"]["resume_url"] == pdf["url"]


def _message(client):
    client.post("/api/v1/contact", json={"name": "Grace", "email": "grace@example.com", "subject": "Role", "message": "We have an opening for you."})


class FakeSender:
    def __init__(self, results):
        self.results = list(results)
        self.sent = []

    def send(self, **kwargs):
        self.sent.append(kwargs)
        return self.results.pop(0)


def test_reply_without_provider_is_saved_but_not_marked_sent(client, owner):
    _message(client)
    message_id = owner.get("/api/v1/admin/messages").json()["items"][0]["id"]
    response = owner.post(f"/api/v1/admin/messages/{message_id}/replies", json={"subject": "Re: Role", "body": "Thanks!"})
    assert response.status_code == 201
    reply = response.json()["reply"]
    assert reply["status"] == "not_configured" and reply["sent_at"] is None
    assert "not sent" in reply["error"]


def test_reply_failure_then_retry_success(client, owner):
    fake = FakeSender([SendResult("failed", error="Provider error 500"), SendResult("sent", provider_message_id="abc")])
    email_service.set_sender(fake)
    _message(client)
    message_id = owner.get("/api/v1/admin/messages").json()["items"][0]["id"]
    reply = owner.post(f"/api/v1/admin/messages/{message_id}/replies", json={"subject": "Re", "body": "Hello"}).json()["reply"]
    assert reply["status"] == "failed"
    retried = owner.post(f"/api/v1/admin/replies/{reply['id']}/retry").json()["reply"]
    assert retried["status"] == "sent" and retried["provider_message_id"] == "abc" and retried["attempts"] == 2
    assert owner.post(f"/api/v1/admin/replies/{reply['id']}/retry").status_code == 409
    assert fake.sent[0]["to"] == "grace@example.com" and fake.sent[0]["reply_to"] == "claudeish88@gmail.com"
    thread = owner.get(f"/api/v1/admin/messages/{message_id}").json()
    assert thread["is_read"] is True and len(thread["replies"]) == 1


def test_inbox_read_archive_and_search(client, owner):
    _message(client)
    message_id = owner.get("/api/v1/admin/messages").json()["items"][0]["id"]
    owner.patch(f"/api/v1/admin/messages/{message_id}", json={"is_read": True})
    assert owner.get("/api/v1/admin/messages?folder=unread").json()["items"] == []
    owner.patch(f"/api/v1/admin/messages/{message_id}", json={"archived": True})
    assert owner.get("/api/v1/admin/messages").json()["items"] == []
    assert len(owner.get("/api/v1/admin/messages?folder=archived").json()["items"]) == 1
    assert len(owner.get("/api/v1/admin/messages?folder=archived&q=opening").json()["items"]) == 1
    assert owner.get("/api/v1/admin/messages?folder=archived&q=zzz").json()["items"] == []
