"""CSDIC lecture gateway. Run behind the HTTPS video hostname on loopback."""

import argparse
import hashlib
import json
import os
import re
import secrets
import threading
import time
from http.cookies import CookieError, SimpleCookie
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


SUPABASE_URL = "https://ppomjjbwsunokbkauktk.supabase.co"
# Public project key, identical to member-config.js. Never substitute a service key.
PUBLISHABLE_KEY = "sb_publishable_CR1IzTL7Y6QwO1Wb2FMYYg_P7Dp7xfR"
SITE_ORIGINS = {"https://csdic.co.kr", "https://www.csdic.co.kr"}
COOKIE = "__Host-csdic-lecture"
SESSION_SECONDS = 900
THUMBNAILS = {".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
ASSET_PATH = re.compile(r"/api/lectures/([a-f0-9]{32})/(thumbnail|stream)")
BEARER = re.compile(r"Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)")
USER_ID = re.compile(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Supabase:
    def __init__(self, key):
        if not re.fullmatch(r"sb_publishable_[A-Za-z0-9_-]+", key):
            raise ValueError("A Supabase publishable key is required.")
        self.key = key
        self.opener = build_opener(NoRedirect())

    def get(self, path, token):
        request = Request(SUPABASE_URL + path, headers={
            "apikey": self.key, "Authorization": "Bearer " + token, "Accept": "application/json",
        })
        try:
            with self.opener.open(request, timeout=6) as response:
                return json.loads(response.read(131073))
        except HTTPError as error:
            error.close()
            if error.code in (400, 401, 403):
                return None
            raise OSError("Membership service unavailable") from None
        except (URLError, ValueError, TimeoutError):
            raise OSError("Membership service unavailable") from None

    def verified_user(self, token):
        user = self.get("/auth/v1/user", token)
        if isinstance(user, dict) and user.get("email_confirmed_at") and not user.get("is_anonymous"):
            uid = user.get("id", "")
            if isinstance(uid, str) and USER_ID.fullmatch(uid):
                return uid
        return None

    def approved(self, token, uid):
        query = urlencode({"select": "status", "user_id": "eq." + uid, "limit": "1"})
        rows = self.get("/rest/v1/memberships?" + query, token)
        return isinstance(rows, list) and len(rows) == 1 and isinstance(rows[0], dict) and rows[0].get("status") == "approved"


class Sessions:
    def __init__(self):
        self.records = {}
        self.lock = threading.Lock()

    def read(self, sid):
        with self.lock:
            record = self.records.get(sid)
            if record and record[2] > time.monotonic():
                return record
            self.records.pop(sid, None)
        return None

    def write(self, previous, uid, token):
        with self.lock:
            now = time.monotonic()
            self.records = {sid: value for sid, value in self.records.items() if value[2] > now}
            record = self.records.get(previous)
            if not record or record[0] != uid:
                self.records.pop(previous, None)
                if len(self.records) >= 2048:
                    return None
                previous = secrets.token_urlsafe(32)
            self.records[previous] = (uid, token, now + SESSION_SECONDS)
            return previous

    def remove(self, sid, record=None):
        with self.lock:
            if record is None or self.records.get(sid) is record:
                self.records.pop(sid, None)


def safe_file(path, root):
    try:
        return not path.is_symlink() and path.resolve(strict=True).parent == root and path.is_file()
    except (OSError, RuntimeError):
        return False


def catalog(root):
    files = sorted((p for p in root.iterdir() if p.suffix.lower() in {".mp4", *THUMBNAILS}
                    and safe_file(p, root)), key=lambda p: (p.name.casefold(), p.name))
    photos = {(p.stem.casefold(), p.suffix.lower()): p for p in files if p.suffix.lower() in THUMBNAILS}
    result = {}
    for path in files:
        if path.suffix.lower() != ".mp4" or not path.stem.strip():
            continue
        video_id = hashlib.sha256(path.name.encode("utf-8")).hexdigest()[:32]
        image = next((photos[(path.stem.casefold(), ext)] for ext in THUMBNAILS
                      if (path.stem.casefold(), ext) in photos), None)
        result[video_id] = (path, image)
    return result


def parse_range(value, size):
    match = re.fullmatch(r"bytes=([0-9]{0,18})-([0-9]{0,18})", value)
    if not match or not size or not any(match.groups()):
        return None
    first, last = match.groups()
    if not first:
        if int(last) == 0:
            return None
        return max(0, size - int(last)), size - 1
    start, end = int(first), min(int(last), size - 1) if last else size - 1
    return (start, end) if start <= end else None


def read_file(file, length):
    with file:
        while length > 0:
            chunk = file.read(min(128 * 1024, length))
            if not chunk:
                break
            yield chunk
            length -= len(chunk)


def make_app(root, auth):
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Lecture folder must be a directory.")
    sessions = Sessions()

    def app(environ, start_response):
        method, path = environ["REQUEST_METHOD"], environ["PATH_INFO"]
        origin = environ.get("HTTP_ORIGIN")
        headers = [("Cache-Control", "private, no-store, max-age=0"), ("X-Content-Type-Options", "nosniff"),
                   ("Referrer-Policy", "no-referrer"), ("Vary", "Origin")]
        if origin in SITE_ORIGINS:
            headers += [("Access-Control-Allow-Origin", origin), ("Access-Control-Allow-Credentials", "true")]

        def respond(status, data=None, extra=()):
            body = b"" if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
            start_response(status, headers + list(extra) + ([] if status.startswith("204") else [
                ("Content-Type", "application/json; charset=utf-8"), ("Content-Length", str(len(body)))]))
            return [] if method == "HEAD" or not body else [body]

        def session_cookie(value, age):
            return ("Set-Cookie", f"{COOKIE}={value}; Path=/; Max-Age={age}; Secure; HttpOnly; SameSite=Strict")

        if origin is not None and origin not in SITE_ORIGINS:
            return respond("403 Forbidden")
        asset = ASSET_PATH.fullmatch(path)
        if method == "OPTIONS" and origin in SITE_ORIGINS and (asset or path in {"/api/session", "/api/lectures", "/api/health"}):
            return respond("204 No Content", extra=[("Access-Control-Allow-Methods", "GET, HEAD, POST, DELETE, OPTIONS"),
                ("Access-Control-Allow-Headers", "Authorization, Range"), ("Access-Control-Max-Age", "600")])
        if path == "/api/health" and method == "GET":
            return respond("200 OK", {"service": "csdic-lectures-v1"})

        sid = ""
        try:
            cookie = SimpleCookie(environ.get("HTTP_COOKIE", ""))
            sid = cookie[COOKIE].value if COOKIE in cookie else ""
        except CookieError:
            pass
        if path == "/api/session" and method in {"POST", "DELETE"}:
            if origin not in SITE_ORIGINS:
                return respond("403 Forbidden")
            if method == "DELETE":
                sessions.remove(sid)
                return respond("204 No Content", extra=[session_cookie("", 0)])
            value = environ.get("HTTP_AUTHORIZATION", "")
            bearer = BEARER.fullmatch(value) if len(value) <= 8192 else None
            if not bearer:
                return respond("401 Unauthorized")
            token = bearer[1]
            try:
                uid = auth.verified_user(token)
                if not uid or not auth.approved(token, uid):
                    sessions.remove(sid)
                    return respond("403 Forbidden", extra=[session_cookie("", 0)])
            except OSError:
                return respond("503 Service Unavailable")
            sid = sessions.write(sid, uid, token)
            if not sid:
                return respond("503 Service Unavailable")
            return respond("204 No Content", extra=[session_cookie(sid, SESSION_SECONDS)])

        if method not in {"GET", "HEAD"} or not (asset or path == "/api/lectures"):
            return respond("404 Not Found")
        record = sessions.read(sid)
        if not record:
            return respond("401 Unauthorized")
        try:
            if not auth.approved(record[1], record[0]):
                sessions.remove(sid, record)
                return respond("403 Forbidden")
            items = catalog(root)
        except OSError:
            return respond("503 Service Unavailable")
        if not asset:
            return respond("200 OK", {"lectures": [{"id": key, "title": video.stem, "thumbnail": image is not None}
                                                    for key, (video, image) in items.items()]})
        if asset[1] not in items:
            return respond("404 Not Found")
        stream = asset[2] == "stream"
        file_path = items[asset[1]][0 if stream else 1]
        if file_path is None:
            return respond("404 Not Found")
        try:
            file = file_path.open("rb")
        except OSError:
            return respond("404 Not Found")
        try:
            size = os.fstat(file.fileno()).st_size
            status = "200 OK"
            start, end = 0, size - 1
            media_headers = [("Content-Type", "video/mp4" if stream else THUMBNAILS[file_path.suffix.lower()])]
            if stream:
                media_headers.append(("Accept-Ranges", "bytes"))
                requested = environ.get("HTTP_RANGE")
                if requested:
                    bounds = parse_range(requested, size)
                    if bounds is None:
                        file.close()
                        return respond("416 Range Not Satisfiable", extra=[("Content-Range", f"bytes */{size}")])
                    start, end = bounds
                    status = "206 Partial Content"
                    media_headers.append(("Content-Range", f"bytes {start}-{end}/{size}"))
            length = end - start + 1
            if method != "HEAD" and length:
                file.seek(start)
            start_response(status, headers + media_headers + [("Content-Length", str(length))])
            if method == "HEAD" or not length:
                file.close()
                return []
            return read_file(file, length)
        except BaseException:
            file.close()
            raise

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, required=True)
    parser.add_argument("--port", type=int, default=8010)
    args = parser.parse_args()
    from waitress import serve
    serve(make_app(args.library, Supabase(os.environ.get("CSDIC_SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY))),
          host="127.0.0.1", port=args.port, threads=12, max_request_body_size=16384, channel_timeout=60)
