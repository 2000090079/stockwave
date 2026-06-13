# inventory-service

A production-grade REST microservice for managing product inventory across **product / color / material / size** SKU combinations.

![CI](https://github.com/2000090079/nike-inventory-service/actions/workflows/ci.yml/badge.svg?branch=master)
![Tests](https://img.shields.io/badge/tests-18%20passing-brightgreen)
![Node](https://img.shields.io/badge/node-20.x-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)

---

## What it does

- Tracks stock levels for every SKU variant (product × color × material × size)
- Auto-computes stock status on every write — no manual flag toggling
- Admin-gated write endpoints protected by a secret key header
- Compound unique index enforces SKU uniqueness at the database level
- 18 integration tests, GitHub Actions CI, and a Render deploy config included

---

## Stock Status Logic

| Condition | Status |
|---|---|
| `quantity === 0` | `OUT_OF_STOCK` |
| `0 < quantity < lowStockThreshold` | `LOW_STOCK` |
| `quantity >= lowStockThreshold` | `IN_STOCK` |

Status is recomputed by a Mongoose `pre('save')` hook on every write. The default `lowStockThreshold` is `10` but can be configured per SKU.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 + TypeScript 5 |
| Framework | Express 4 |
| Database | MongoDB via Mongoose 8 |
| Testing | Jest + Supertest + mongodb-memory-server |
| CI | GitHub Actions |
| Deploy | Render (`render.yaml`) |

---

## Project Structure

```
inventory-service/
├── src/
│   ├── config/
│   │   └── db.ts                 # MongoDB connect/disconnect
│   ├── models/
│   │   └── inventory.model.ts    # Schema, indexes, pre-save hook
│   ├── services/
│   │   └── inventory.service.ts  # All DB queries + upsert logic
│   ├── middleware/
│   │   └── adminAuth.ts          # x-admin-key header guard
│   ├── routes/
│   │   └── inventory.routes.ts   # REST endpoints
│   ├── app.ts                    # Express app
│   └── server.ts                 # Entry point
├── tests/
│   ├── setup.ts                  # Spins up in-memory MongoDB
│   ├── teardown.ts
│   └── inventory.test.ts         # 18 integration tests
├── .github/
│   └── workflows/
│       └── ci.yml                # Type check → test → build
├── render.yaml                   # Render deploy config
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

### Local setup

```bash
git clone https://github.com/2000090079/nike-inventory-service.git
cd nike-inventory-service
npm install
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/inventory
ADMIN_KEY=your-secret-key
```

```bash
npm run dev
```

Server starts at `http://localhost:3000`.

### Run tests

Tests use an in-memory MongoDB — no external database required.

```bash
npm test
```

```
Test Suites: 1 passed, 1 total
Tests:       18 passed, 18 total
```

---

## API Reference

### Base URL

```
http://localhost:3000/api/v1/inventory
```

---

### Public Endpoints

#### `GET /health`

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "ts": "2025-06-13T10:00:00.000Z" }
```

---

#### `GET /api/v1/inventory`

List all inventory items. Supports optional filters.

| Query param | Type | Description |
|---|---|---|
| `status` | `IN_STOCK` \| `LOW_STOCK` \| `OUT_OF_STOCK` | Filter by stock status |
| `productId` | `string` | Filter by product style number |

```bash
# All items
curl http://localhost:3000/api/v1/inventory

# Only low stock
curl http://localhost:3000/api/v1/inventory?status=LOW_STOCK

# All variants of one product
curl http://localhost:3000/api/v1/inventory?productId=SKU-1001
```

**Response**

```json
{
  "count": 2,
  "items": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "productId": "SKU-1001",
      "color": "Black",
      "material": "Mesh",
      "size": "US 10",
      "quantity": 50,
      "lowStockThreshold": 10,
      "status": "IN_STOCK",
      "updatedBy": "warehouse-sync",
      "createdAt": "2025-06-13T09:00:00.000Z",
      "updatedAt": "2025-06-13T09:00:00.000Z"
    }
  ]
}
```

---

#### `GET /api/v1/inventory/product/:productId`

All size/color/material variants for a single product.

```bash
curl http://localhost:3000/api/v1/inventory/product/SKU-1001
```

---

#### `GET /api/v1/inventory/summary`

Aggregate stock counts grouped by status.

```bash
curl http://localhost:3000/api/v1/inventory/summary
```

```json
{
  "summary": [
    { "_id": "IN_STOCK",     "count": 142, "totalUnits": 8430 },
    { "_id": "LOW_STOCK",    "count": 27,  "totalUnits": 83   },
    { "_id": "OUT_OF_STOCK", "count": 11,  "totalUnits": 0    }
  ]
}
```

---

#### `GET /api/v1/inventory/:id`

Single item by MongoDB `_id`.

---

### Admin Endpoints

All admin endpoints require the `x-admin-key` header.

```
x-admin-key: your-secret-key
```

---

#### `POST /api/v1/inventory`

Create or update a SKU. If the `productId + color + material + size` combo already exists, the quantity is updated in place.

**Required fields:** `productId`, `color`, `material`, `size`, `quantity`

```bash
curl -X POST http://localhost:3000/api/v1/inventory \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-secret-key" \
  -d '{
    "productId": "SKU-1001",
    "color": "Black",
    "material": "Mesh",
    "size": "US 10",
    "quantity": 50,
    "lowStockThreshold": 10,
    "updatedBy": "warehouse-sync"
  }'
```

---

#### `PATCH /api/v1/inventory/:id/quantity`

Update quantity for a specific SKU. Status is recomputed automatically.

```bash
curl -X PATCH http://localhost:3000/api/v1/inventory/665f1a2b.../quantity \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-secret-key" \
  -d '{ "quantity": 3, "updatedBy": "warehouse-sync" }'
```

---

#### `DELETE /api/v1/inventory/:id`

Remove a SKU. Returns `204 No Content`.

```bash
curl -X DELETE http://localhost:3000/api/v1/inventory/665f1a2b... \
  -H "x-admin-key: your-secret-key"
```

---

## MongoDB Schema

**Collection:** `inventories`

**Unique compound index:** `{ productId, color, material, size }`

**Additional indexes:** `{ status }`, `{ productId }`

```ts
{
  productId:         string   // product style number e.g. "SKU-1001"
  color:             string   // e.g. "Midnight Black"
  material:          string   // e.g. "Mesh"
  size:              string   // e.g. "US 10"
  quantity:          number   // >= 0
  lowStockThreshold: number   // default 10
  status:            "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"
  updatedBy:         string
  createdAt:         Date
  updatedAt:         Date
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Server port |
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `ADMIN_KEY` | Yes | — | Secret key for `x-admin-key` header |

---

## Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service → connect the repo
3. Render auto-detects `render.yaml`
4. Set `MONGO_URI` in the Environment tab (use MongoDB Atlas)
5. `ADMIN_KEY` is auto-generated — copy it from the dashboard after deploy

---

## CI Pipeline

GitHub Actions runs on every push to `main` and every pull request:

1. Install dependencies
2. TypeScript type check (`tsc --noEmit`)
3. Run all 18 tests
4. Build to `dist/`
