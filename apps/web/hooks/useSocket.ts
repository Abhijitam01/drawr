import { useEffect, useState } from "react";
import { WS_URL } from "../app/config";

export function useSocket() {
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState<WebSocket>();

    useEffect(() => {
       const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
       if (!token) {
         setLoading(false);
         return;
       }
       const ws = new WebSocket(`${WS_URL}?token=${token}`);
       ws.onopen = () => {
        setLoading(false);
        setSocket(ws)
       }

    }, []);

    return {
        socket , 
        loading
    }
}