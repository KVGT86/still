import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app.mjs";
mkdirSync("data", { recursive: true });
const { app } = createApp({
  database: process.env.DATABASE || "data/still.sqlite",
});
app.use(express.static(resolve("dist")));
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 8787);
app.listen(port, host, () =>
  console.log(`Still profile service: http://${host}:${port}`),
);
