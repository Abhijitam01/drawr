import { WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

const WS_PORT = Number(process.env.WS_PORT) || 8080;
const wss = new WebSocketServer({ port: WS_PORT });

interface User {
  ws : WebSocket ,
  rooms : string[] ,
  userId : string
}

const users : User[] = [];

function checkUser(token : string) : string | null {
  const decoded = jwt.verify(token , JWT_SECRET);

  if(typeof decoded == "string"){
    return null ;
  }

  if(!decoded || !decoded.userId){
    return null ;
  }
  return decoded.userId
}

wss.on("connection", (ws , request) => {
  const url = request.url;
  if(!url) {
    return ;
  }

  const queryParams = new URLSearchParams(url.split('?')[1]);
  const token = queryParams.get('token') || "";
  const userId = checkUser(token) ;

  if(!userId) {
    ws.close()
  }


  ws.on("message", (message) => {
    ws.send(`Echo: ${message}`);
  });

  
});