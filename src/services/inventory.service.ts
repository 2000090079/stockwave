import { Inventory, IInventoryItem, StockStatus } from "../models/inventory.model";
import { FilterQuery } from "mongoose";

export interface CreateItemPayload {
  productId: string;
  color: string;
  material: string;
  size: string;
  quantity: number;
  lowStockThreshold?: number;
  updatedBy: string;
}

export interface UpdateQuantityPayload {
  quantity: number;
  updatedBy: string;
  lowStockThreshold?: number;
}

export async function listInventory(filters: {
  status?: StockStatus;
  productId?: string;
}) {
  const query: FilterQuery<IInventoryItem> = {};
  if (filters.status) query.status = filters.status;
  if (filters.productId) query.productId = filters.productId.toUpperCase();

  return Inventory.find(query).sort({ productId: 1, color: 1, size: 1 }).lean();
}

export async function getByProductId(productId: string) {
  return Inventory.find({ productId: productId.toUpperCase() })
    .sort({ color: 1, size: 1 })
    .lean();
}

export async function getById(id: string) {
  return Inventory.findById(id).lean();
}

export async function upsertItem(payload: CreateItemPayload) {
  const filter = {
    productId: payload.productId.toUpperCase(),
    color: payload.color,
    material: payload.material,
    size: payload.size,
  };

  const existing = await Inventory.findOne(filter);

  if (existing) {
    existing.quantity = payload.quantity;
    existing.updatedBy = payload.updatedBy;
    if (payload.lowStockThreshold !== undefined) {
      existing.lowStockThreshold = payload.lowStockThreshold;
    }
    await existing.save();
    return existing;
  }

  const item = new Inventory({
    ...filter,
    quantity: payload.quantity,
    lowStockThreshold: payload.lowStockThreshold ?? 10,
    updatedBy: payload.updatedBy,
  });

  await item.save();
  return item;
}

export async function adjustQuantity(id: string, payload: UpdateQuantityPayload) {
  const item = await Inventory.findById(id);
  if (!item) return null;

  item.quantity = payload.quantity;
  item.updatedBy = payload.updatedBy;
  if (payload.lowStockThreshold !== undefined) {
    item.lowStockThreshold = payload.lowStockThreshold;
  }

  await item.save();
  return item;
}

export async function deleteItem(id: string) {
  return Inventory.findByIdAndDelete(id);
}

export async function getStockSummary() {
  return Inventory.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalUnits: { $sum: "$quantity" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}
