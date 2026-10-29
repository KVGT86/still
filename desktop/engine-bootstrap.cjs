// Adapt the unmodified upstream engine to a private, app-owned HTTP listener.
const http = require("node:http");
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (_port) {
  this.prependListener("request", (req, res) => {
    const origin = req.headers.origin;
    if (origin === "still://app") {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Length, Content-Range",
      );
    }
  });
  // Upstream has a request listener already. Do not dispatch rejected/preflight requests.
  const emit = this.emit;
  this.emit = function (event, ...args) {
    if (event === "request") {
      const [req, res] = args;
      const origin = req.headers.origin;
      if (origin && origin !== "still://app") {
        res.writeHead(403);
        res.end();
        return true;
      }
      if (origin === "still://app" && req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "Range, Content-Type",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        });
        res.end();
        return true;
      }
    }
    return emit.call(this, event, ...args);
  };
  this.once("listening", () => {
    process.stdout.write(
      `STILL_ENGINE_URL=http://127.0.0.1:${this.address().port}\n`,
    );
  });
  return listen.call(this, 0, "127.0.0.1");
};
// The engine must not survive a crashed or force-quit desktop parent.
const parent = process.ppid;
setInterval(() => {
  try {
    process.kill(parent, 0);
  } catch {
    process.kill(-process.pid, "SIGTERM");
  }
}, 2000).unref();
require(process.argv[2]);
