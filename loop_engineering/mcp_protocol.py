from __future__ import annotations

import json
import subprocess
import threading
from typing import Any


class MCPProtocolError(RuntimeError):
    pass


class MCPStdioClient:
    def __init__(self, command: list[str], timeout_seconds: int = 30, env: dict[str, str] | None = None) -> None:
        if not command:
            raise MCPProtocolError("MCP server command is required")
        self.command = command
        self.timeout_seconds = timeout_seconds
        self._next_id = 1
        self.process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )

    def initialize(self) -> dict[str, Any]:
        response = self.request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "loop-engineering", "version": "v1"},
            },
        )
        self.notify("notifications/initialized", {})
        return response

    def list_tools(self) -> dict[str, Any]:
        return self.request("tools/list", {})

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        return self.request("tools/call", {"name": name, "arguments": arguments or {}})

    def request(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        request_id = self._next_id
        self._next_id += 1
        self._write_message({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        while True:
            message = self._read_message()
            if message.get("id") != request_id:
                continue
            if "error" in message:
                raise MCPProtocolError(json.dumps(message["error"], ensure_ascii=True))
            return message.get("result", {})

    def notify(self, method: str, params: dict[str, Any]) -> None:
        self._write_message({"jsonrpc": "2.0", "method": method, "params": params})

    def close(self) -> None:
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
        for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
            if stream and not stream.closed:
                stream.close()

    def stderr(self) -> str:
        if not self.process.stderr:
            return ""
        output: list[bytes] = []

        def drain() -> None:
            chunk = self.process.stderr.read()
            if chunk:
                output.append(chunk)

        thread = threading.Thread(target=drain, daemon=True)
        thread.start()
        thread.join(timeout=0.1)
        return b"".join(output).decode("utf-8", errors="replace").strip()

    def _write_message(self, payload: dict[str, Any]) -> None:
        if not self.process.stdin:
            raise MCPProtocolError("MCP stdin is closed")
        body = json.dumps(payload, ensure_ascii=True).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
        self.process.stdin.write(header + body)
        self.process.stdin.flush()

    def _read_message(self) -> dict[str, Any]:
        if not self.process.stdout:
            raise MCPProtocolError("MCP stdout is closed")
        content_length = None
        while True:
            line = self.process.stdout.readline()
            if not line:
                raise MCPProtocolError("MCP server closed stdout")
            if line in {b"\r\n", b"\n"}:
                break
            key, _, value = line.decode("ascii", errors="replace").partition(":")
            if key.lower() == "content-length":
                content_length = int(value.strip())
        if content_length is None:
            raise MCPProtocolError("MCP message missing Content-Length")
        body = self.process.stdout.read(content_length)
        if len(body) != content_length:
            raise MCPProtocolError("MCP message body was truncated")
        return json.loads(body.decode("utf-8"))
