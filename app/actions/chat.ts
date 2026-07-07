"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppUser, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ChatRoomRow, ChatMessageRow, ChatRoomMemberRow } from "@/lib/types";

/** Revalidate chat layout so sidebar (rooms list, last message, unread) refetches. Call from client after realtime events. */
export async function revalidateChatLayout(): Promise<void> {
  revalidatePath("/chat");
}

export async function getChatRooms(): Promise<ChatRoomRow[]> {
  const user = await getAppUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_rooms")
    .select("id, name, created_by, created_at")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as ChatRoomRow[];
}

export async function createChatRoom(name: string): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (!isAdmin(user.role)) return { error: "Only admin can create chat rooms." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Room name is required." };
  if (trimmed.length > 100) return { error: "Room name is too long." };

  const supabase = await createClient();
  const { data: room, error } = await supabase
    .from("chat_rooms")
    .insert({ name: trimmed, created_by: user.id })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!room) return { error: "Failed to create room." };

  await supabase.from("chat_room_members").insert({
    room_id: room.id,
    user_id: user.id,
  });
  revalidatePath("/chat");
  return {};
}

export async function getRoomMembers(roomId: string): Promise<{ user_id: string; email: string; full_name: string | null }[]> {
  const user = await getAppUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("chat_room_members")
    .select("user_id")
    .eq("room_id", roomId);

  if (error || !rows?.length) return [];

  const userIds = rows.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  if (!profiles) return [];
  return profiles.map((p) => ({
    user_id: p.id,
    email: p.email ?? "",
    full_name: (p as { full_name?: string | null }).full_name ?? null,
  }));
}

export async function getAvailableUsersToAdd(roomId: string): Promise<{ id: string; email: string; full_name: string | null }[]> {
  const user = await getAppUser();
  if (!user || !isAdmin(user.role)) return [];

  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from("chat_room_members")
    .select("user_id")
    .eq("room_id", roomId);
  const memberIds = new Set((memberRows ?? []).map((r) => r.user_id));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .order("email");
  if (!profiles) return [];

  return profiles
    .filter((p) => !memberIds.has(p.id))
    .map((p) => ({
      id: p.id,
      email: p.email ?? "",
      full_name: (p as { full_name?: string | null }).full_name ?? null,
    }));
}

export async function addRoomMember(roomId: string, userId: string): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (!isAdmin(user.role)) return { error: "Only admin can add members." };

  const supabase = await createClient();
  const { error } = await supabase.from("chat_room_members").insert({
    room_id: roomId,
    user_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/chat/${roomId}`);
  revalidatePath("/chat");
  return {};
}

export async function addRoomMembers(roomId: string, userIds: string[]): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (!isAdmin(user.role)) return { error: "Only admin can add members." };
  if (userIds.length === 0) return {};

  const supabase = await createClient();
  const rows = userIds.map((user_id) => ({ room_id: roomId, user_id }));
  const { error } = await supabase.from("chat_room_members").insert(rows);
  if (error) return { error: error.message };
  revalidatePath(`/chat/${roomId}`);
  revalidatePath("/chat");
  return {};
}

export async function removeRoomMember(roomId: string, userId: string): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (!isAdmin(user.role)) return { error: "Only admin can remove members." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath(`/chat/${roomId}`);
  revalidatePath("/chat");
  return {};
}

export async function getMessages(roomId: string): Promise<ChatMessageRow[]> {
  const user = await getAppUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, room_id, user_id, body, attachment_url, reply_to_message_id, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as ChatMessageRow[];
}

export async function sendMessage(
  roomId: string,
  body: string,
  attachmentUrl?: string | null,
  replyToMessageId?: string | null
): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = body.trim();
  if (!trimmed && !attachmentUrl) return { error: "Message or attachment is required." };
  if (trimmed.length > 4000) return { error: "Message is too long." };

  const supabase = await createClient();
  const { error } = await supabase.from("chat_messages").insert({
    room_id: roomId,
    user_id: user.id,
    body: trimmed || "",
    attachment_url: attachmentUrl ?? null,
    reply_to_message_id: replyToMessageId ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/chat/${roomId}`);
  return {};
}

export async function deleteChatRoom(roomId: string): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };
  if (!isAdmin(user.role)) return { error: "Only admin can delete rooms." };

  const supabase = await createClient();
  const { error } = await supabase.from("chat_rooms").delete().eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return {};
}

