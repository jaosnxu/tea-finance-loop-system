from __future__ import annotations

import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


def main() -> int:
    parser = argparse.ArgumentParser(description="Run production smoke checks against a deployed app.")
    parser.add_argument("--base-url", required=True, help="Base URL, for example https://app.example.com")
    parser.add_argument("--paths", required=True, help="Comma-separated paths to check")
    parser.add_argument("--timeout", type=int, default=15)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/") + "/"
    paths = [path.strip() for path in args.paths.split(",") if path.strip()]
    results = [check_path(base_url, path, args.timeout) for path in paths]
    print(json.dumps({"base_url": args.base_url, "results": results}, indent=2, ensure_ascii=True))
    failed = [result for result in results if result["status"] != "passed"]
    return 1 if failed else 0


def check_path(base_url: str, path: str, timeout: int) -> dict:
    normalized_path = path.lstrip("/")
    url = urljoin(base_url, normalized_path)
    try:
        request = Request(url, headers={"User-Agent": "Loop-Smoke-Test/1.0"})
        with urlopen(request, timeout=timeout) as response:
            body = response.read(4096)
            status_code = response.status
    except HTTPError as exc:
        return {
            "path": path,
            "url": url,
            "status": "failed",
            "status_code": exc.code,
            "reason": "http_error",
        }
    except URLError as exc:
        return {
            "path": path,
            "url": url,
            "status": "failed",
            "status_code": None,
            "reason": str(exc.reason),
        }

    if status_code < 200 or status_code >= 400:
        return {
            "path": path,
            "url": url,
            "status": "failed",
            "status_code": status_code,
            "reason": "unexpected_status_code",
        }
    if not body:
        return {
            "path": path,
            "url": url,
            "status": "failed",
            "status_code": status_code,
            "reason": "empty_response",
        }
    return {
        "path": path,
        "url": url,
        "status": "passed",
        "status_code": status_code,
        "reason": "ok",
    }


if __name__ == "__main__":
    raise SystemExit(main())
