import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@repo/backend-common/config';
import { middleware } from './middleware';
import { CreateUserSchema , SigninSchema , CreateRoomSchema} from "@repo/common/types"
import { prismaClient } from "@repo/db/client" ;




const app = express();
app.use(express.json())

app.post("/signup",(req , res) => {

  const parsedData = CreateUserSchema.safeParse(req.body);

  if(!parsedData.success){
    return res.json({
      message : "Incoreect Inputs"
    })
  }
 try {
   prismaClient.user.create({
    data :{
      email    : parsedData.data?.username ,
      password : parsedData.data.password,
      name     : parsedData.data.name
    }
  })
  res.json({
    userId : 123
  }) 
 } catch(e){
    res.status(410).json({
      message : "email exist"
    })
  }
 })
app.post("/signin",(req , res) => {

  const data = SigninSchema.safeParse(req.body);
  if(!data.success){
    return res.json({
      message : "Incoreect Inputs"
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
    return res.json({
      message : "Incoreect Inputs"
    })
  }
  res.json({
    roomId : 1
  })

})

app.listen(3000, () => {
  console.log('HTTP server is running on port 3000');
});