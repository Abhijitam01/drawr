import dotenv from "dotenv";
import path, { parse } from "path";


!dotenv.config({ path: path.resolve(process.cwd(), '../../.env') }).error &&
console.log(`Loaded .env from: ${path.resolve(process.cwd(), '../../.env')}`);


import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@repo/backend-common/config';
import { middleware } from './middleware';
import { CreateUserSchema , SigninSchema , CreateRoomSchema} from "@repo/common/types"
import { prismaClient } from "@repo/db/client" ;

const app = express();
app.use(express.json())

                                                                                                                                              
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
    if (e.code === 'P2002' || e.message?.includes('Unique constraint')) {
      return res.status(409).json({
        message : "Email already exists"
      })
    }
    return res.status(500).json({
      message : "Database error",
      error: process.env.NODE_ENV === 'development' ? e.message : undefined
    })
  }
 })
app.post("/signin",async (req , res) => {

  const parsedData = SigninSchema.safeParse(req.body);
  if(!parsedData.success){
    return res.status(400).json({
      message : "Incorrect Inputs"
    })
  }

  const user = await prismaClient.user.findFirst({
    where:{
      email : parsedData.data?.username ,
      password : parsedData.data?.password
    }
  })

  if (!user) {
    res.status(403).json({
      message : "not authorised"
    })
    return ;
  }
  const token = jwt.sign({
    userId : user?.id
  } , JWT_SECRET) ;

  res.json({
    token
  })
})
app.post("/room", middleware ,async  (req , res) => {

  const parsedData = CreateRoomSchema.safeParse(req.body);
  if(!parsedData.success){
    return res.status(400).json({
      message : "Incorrect Inputs"
    })
    return 
  }

  const userId = req.userId ;
  
  try {

  const room = await prismaClient.room.create({
    data : {
      slug : parsedData.data.name ,
      adminId : userId
    }
  })
  res.json({
    roomId : room.id
  })
  } catch(e) {
    res.status(411).json({
      message : "room exist with this endpoint"
        })
  }

})

app.get("/chats/:roomId" ,async  (req , res) => {
  const roomId = parseInt(req.params.roomId) ;
  const messages = await prismaClient.chat.findMany({
    where : {
      roomId: roomId
    },
    orderBy : {
      id:"desc"

    } ,
    take : 50
  }) ;

  res.json({
    messages
  })
})

app.get("/room/:slug" ,async  (req , res) => {
  const slug = req.params.slug ;
  const room = await prismaClient.room.findFirst({
    where : {
      slug
    }
  }) ;

  res.json({
    room
  })
})

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`HTTP server is running on port ${PORT}`);
});