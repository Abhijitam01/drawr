import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

export function middleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["authorization"] ?? "";
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "object" && "userId" in decoded) {
      req.userId = decoded.userId;
      next();
    } else {
      res.status(403).json({ message: "Unauthorized" });
    }
  } catch {
    res.status(403).json({ message: "Unauthorized" });
  }
}
