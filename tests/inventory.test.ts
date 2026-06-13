import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app";
import { connectDB, disconnectDB } from "../src/config/db";
import { Inventory } from "../src/models/inventory.model";

const ADMIN_KEY = "test-admin-key";
const adminHeaders = { "x-admin-key": ADMIN_KEY };

beforeAll(async () => {
  await connectDB(process.env.MONGO_URI!);
});

afterAll(async () => {
  await disconnectDB();
});

beforeEach(async () => {
  await Inventory.deleteMany({});
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("POST /api/v1/inventory", () => {
  it("creates a new inventory item with correct status", async () => {
    const res = await request(app)
      .post("/api/v1/inventory")
      .set(adminHeaders)
      .send({
        productId: "DQ4549-001",
        color: "Black",
        material: "Mesh",
        size: "US 10",
        quantity: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("IN_STOCK");
    expect(res.body.productId).toBe("DQ4549-001");
  });

  it("sets LOW_STOCK when quantity is below threshold", async () => {
    const res = await request(app)
      .post("/api/v1/inventory")
      .set(adminHeaders)
      .send({
        productId: "DQ4549-002",
        color: "White",
        material: "Leather",
        size: "US 9",
        quantity: 5,
        lowStockThreshold: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("LOW_STOCK");
  });

  it("sets OUT_OF_STOCK when quantity is zero", async () => {
    const res = await request(app)
      .post("/api/v1/inventory")
      .set(adminHeaders)
      .send({
        productId: "DQ4549-003",
        color: "Red",
        material: "Flyknit",
        size: "US 8",
        quantity: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("OUT_OF_STOCK");
  });

  it("rejects missing required fields", async () => {
    const res = await request(app)
      .post("/api/v1/inventory")
      .set(adminHeaders)
      .send({ productId: "DQ4549-001", color: "Black" });

    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/inventory")
      .send({ productId: "X", color: "Y", material: "Z", size: "S", quantity: 1 });

    expect(res.status).toBe(401);
  });

  it("rejects negative quantity", async () => {
    const res = await request(app)
      .post("/api/v1/inventory")
      .set(adminHeaders)
      .send({
        productId: "DQ4549-004",
        color: "Blue",
        material: "Mesh",
        size: "US 11",
        quantity: -5,
      });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/inventory/:id/quantity", () => {
  it("auto-downgrades status when quantity drops below threshold", async () => {
    const create = await request(app)
      .post("/api/v1/inventory")
      .set(adminHeaders)
      .send({
        productId: "FD2596-100",
        color: "Volt",
        material: "React Foam",
        size: "US 10.5",
        quantity: 30,
        lowStockThreshold: 10,
      });

    expect(create.body.status).toBe("IN_STOCK");
    const id = create.body._id;

    const update = await request(app)
      .patch(`/api/v1/inventory/${id}/quantity`)
      .set(adminHeaders)
      .send({ quantity: 7 });

    expect(update.status).toBe(200);
    expect(update.body.status).toBe("LOW_STOCK");
  });

  it("marks OUT_OF_STOCK when quantity reaches zero", async () => {
    const create = await request(app)
      .post("/api/v1/inventory")
      .set(adminHeaders)
      .send({
        productId: "FD2596-101",
        color: "Black",
        material: "React Foam",
        size: "US 9",
        quantity: 15,
      });

    const id = create.body._id;

    const update = await request(app)
      .patch(`/api/v1/inventory/${id}/quantity`)
      .set(adminHeaders)
      .send({ quantity: 0 });

    expect(update.body.status).toBe("OUT_OF_STOCK");
  });

  it("returns 404 for unknown id", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .patch(`/api/v1/inventory/${fakeId}/quantity`)
      .set(adminHeaders)
      .send({ quantity: 5 });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/inventory", () => {
  beforeEach(async () => {
    await request(app).post("/api/v1/inventory").set(adminHeaders).send({
      productId: "CW4555-001",
      color: "Black",
      material: "Mesh",
      size: "US 9",
      quantity: 25,
    });
    await request(app).post("/api/v1/inventory").set(adminHeaders).send({
      productId: "CW4555-002",
      color: "White",
      material: "Leather",
      size: "US 10",
      quantity: 3,
      lowStockThreshold: 10,
    });
    await request(app).post("/api/v1/inventory").set(adminHeaders).send({
      productId: "CW4555-003",
      color: "Red",
      material: "Flyknit",
      size: "US 11",
      quantity: 0,
    });
  });

  it("lists all inventory", async () => {
    const res = await request(app).get("/api/v1/inventory");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it("filters by status=LOW_STOCK", async () => {
    const res = await request(app).get("/api/v1/inventory?status=LOW_STOCK");
    expect(res.status).toBe(200);
    expect(res.body.items.every((i: any) => i.status === "LOW_STOCK")).toBe(true);
  });

  it("filters by status=OUT_OF_STOCK", async () => {
    const res = await request(app).get("/api/v1/inventory?status=OUT_OF_STOCK");
    expect(res.body.items.every((i: any) => i.status === "OUT_OF_STOCK")).toBe(true);
  });

  it("rejects invalid status filter", async () => {
    const res = await request(app).get("/api/v1/inventory?status=UNKNOWN");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/inventory/product/:productId", () => {
  it("returns all variants for a product", async () => {
    await request(app).post("/api/v1/inventory").set(adminHeaders).send({
      productId: "DD1391-100",
      color: "University Blue",
      material: "Suede",
      size: "US 8",
      quantity: 10,
    });
    await request(app).post("/api/v1/inventory").set(adminHeaders).send({
      productId: "DD1391-100",
      color: "University Blue",
      material: "Suede",
      size: "US 9",
      quantity: 5,
    });

    const res = await request(app).get("/api/v1/inventory/product/DD1391-100");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it("returns 404 for product with no inventory", async () => {
    const res = await request(app).get("/api/v1/inventory/product/DOESNOTEXIST");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/inventory/summary", () => {
  it("returns grouped stock summary", async () => {
    await request(app).post("/api/v1/inventory").set(adminHeaders).send({
      productId: "AA0001-001",
      color: "Black",
      material: "Mesh",
      size: "US 10",
      quantity: 20,
    });
    await request(app).post("/api/v1/inventory").set(adminHeaders).send({
      productId: "AA0002-001",
      color: "White",
      material: "Leather",
      size: "US 9",
      quantity: 0,
    });

    const res = await request(app).get("/api/v1/inventory/summary");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.summary)).toBe(true);
  });
});

describe("DELETE /api/v1/inventory/:id", () => {
  it("deletes an item", async () => {
    const create = await request(app)
      .post("/api/v1/inventory")
      .set(adminHeaders)
      .send({
        productId: "ZZ9999-001",
        color: "Grey",
        material: "Canvas",
        size: "US 12",
        quantity: 8,
      });

    const id = create.body._id;
    const del = await request(app)
      .delete(`/api/v1/inventory/${id}`)
      .set(adminHeaders);

    expect(del.status).toBe(204);

    const check = await request(app).get(`/api/v1/inventory/${id}`);
    expect(check.status).toBe(404);
  });
});
