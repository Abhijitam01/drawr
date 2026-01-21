import axios from "axios";
import { BACKEND_URL } from "../../config";
import { ChatRoom } from "../../../components/ChatRoom";

async function getRoomId(slug: string) {
  const response = axios.get(`${BACKEND_URL}/room/${slug}`);
  return (await response).data.room.id;
}

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const slug = (await params).slug;
  const roomId = await getRoomId(slug);

  return <ChatRoom id={roomId}></ChatRoom>;
}
