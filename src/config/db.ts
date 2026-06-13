import mongoose from "mongoose";

let isConnected = false;

export async function connectDB(uri?: string): Promise<void> {
  if (isConnected) return;

  const mongoUri = uri || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is not defined");

  await mongoose.connect(mongoUri);
  isConnected = true;
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}
