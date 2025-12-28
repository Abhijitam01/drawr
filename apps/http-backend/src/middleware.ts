import { NextFunction, Request , Response} from "express"
import jwt  from "jsonwebtoken"
import { JWT_SECRET } from "@repo/backend-common/config"

export function middleware(req : Request , res : Response , Next :NextFunction ) {

    const token = req.headers["authorization"] ?? ""
    const decoded = jwt.verify(token , JWT_SECRET);

    if(typeof decoded === "object" && "userId" in decoded) {

        req.userId = decoded.userId ;
        Next();

    } else {
        res.status(403).json({
            message : "Unauthorised"
        })
    }
}