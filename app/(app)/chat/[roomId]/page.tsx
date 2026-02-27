import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessages, getRoomMembers, getAvailableUsersToAdd, getLikesForRoom, getLastReadAt } from "@/app/actions/chat";
import { SendMessageForm } from "./SendMessageForm";
import { ChatRoomRealtime } from "./ChatRoomRealtime";
import { RoomMembersManager } from "./RoomMembersManager";
import { DeleteRoomButton } from "./DeleteRoomButton";
import { ChatMessageList } from "./ChatMessageList";
import { MarkRoomRead } from "./MarkRoomRead";
import { ReplyProvider } from "./ReplyContext";

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");

  const { roomId } = await params;
  const supabase = await createClient();
  const { data: room, error } = await supabase
    .from("chat_rooms")
    .select("id, name")
    .eq("id", roomId)
    .single();

  if (error || !room) {
    return (
      <div className="space-y-6">
        <p className="text-red-400">Room not found.</p>
        <Link href="/chat" className="text-emerald-400 hover:underline">
          ← Back to Chat
        </Link>
      </div>
    );
  }

  const messages = await getMessages(roomId);
  const userIds = [...new Set(messages.map((m) => m.user_id))];
  let displayNameByUserId: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    if (profiles) {
      for (const p of profiles) {
        const name = (p as { full_name?: string | null }).full_name;
        const email = p.email ?? "—";
        displayNameByUserId[p.id] =
          name && typeof name === "string" && name.trim() ? name.trim() : email;
      }
    }
  }

  const isAdmin = user.role === "admin";
  const [membersList, availableUsersList, likesByMessage, lastReadAt] = await Promise.all([
    isAdmin ? getRoomMembers(roomId) : Promise.resolve([]),
    isAdmin ? getAvailableUsersToAdd(roomId) : Promise.resolve([]),
    getLikesForRoom(roomId),
    getLastReadAt(roomId),
  ]);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 sm:h-[calc(100vh-6rem)]">
      <MarkRoomRead roomId={roomId} />
      <ChatRoomRealtime roomId={roomId} />
      <header
        className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border px-4 py-3 sm:gap-4 sm:px-5 sm:py-3"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <Link
          href="/chat"
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
          aria-label="Back to chat list"
        >
          ← Chat
        </Link>
        <span className="hidden text-zinc-600 sm:inline" aria-hidden>|</span>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
          {room.name}
        </h1>
        {isAdmin && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <RoomMembersManager
              roomId={roomId}
              members={membersList}
              availableUsers={availableUsersList}
              currentUserId={user.id}
            />
            <DeleteRoomButton roomId={roomId} />
          </div>
        )}
      </header>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border"
        style={{
          backgroundColor: "var(--card-bg)",
          borderRadius: 12,
          borderColor: "var(--card-border)",
        }}
      >
        <ReplyProvider>
          <ChatMessageList
            messages={messages}
            displayNameByUserId={displayNameByUserId}
            currentUserId={user.id}
            isAdmin={isAdmin}
            roomId={roomId}
            likesByMessage={likesByMessage}
            lastReadAt={lastReadAt}
          />
          <div className="shrink-0 p-4">
            <SendMessageForm roomId={roomId} />
          </div>
        </ReplyProvider>
      </div>
    </div>
  );
}
