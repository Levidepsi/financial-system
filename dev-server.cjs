const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { buildApp } = require("./scripts/build.cjs");
const { createHandler } = require("./server/api.cjs");

const root = path.join(__dirname, "dist");
const api = createHandler();
const port = Number(process.env.PORT) || 5500;
const host = "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const server = http.createServer((request, response) => {
  if (new URL(request.url, `http://${host}`).pathname.startsWith("/api/")) {
    void api(request, response);
    return;
  }
  let requestPath;
  try { requestPath = decodeURIComponent(new URL(request.url, `http://${host}`).pathname); }
  catch { response.writeHead(400).end("Invalid URL"); return; }
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

buildApp().then(() => server.listen(port, host, () => {
  console.log(`Expense tracker running at http://${host}:${port}`);
})).catch((error) => { console.error(error); process.exitCode = 1; });
