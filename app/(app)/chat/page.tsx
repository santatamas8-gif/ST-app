import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getChatRooms } from "@/app/actions/chat";
import { CreateChatRoomForm } from "./CreateChatRoomForm";

export default async function ChatPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const rooms = await getChatRooms();
  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Chat</h1>
          <p className="mt-1 text-zinc-400">
            {isAdmin
              ? "Create rooms and talk with the team. Only you can add new rooms."
              : "Open a room to send and read messages."}
          </p>
        </div>
        {isAdmin && <CreateChatRoomForm />}
      </div>

      <div
        className="rounded-xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--card-bg)",
          borderRadius: 12,
          borderColor: "var(--card-border)",
        }}
      >
        <h2 className="mb-4 text-lg font-semibold text-white">Rooms</h2>
        {rooms.length === 0 ? (
          <p className="text-zinc-400">No chat rooms yet.{isAdmin ? " Create one above." : ""}</p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/chat/${room.id}`}
                  className="block rounded-lg border px-4 py-3 transition hover:bg-white/5"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <span className="font-medium text-white">{room.name}</span>
                  {room.created_at && (
                    <span className="ml-2 text-xs text-zinc-500">
                      {new Date(room.created_at).toLocaleDateString()}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
