import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessages, getRoomMembers, getAvailableUsersToAdd, getLikesForRoom, getLastReadAt } from "@/app/actions/chat";
import { getTeamSettings } from "@/app/actions/teamSettings";
import { ChatRoomRealtime } from "./ChatRoomRealtime";
import { ReplyProvider } from "./ReplyContext";
import { MarkRoomRead } from "./MarkRoomRead";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";

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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-red-400">Room not found.</p>
        <Link href="/chat" className="text-emerald-400 hover:underline">
          ← Back to Chat
        </Link>
      </div>
    );
  }

  const messages = await getMessages(roomId);
  let displayNameByUserId: Record<string, string> = {};
  const { data: nameRows } = await supabase.rpc("get_chat_room_display_names", {
    p_room_id: roomId,
  });
  if (nameRows && Array.isArray(nameRows)) {
    for (const row of nameRows) {
      const id = (row as { user_id?: string }).user_id;
      const fullName = (row as { full_name?: string | null }).full_name;
      const email = (row as { email?: string | null }).email ?? "—";
      if (id) {
        displayNameByUserId[id] =
          fullName && typeof fullName === "string" && fullName.trim()
            ? fullName.trim()
            : email;
      }
    }
  }

  const isAdmin = user.role === "admin";
  const [membersList, availableUsersList, likesByMessage, lastReadAt, teamSettings] = await Promise.all([
    isAdmin ? getRoomMembers(roomId) : Promise.resolve([]),
    isAdmin ? getAvailableUsersToAdd(roomId) : Promise.resolve([]),
    getLikesForRoom(roomId),
    getLastReadAt(roomId),
    getTeamSettings(),
  ]);

  return (
    <>
      <MarkRoomRead roomId={roomId} />
      <ChatRoomRealtime roomId={roomId} />
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 lg:rounded-xl lg:border"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col w-full min-w-0 lg:max-w-[960px] lg:mx-auto">
          <ChatHeader
            roomName={room.name}
            membersCount={membersList.length}
            isAdmin={isAdmin}
            roomId={roomId}
            members={membersList}
            availableUsers={availableUsersList}
            currentUserId={user.id}
            teamLogoUrl={teamSettings?.team_logo_url ?? null}
          />
          <ReplyProvider>
            <MessageList
              messages={messages}
              displayNameByUserId={displayNameByUserId}
              currentUserId={user.id}
              isAdmin={isAdmin}
              roomId={roomId}
              likesByMessage={likesByMessage}
              lastReadAt={lastReadAt}
            />
            <MessageInput roomId={roomId} />
          </ReplyProvider>
        </div>
      </div>
    </>
  );
}
