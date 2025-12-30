import { WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

// Prefer configurable port to avoid EADDRINUSE conflicts
// Default to 8090 to avoid common system ports (8080/8081 often used)
const WS_PORT = Number(process.env.WS_PORT) || 8080;

const wss = new WebSocketServer({ port: WS_PORT });
console.log(`WebSocket server started on ws://localhost:${WS_PORT}`);

wss.on("connection", (ws , request) => {
  const url = request.url;
  if(!url) {
    return ;
  }

  const queryParams = new URLSearchParams(url.split('?')[1]);
  const token = queryParams.get('token') ;

  if(!token){
    ws.close();
    return  ;
  }

  let decoded: JwtPayload;

  try { 
    decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    ws.close();
    return;
  }

  if (!decoded.userId) {
    ws.close();
    return;
  }


  ws.on("message", (message) => {
    ws.send(`Echo: ${message}`);
  });

  
});