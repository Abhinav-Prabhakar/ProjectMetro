import base64
import http.server
import os
import socketserver
import urllib.parse

OUT = "/tmp/metro-shots"
os.makedirs(OUT, exist_ok=True)


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = q.get("name", ["shot"])[0]
        n = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(n).decode("latin-1").strip()
        ext = "png"
        if q.get("raw", ["0"])[0] == "1":
            raw = data.encode("latin-1")
            ext = q.get("ext", ["json"])[0]
        else:
            if "," in data[:64] and data.startswith("data:"):
                data = data.split(",", 1)[1]
            raw = base64.b64decode(data)
        path = os.path.join(OUT, f"{name}.{ext}")
        with open(path, "wb") as f:
            f.write(raw)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(str(len(raw)).encode())

    def log_message(self, *a):
        pass


with socketserver.ThreadingTCPServer(("127.0.0.1", 4410), Handler) as httpd:
    httpd.allow_reuse_address = True
    print("capture server on 4410", flush=True)
    httpd.serve_forever()
