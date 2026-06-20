import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const P = "/make-server-6ecbe82c";

app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

app.get(`${P}/health`, (c) => c.json({ status: "ok" }));

// ── Units ──────────────────────────────────────────────────────────────────────

app.get(`${P}/units`, async (c) => {
  try {
    const units = (await kv.get("fleet_units")) ?? [];
    return c.json(units);
  } catch {
    return c.json({ error: "Failed to fetch units" }, 500);
  }
});

app.post(`${P}/units`, async (c) => {
  try {
    const unit = await c.req.json();
    const units = (await kv.get("fleet_units")) ?? [];
    units.push(unit);
    await kv.set("fleet_units", units);
    return c.json(unit, 201);
  } catch {
    return c.json({ error: "Failed to create unit" }, 500);
  }
});

app.put(`${P}/units/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const updated = await c.req.json();
    const units = (await kv.get("fleet_units")) ?? [];
    const idx = units.findIndex((u: any) => u.id === id);
    if (idx === -1) return c.json({ error: "Not found" }, 404);
    units[idx] = { ...units[idx], ...updated };
    await kv.set("fleet_units", units);
    return c.json(units[idx]);
  } catch {
    return c.json({ error: "Failed to update unit" }, 500);
  }
});

app.delete(`${P}/units/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const [units, logs] = await Promise.all([
      kv.get("fleet_units").then((u: any) => u ?? []),
      kv.get("fleet_logs").then((l: any) => l ?? []),
    ]);
    await Promise.all([
      kv.set("fleet_units", units.filter((u: any) => u.id !== id)),
      kv.set("fleet_logs", logs.filter((l: any) => l.unitId !== id)),
    ]);
    return c.json({ deleted: id });
  } catch {
    return c.json({ error: "Failed to delete unit" }, 500);
  }
});

// ── Logs ───────────────────────────────────────────────────────────────────────

app.get(`${P}/logs`, async (c) => {
  try {
    const logs = (await kv.get("fleet_logs")) ?? [];
    return c.json(logs);
  } catch {
    return c.json({ error: "Failed to fetch logs" }, 500);
  }
});

app.post(`${P}/logs`, async (c) => {
  try {
    const log = await c.req.json();
    const logs = (await kv.get("fleet_logs")) ?? [];
    logs.unshift(log);
    await kv.set("fleet_logs", logs);
    return c.json(log, 201);
  } catch {
    return c.json({ error: "Failed to create log" }, 500);
  }
});

app.delete(`${P}/logs/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const logs = (await kv.get("fleet_logs")) ?? [];
    await kv.set("fleet_logs", logs.filter((l: any) => l.id !== id));
    return c.json({ deleted: id });
  } catch {
    return c.json({ error: "Failed to delete log" }, 500);
  }
});

Deno.serve(app.fetch);
