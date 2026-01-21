import Link from "next/link";

export default async function CanvasRoomPage({
  params,
}: {
  params: Promise<{ roomid: string }>;
}) {
  const { roomid } = await params;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Room</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            You’re viewing canvas room:{" "}
            <span className="font-mono">{roomid}</span>
          </p>
        </div>

        <Link
          href="/draw"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Open editor
        </Link>
      </div>

      <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="h-[520px] rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-black" />
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Replace this placeholder with your multiplayer canvas for this room.
        </p>
      </div>
    </div>
  );
}
