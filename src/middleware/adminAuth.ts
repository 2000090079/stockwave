import { Request, Response, NextFunction } from "express";

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-key"];

  if (!process.env.ADMIN_KEY) {
    res.status(500).json({ error: "ADMIN_KEY not configured on server" });
    return;
  }

  if (!token || token !== process.env.ADMIN_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
