// Reuse the installed Stremio engine on localhost behind Tailscale Serve.
const http = require("node:http");
const listen = http.Server.prototype.listen;
const allowed = new Set(JSON.parse(process.env.STILL_ALLOWED_ORIGINS || "[]"));
http.Server.prototype.listen = function () {
  const emit = this.emit;
  this.emit = function (event, ...args) {
    if (event === "request") {
      const [req, res] = args;
      const origin = req.headers.origin;
      if (origin && !allowed.has(origin)) {
        res.writeHead(403);
        res.end();
        return true;
      }
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
        res.setHeader(
          "Access-Control-Expose-Headers",
          "Content-Length, Content-Range",
        );
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, HEAD, POST, OPTIONS",
        );
        delete req.headers.origin;
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return true;
      }
    }
    return emit.call(this, event, ...args);
  };
  return listen.call(this, 11470, "127.0.0.1");
};
require(process.argv[2]);
