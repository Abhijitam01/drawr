"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import axios from "axios";
import { HTTP_BACKEND } from "@/config";
import { Plus, Folder, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";

interface Room {
  id: number;
  slug: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, token, logout, loading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomSlug, setNewRoomSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${HTTP_BACKEND}/rooms`, {
        headers: { Authorization: token },
      });
      setRooms(res.data.rooms || []);
    } catch (error) {
      console.error("Failed to fetch rooms", error);
    }
  }, [token]);

  useEffect(() => {
    if (!loading && !token) {
      router.push("/signin");
    }
  }, [token, loading, router]);

  useEffect(() => {
    if (token) {
      fetchRooms();
    }
  }, [token, fetchRooms]);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomSlug) return;
    setIsCreating(true);
    try {
      const res = await axios.post(
        `${HTTP_BACKEND}/room`,
        { name: newRoomSlug },
        { headers: { Authorization: token } }
      );
      setRooms((prev) => [...prev, res.data]);
      setNewRoomSlug("");
      router.push(`/draw?roomId=${res.data.id}`);
    } catch (error) {
      console.error("Failed to create room", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading || !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121212] text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
              <span className="text-xl font-bold text-zinc-900">E</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Excalidraw</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5">
              <UserIcon className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium">{user?.name}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold">My Rooms</h1>
            <p className="mt-1 text-zinc-400">
              Manage your collaborative drawing spaces
            </p>
          </div>
          <form onSubmit={createRoom} className="flex gap-2">
            <input
              type="text"
              value={newRoomSlug}
              onChange={(e) => setNewRoomSlug(e.target.value)}
              placeholder="Room name (e.slug)"
              className="w-64 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-50/20"
              required
            />
            <button
              type="submit"
              disabled={isCreating}
              className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {isCreating ? "Creating..." : "New Room"}
            </button>
          </form>
        </div>

        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 py-24">
            <Folder className="mb-4 h-12 w-12 text-zinc-700" />
            <p className="font-medium text-zinc-500">
              No rooms found. Create your first one!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/draw?roomId=${room.id}`}
                className="group relative flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900/60"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 transition-transform group-hover:scale-110">
                  <Folder className="h-5 w-5 text-zinc-400" />
                </div>
                <h3 className="text-lg font-bold group-hover:text-white">
                  {room.slug}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Created {new Date(room.createdAt).toLocaleDateString()}
                </p>
                <div className="absolute top-6 right-6 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100">
                    <Plus className="h-4 w-4 rotate-45 text-zinc-900" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
