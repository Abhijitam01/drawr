import dotenv from "dotenv";
import path from "path";

// Load .env from project root
// Try multiple possible locations for .env file
const possibleEnvPaths = [
  path.resolve(process.cwd(), ".env"),           // Current directory
  path.resolve(process.cwd(), "../.env"),        // One level up
  path.resolve(process.cwd(), "../../.env"),     // Two levels up (project root)
  path.resolve(process.cwd(), "../../../.env"),   // Three levels up
];

// Try each path until one works
for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`Loaded .env from: ${envPath}`);
    break;
  }
}

import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@repo/backend-common/config';
import { middleware } from './middleware';
import { CreateUserSchema , SigninSchema , CreateRoomSchema} from "@repo/common/types"
import { prismaClient } from "@repo/db/client" ;




const app = express();
app.use(express.json())

// Debug: Log DATABASE_URL status on startup (without exposing the full URL)
if (process.env.DATABASE_URL) {
  console.log("✓ DATABASE_URL is set");
} else {
  console.error("✗ DATABASE_URL is NOT set - database operations will fail!");
}

app.post("/signup",async (req , res) => {

  const parsedData = CreateUserSchema.safeParse(req.body);

  if(!parsedData.success){
    return res.status(400).json({
      message : "Incorrect Inputs",
      errors: parsedData.error?.issues || []
    })
  }
 try {
  const user =  await  prismaClient.user.create({
    data :{
      email    : parsedData.data.username ,
      password : parsedData.data.password,
      name     : parsedData.data.name
    }
  })
  console.log("User created successfully:", user.id)
  res.json({
    userId : user.id
  }) 
 } catch(e: any){
    console.error("Signup error:", e);
    // Check if it's a unique constraint violation (email already exists)
    if (e.code === 'P2002' || e.message?.includes('Unique constraint')) {
      return res.status(409).json({
        message : "Email already exists"
      })
    }
    // Generic database error
    return res.status(500).json({
      message : "Database error",
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    })
  }
 })
app.post("/signin",(req , res) => {

  const data = SigninSchema.safeParse(req.body);
  if(!data.success){
    return res.status(400).json({
      message : "Incorrect Inputs"
    })
  }

  const userId = 1;
  const token = jwt.sign({
    userId
  } , JWT_SECRET) ;

  res.json({
    token
  })
})
app.post("/room", middleware , (req , res) => {

  const data = CreateRoomSchema.safeParse(req.body);
  if(!data.success){
    return res.status(400).json({
      message : "Incorrect Inputs"
    })
  }
  res.json({
    roomId : 1
  })

})

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`HTTP server is running on port ${PORT}`);
});