export async function deleteMessage(messageId: string, roomId: string): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const { data: message, error: fetchError } = await supabase
    .from("chat_messages")
    .select("user_id")
    .eq("id", messageId)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!message) return { error: "Message not found." };
  const isOwn = message.user_id === user.id;
  if (!isOwn && !isAdmin(user.role)) {
    return { error: "You can only delete your own messages." };
  }

  const { error } = await supabase.from("chat_messages").delete().eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath(`/chat/${roomId}`);
  return {};
}

export async function setLastRead(roomId: string): Promise<void> {
  const user = await getAppUser();
  if (!user) return;

  const supabase = await createClient();
  if (!isAdmin(user.role)) {
    const { data: member } = await supabase
      .from("chat_room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return;
  }

  await supabase.from("chat_room_reads").upsert(
    { user_id: user.id, room_id: roomId, last_read_at: new Date().toISOString() },
    { onConflict: "user_id,room_id" }
  );
}

async function getUnreadCountsByRoom(userId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("user_id", userId);
  const roomIds = (memberRows ?? []).map((r) => r.room_id);
  if (roomIds.length === 0) return {};

  const { data: readRows } = await supabase
    .from("chat_room_reads")
    .select("room_id, last_read_at")
    .eq("user_id", userId);
  const lastReadByRoom: Record<string, string> = {};
  for (const r of readRows ?? []) {
    lastReadByRoom[r.room_id] = r.last_read_at;
  }

  const entries = await Promise.all(
    roomIds.map(async (roomId) => {
      const last = lastReadByRoom[roomId] ?? "1970-01-01T00:00:00.000Z";
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .gt("created_at", last)
        .neq("user_id", userId);
      return [roomId, count ?? 0] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function getUnreadTotal(): Promise<number> {
  const user = await getAppUser();
  if (!user) return 0;
  const byRoom = await getUnreadCountsByRoom(user.id);
  return Object.values(byRoom).reduce((sum, n) => sum + n, 0);
}

/** Unread count per room id (for rooms the user is a member of). */
export async function getUnreadByRoom(): Promise<Record<string, number>> {
  const user = await getAppUser();
  if (!user) return {};
  return getUnreadCountsByRoom(user.id);
}

/** Last message (body snippet + created_at) per room id, for rooms the user is in. */
export async function getLastMessageByRoom(): Promise<
  Record<string, { body: string | null; created_at: string }>
> {
  const user = await getAppUser();
  if (!user) return {};

  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from("chat_room_members")
    .select("room_id")
    .eq("user_id", user.id);
  const roomIds = (memberRows ?? []).map((r) => r.room_id);
  if (roomIds.length === 0) return {};

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("room_id, body, created_at")
    .in("room_id", roomIds)
    .order("created_at", { ascending: false })
    .limit(300);

  const lastByRoom: Record<string, { body: string | null; created_at: string }> = {};
  for (const m of messages ?? []) {
    if (!lastByRoom[m.room_id])
      lastByRoom[m.room_id] = { body: m.body ?? null, created_at: m.created_at ?? "" };
  }
  return lastByRoom;
}

/** Last read timestamp for this user in the room (for initial scroll position). */
export async function getLastReadAt(roomId: string): Promise<string | null> {
  const user = await getAppUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_room_reads")
    .select("last_read_at")
    .eq("user_id", user.id)
    .eq("room_id", roomId)
    .maybeSingle();
  return data?.last_read_at ?? null;
}

export async function getLikesForRoom(roomId: string): Promise<Record<string, { count: number; userLiked: boolean }>> {
  const user = await getAppUser();
  if (!user) return {};

  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, message_likes(user_id)")
    .eq("room_id", roomId);

  const result: Record<string, { count: number; userLiked: boolean }> = {};
  for (const m of messages ?? []) {
    const likes = (m as { message_likes?: { user_id: string }[] }).message_likes ?? [];
    result[m.id] = {
      count: likes.length,
      userLiked: likes.some((l) => l.user_id === user.id),
    };
  }
  return result;
}

export async function toggleLike(messageId: string, roomId: string): Promise<{ error?: string }> {
  const user = await getAppUser();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("message_likes")
    .select("message_id")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("message_likes")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("message_likes").insert({ message_id: messageId, user_id: user.id });
    if (error) return { error: error.message };
  }
  revalidatePath(`/chat/${roomId}`);
  return {};
}
