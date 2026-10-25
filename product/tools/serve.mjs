// Local preview only: loopback binding, path traversal protection, no credentials.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../web/", import.meta.url));
const port = Number(process.env.NEXUS_PREVIEW_PORT || 4173);
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const name = decodeURIComponent(
        url.pathname === "/" ? "/demo.html" : url.pathname
      );
      const target = path.resolve(root, `.${name}`);
      if (
        !target.startsWith(root) ||
        ![".html", ".mjs"].includes(path.extname(target))
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(target);
      res.writeHead(200, {
        "Content-Type": target.endsWith(".mjs")
          ? "text/javascript; charset=utf-8"
          : "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    process.stdout.write(`Nexus demo: http://127.0.0.1:${port}/\n`)
  );
