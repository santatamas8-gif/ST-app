import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getChatRooms, getUnreadByRoom, getLastMessageByRoom } from "@/app/actions/chat";
import { CreateChatRoomForm } from "./CreateChatRoomForm";

function getRoomDateLabel(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const key = (x: Date) => x.toISOString().slice(0, 10);
  if (key(d) === key(today)) return "Today";
  if (key(d) === key(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  return getRoomDateLabel(iso);
}

export default async function ChatPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const [rooms, unreadByRoom, lastMessageByRoom] = await Promise.all([
    getChatRooms(),
    getUnreadByRoom(),
    getLastMessageByRoom(),
  ]);
  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6">
      <header
        className="rounded-xl border px-4 py-4 sm:px-6 sm:py-5"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Chat</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {isAdmin
                ? "Create rooms and talk with the team. Only you can add new rooms."
                : "Open a room to send and read messages."}
            </p>
          </div>
          {isAdmin && <CreateChatRoomForm />}
        </div>
      </header>

      <div
        className="rounded-xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <h2 className="mb-5 text-lg font-semibold text-white">Rooms</h2>
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-zinc-400">
              No rooms yet.{isAdmin ? " Create one above." : ""}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rooms.map((room) => {
              const unread = unreadByRoom[room.id] ?? 0;
              const last = lastMessageByRoom[room.id];
              const preview = last?.body?.trim()
                ? last.body.length > 60
                  ? last.body.slice(0, 60) + "…"
                  : last.body
                : last
                  ? "Attachment"
                  : null;
              return (
                <li key={room.id}>
                  <Link
                    href={`/chat/${room.id}`}
                    className={`flex items-center justify-between gap-2 rounded-lg border border-[var(--card-border)] border-l-4 px-4 py-3.5 transition hover:border-l-emerald-500 hover:bg-white/5 ${
                      unread > 0
                        ? "border-l-emerald-500/80 bg-emerald-500/10"
                        : "border-l-emerald-500/50 bg-white/[0.02]"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 flex-shrink-0 text-emerald-500/80" aria-hidden />
                        <span className="truncate font-medium text-white">{room.name}</span>
                      </span>
                      {preview !== null && (
                        <span className="truncate pl-7 text-xs text-zinc-500">
                          {preview}
                          {last?.created_at && (
                            <span className="ml-1 text-zinc-600">
                              · {getRelativeTime(last.created_at)}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      {unread > 0 && (
                        <span
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white"
                          title={`${unread} unread`}
                        >
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                      {room.created_at && !last && (
                        <span className="text-xs text-zinc-500">
                          {getRoomDateLabel(room.created_at)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
