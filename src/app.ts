import express from "express";
import inventoryRoutes from "./routes/inventory.routes";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

app.use("/api/v1/inventory", inventoryRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
