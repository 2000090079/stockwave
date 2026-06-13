import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/db";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`inventory-service running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
