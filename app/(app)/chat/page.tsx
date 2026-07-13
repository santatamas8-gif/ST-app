import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";

export default async function ChatPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");

  return (
    <div className="hidden flex-1 flex-col items-center justify-center px-6 py-12 text-center lg:flex">
      <MessageCircle
        className="mb-5 h-14 w-14 text-zinc-500"
        aria-hidden
      />
      <h2 className="text-base font-semibold text-zinc-200">
        Select a chat room
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-zinc-500">
        Choose a room from the sidebar to start chatting.
      </p>
    </div>
  );
}
