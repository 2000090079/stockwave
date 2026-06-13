import mongoose, { Document, Model, Schema } from "mongoose";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface IInventoryItem {
  productId: string;
  color: string;
  material: string;
  size: string;
  quantity: number;
  lowStockThreshold: number;
  status: StockStatus;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryDocument extends IInventoryItem, Document {
  recomputeStatus(): void;
}

const inventorySchema = new Schema<IInventoryDocument>(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    material: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    status: {
      type: String,
      enum: ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"],
      required: true,
      default: "OUT_OF_STOCK",
    },
    updatedBy: {
      type: String,
      required: true,
      default: "system",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inventorySchema.index({ productId: 1, color: 1, material: 1, size: 1 }, { unique: true });
inventorySchema.index({ status: 1 });
inventorySchema.index({ productId: 1 });

inventorySchema.methods.recomputeStatus = function (this: IInventoryDocument): void {
  if (this.quantity === 0) {
    this.status = "OUT_OF_STOCK";
  } else if (this.quantity < this.lowStockThreshold) {
    this.status = "LOW_STOCK";
  } else {
    this.status = "IN_STOCK";
  }
};

inventorySchema.pre("save", function (next) {
  this.recomputeStatus();
  next();
});

inventorySchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as Partial<IInventoryItem> | null;
  if (!update) return next();

  const qty = (update as any).quantity ?? (update as any).$set?.quantity;
  const threshold =
    (update as any).lowStockThreshold ?? (update as any).$set?.lowStockThreshold;

  if (qty !== undefined) {
    let status: StockStatus;
    const effectiveThreshold = threshold ?? 10;

    if (qty === 0) {
      status = "OUT_OF_STOCK";
    } else if (qty < effectiveThreshold) {
      status = "LOW_STOCK";
    } else {
      status = "IN_STOCK";
    }

    if ((update as any).$set) {
      (update as any).$set.status = status;
    } else {
      (update as any).status = status;
    }
  }

  next();
});

export const Inventory: Model<IInventoryDocument> = mongoose.model<IInventoryDocument>(
  "Inventory",
  inventorySchema
);
