import { Router, Request, Response } from "express";
import { adminAuth } from "../middleware/adminAuth";
import * as svc from "../services/inventory.service";
import { StockStatus } from "../models/inventory.model";

const router = Router();

const VALID_STATUSES: StockStatus[] = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"];

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, productId } = req.query;

    if (status && !VALID_STATUSES.includes(status as StockStatus)) {
      res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
      return;
    }

    const items = await svc.listInventory({
      status: status as StockStatus | undefined,
      productId: productId as string | undefined,
    });

    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const summary = await svc.getStockSummary();
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: "Failed to get summary" });
  }
});

router.get("/product/:productId", async (req: Request, res: Response) => {
  try {
    const items = await svc.getByProductId(req.params.productId);
    if (!items.length) {
      res.status(404).json({ error: "No inventory found for this product" });
      return;
    }
    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch product inventory" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const item = await svc.getById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

router.post("/", adminAuth, async (req: Request, res: Response) => {
  try {
    const { productId, color, material, size, quantity, lowStockThreshold, updatedBy } =
      req.body;

    if (!productId || !color || !material || !size || quantity === undefined) {
      res.status(400).json({ error: "productId, color, material, size, quantity are required" });
      return;
    }

    if (typeof quantity !== "number" || quantity < 0) {
      res.status(400).json({ error: "quantity must be a non-negative number" });
      return;
    }

    const item = await svc.upsertItem({
      productId,
      color,
      material,
      size,
      quantity,
      lowStockThreshold,
      updatedBy: updatedBy || "admin",
    });

    res.status(201).json(item);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ error: "Duplicate entry for this product/color/material/size combo" });
      return;
    }
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

router.patch("/:id/quantity", adminAuth, async (req: Request, res: Response) => {
  try {
    const { quantity, updatedBy, lowStockThreshold } = req.body;

    if (quantity === undefined || typeof quantity !== "number" || quantity < 0) {
      res.status(400).json({ error: "quantity must be a non-negative number" });
      return;
    }

    const item = await svc.adjustQuantity(req.params.id, {
      quantity,
      updatedBy: updatedBy || "admin",
      lowStockThreshold,
    });

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to update quantity" });
  }
});

router.delete("/:id", adminAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await svc.deleteItem(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
