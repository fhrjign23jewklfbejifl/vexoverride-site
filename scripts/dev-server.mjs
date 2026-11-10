// Local static preview. Production remains a static site with no Node runtime.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = decodeURIComponent(url.pathname);
    if (
      path.split("/").some((p) => p.startsWith(".")) ||
      !["GET", "HEAD"].includes(req.method)
    ) {
      res.writeHead(403).end();
      return;
    }
    let file = resolve(root, "." + path);
    if (
      file !== resolve(root) &&
      !file.startsWith(root.endsWith(sep) ? root : root + sep)
    ) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) {
      if (!path.endsWith("/")) {
        res.writeHead(302, { Location: path + "/" + url.search }).end();
        return;
      }
      file = resolve(file, "index.html");
    }
    const type = types[extname(file)];
    if (!type) {
      res.writeHead(404).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
const arg = (key) => {
  const i = process.argv.indexOf(key);
  return i < 0 ? undefined : process.argv[i + 1];
};
server.listen(
  Number(arg("--port") || process.env.PORT || 3000),
  arg("--host") || "127.0.0.1",
  () => console.log("Static preview ready on port " + server.address().port),
);
