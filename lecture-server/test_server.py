import io
import json
import tempfile
import unittest
from pathlib import Path
from wsgiref.util import setup_testing_defaults
from wsgiref.validate import validator

from server import COOKIE, make_app


class FakeMembership:
    status = "approved"
    available = True

    def verified_user(self, token):
        return "approved-user" if token == "one.two.three" else None

    def approved(self, token, uid):
        if not self.available:
            raise OSError("unavailable")
        return self.verified_user(token) == uid and self.status == "approved"


class LectureGatewayTest(unittest.TestCase):
    origin = "https://csdic.co.kr"
    token = "Bearer one.two.three"

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        (self.root / "01 회로 설계.mp4").write_bytes(b"0123456789")
        (self.root / "01 회로 설계.jpg").write_bytes(b"thumbnail")
        (self.root / "02 측정.mp4").write_bytes(b"video")
        (self.root / "비공개.txt").write_bytes(b"internal")
        self.auth = FakeMembership()
        self.app = validator(make_app(self.root, self.auth))

    def request(self, path, method="GET", **headers):
        env = {"REQUEST_METHOD": method, "SCRIPT_NAME": "", "PATH_INFO": path, "wsgi.input": io.BytesIO(),
               "HTTP_ORIGIN": self.origin, "QUERY_STRING": "", **headers}
        setup_testing_defaults(env)
        output = []
        body = self.app(env, lambda status, headers, exc_info=None: output.extend((status, dict(headers))))
        try:
            data = b"".join(body)
        finally:
            body.close()
        return int(output[0].split()[0]), output[1], data

    def authorize(self):
        code, headers, _ = self.request("/api/session", "POST", HTTP_AUTHORIZATION=self.token)
        self.assertEqual(code, 204)
        cookie = headers["Set-Cookie"]
        self.assertTrue(cookie.startswith(COOKIE + "="))
        for flag in ("Secure", "HttpOnly", "SameSite=Strict"):
            self.assertIn(flag, cookie)
        self.assertNotIn(self.token, cookie)
        return cookie.split(";", 1)[0]

    def test_approved_catalog_playback_and_seek(self):
        cookie = self.authorize()
        code, headers, data = self.request("/api/lectures", HTTP_COOKIE=cookie)
        self.assertEqual(code, 200)
        self.assertIn("no-store", headers["Cache-Control"])
        entries = json.loads(data)["lectures"]
        self.assertEqual([(v["title"], v["thumbnail"]) for v in entries], [("01 회로 설계", True), ("02 측정", False)])
        asset = "/api/lectures/" + entries[0]["id"] + "/"
        self.assertEqual(self.request(asset + "thumbnail", HTTP_COOKIE=cookie)[2], b"thumbnail")
        code, headers, data = self.request(asset + "stream", HTTP_COOKIE=cookie, HTTP_RANGE="bytes=2-5")
        self.assertEqual((code, data, headers["Content-Range"]), (206, b"2345", "bytes 2-5/10"))
        self.assertEqual(self.request(asset + "stream", HTTP_COOKIE=cookie, HTTP_RANGE="bytes=-2")[2], b"89")
        self.assertEqual(self.request(asset + "stream", HTTP_COOKIE=cookie, HTTP_RANGE="bytes=50-")[0], 416)
        self.assertEqual(self.request(asset + "stream", "HEAD", HTTP_COOKIE=cookie)[2], b"")
        self.assertEqual(self.request(asset + "stream", HTTP_AUTHORIZATION=self.token)[0], 401)
        self.assertEqual(self.request(asset + "thumbnail")[0], 401)
        self.assertEqual(self.request("/비공개.txt", HTTP_COOKIE=cookie)[0], 404)

    def test_cross_origin_pending_and_revoked_members(self):
        self.assertEqual(self.request("/api/lectures")[0], 401)
        self.assertEqual(self.request("/api/session", "POST", HTTP_AUTHORIZATION="Bearer bad.bad.bad")[0], 403)
        code, headers, _ = self.request("/api/session", "OPTIONS", HTTP_ORIGIN="https://elsewhere.example")
        self.assertEqual(code, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)
        self.assertEqual(self.request("/api/session", "OPTIONS")[0], 204)
        self.auth.status = "pending"
        self.assertEqual(self.request("/api/session", "POST", HTTP_AUTHORIZATION=self.token)[0], 403)
        self.auth.status = "approved"
        cookie = self.authorize()
        asset = "/api/lectures/" + json.loads(self.request("/api/lectures", HTTP_COOKIE=cookie)[2])["lectures"][0]["id"] + "/stream"
        self.auth.status = "blocked"
        self.assertEqual(self.request(asset, HTTP_COOKIE=cookie, HTTP_RANGE="bytes=0-3")[0], 403)
        self.assertEqual(self.request("/api/lectures", HTTP_COOKIE=cookie)[0], 401)

    def test_logout_and_unavailable_membership_fail_closed(self):
        cookie = self.authorize()
        self.auth.available = False
        self.assertEqual(self.request("/api/lectures", HTTP_COOKIE=cookie)[0], 503)
        self.auth.available = True
        self.assertEqual(self.request("/api/session", "DELETE", HTTP_COOKIE=cookie)[0], 204)
        self.assertEqual(self.request("/api/lectures", HTTP_COOKIE=cookie)[0], 401)


if __name__ == "__main__":
    unittest.main()
