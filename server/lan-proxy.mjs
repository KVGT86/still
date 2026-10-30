import http from "node:http";
import { isIP } from "node:net";
export function startLanProxy(address, port, targetPort = port) {
  if (isIP(address) !== 4 || address === "0.0.0.0")
    throw new Error("A specific LAN IPv4 address is required.");
  const server = http.createServer((req, res) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode || 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end("Still service unavailable");
    });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  });
  server.listen(port, address);
  return server;
}
