#!/usr/bin/env python3
"""Upload an existing signed RAWAJ APK to a Huawei DRAFT. Never submit for release."""
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

ROOT = "https://connect-api.cloud.huawei.com/api"

def api(method, url, headers=None, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    h = {"Accept": "application/json", **(headers or {})}
    if data is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"Huawei {method} failed: HTTP {err.code}") from None

def check(ret, step):
    status = ret.get("ret")
    if isinstance(status, str):
        try:
            status = json.loads(status)
        except ValueError:
            raise RuntimeError(f"{step}: unknown response from Huawei") from None
    if isinstance(status, dict) and str(status.get("code")) != "0":
        raise RuntimeError(f"{step}: Huawei error {status.get('code')}: {status.get('msg')}")

def upload_binary(url, auth_code, apk):
    boundary = "----Rawaj" + uuid.uuid4().hex
    def field(name, val):
        return (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{val}\r\n').encode()
    body = (
        field("authCode", auth_code) + field("fileCount", "1") +
        (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{apk.name}"\r\n'
         'Content-Type: application/vnd.android.package-archive\r\n\r\n').encode() +
        apk.read_bytes() + (f'\r\n--{boundary}--\r\n').encode()
    )
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Accept": "application/json", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=240) as result:
            return json.loads(result.read())
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"Huawei binary upload failed: HTTP {err.code}") from None

def main():
    apk = Path(sys.argv[1]).resolve()
    if not apk.is_file() or apk.suffix.lower() != ".apk":
        raise RuntimeError("Missing signed APK")
    with zipfile.ZipFile(apk) as z:
        if z.testzip() is not None or "AndroidManifest.xml" not in z.namelist():
            raise RuntimeError("APK archive is invalid")
    client_id = os.environ.get("HUAWEI_API_CLIENT_ID", "").strip()
    secret = os.environ.get("HUAWEI_API_CLIENT_SECRET", "").strip()
    app_id = os.environ.get("HUAWEI_APP_ID", "").strip()
    if not client_id or not secret or not app_id.isdigit():
        raise RuntimeError("Configure HUAWEI_API_CLIENT_ID, HUAWEI_API_CLIENT_SECRET and numeric HUAWEI_APP_ID in GitHub Actions Secrets")
    print("Uploading existing signed APK:", apk.name)
    print("SHA-256:", hashlib.sha256(apk.read_bytes()).hexdigest())
    auth = api("POST", f"{ROOT}/oauth2/v1/token", payload={
        "grant_type": "client_credentials", "client_id": client_id, "client_secret": secret})
    token = auth.get("access_token")
    if not token:
        raise RuntimeError("Huawei did not issue an access token; check API client permissions")
    headers = {"Authorization": f"Bearer {token}", "client_id": client_id}
    spec = api("GET", f"{ROOT}/publish/v2/upload-url?" + urllib.parse.urlencode({
        "appId": app_id, "suffix": "apk", "releaseType": "1"}), headers=headers)
    check(spec, "Get upload URL")
    upload_url, code = spec.get("uploadUrl"), spec.get("authCode")
    if not upload_url or not str(upload_url).startswith("https://") or not code:
        raise RuntimeError("Huawei did not provide an upload URL or authorization code")
    result = upload_binary(upload_url, str(code), apk)
    if str(result.get("resultCode", "0")) != "0":
        raise RuntimeError(f"Huawei refused binary package, code {result.get('resultCode')}")
    files = result.get("result", {}).get("UploadFileRsp", {}).get("fileInfoList", [])
    if not files:
        raise RuntimeError("No uploaded file metadata returned by Huawei")
    location = files[0].get("fileDestUlr") or files[0].get("fileDestUrl")
    if not location:
        raise RuntimeError("Huawei did not return the package destination")
    update = api("PUT", f"{ROOT}/publish/v2/app-file-info?" + urllib.parse.urlencode({
        "appId": app_id}), headers=headers, payload={
            "fileType": 5,
            "files": [{"fileName": apk.name, "fileDestUrl": location,
                       "size": int(files[0].get("size") or apk.stat().st_size)}]})
    check(update, "Add to app draft")
    print("SUCCESS: Huawei draft package updated, but NOT submitted for release.")
    print("Next: review Manage packages and run Cloud Testing before Submit.")

if __name__ == "__main__":
    main()
