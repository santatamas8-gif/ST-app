import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessages, getRoomMembers, getAvailableUsersToAdd, getLikesForRoom } from "@/app/actions/chat";
import { SendMessageForm } from "./SendMessageForm";
import { ChatRoomRealtime } from "./ChatRoomRealtime";
import { RoomMembersManager } from "./RoomMembersManager";
import { DeleteRoomButton } from "./DeleteRoomButton";
import { ChatMessageList } from "./ChatMessageList";
import { MarkRoomRead } from "./MarkRoomRead";

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
  const members = isAdmin ? await getRoomMembers(roomId) : [];
  const availableUsers = isAdmin ? await getAvailableUsersToAdd(roomId) : [];
  const likesByMessage = await getLikesForRoom(roomId);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 sm:h-[calc(100vh-6rem)]">
      <MarkRoomRead roomId={roomId} />
      <ChatRoomRealtime roomId={roomId} />
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <Link href="/chat" className="text-zinc-400 hover:text-white">
          ← Chat
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white">{room.name}</h1>
        {isAdmin && (
          <>
            <DeleteRoomButton roomId={roomId} />
            <RoomMembersManager
            roomId={roomId}
            members={members}
            availableUsers={availableUsers}
            currentUserId={user.id}
          />
          </>
        )}
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border"
        style={{
          backgroundColor: "var(--card-bg)",
          borderRadius: 12,
          borderColor: "var(--card-border)",
        }}
      >
        <ChatMessageList
          messages={messages}
          displayNameByUserId={displayNameByUserId}
          currentUserId={user.id}
          isAdmin={isAdmin}
          roomId={roomId}
          likesByMessage={likesByMessage}
        />
        <div className="shrink-0 p-4">
          <SendMessageForm roomId={roomId} />
        </div>
      </div>
    </div>
  );
}
