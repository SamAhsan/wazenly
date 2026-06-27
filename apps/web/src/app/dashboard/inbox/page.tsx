"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Search, Send, MessageSquare, Check, CheckCheck, Phone, Filter,
  MoreVertical, User, PaperclipIcon, Smile, X, StickyNote,
} from "lucide-react";
import api from "@/lib/api";
import { formatRelativeTime, getInitials, cn } from "@/lib/utils";

let socket: Socket | null = null;

function MessageBubble({ msg }: { msg: { id: string; direction: string; type: string; body?: string; status: string; timestamp: string; mediaUrl?: string } }) {
  const isOut = msg.direction === "OUTBOUND";
  return (
    <div className={cn("flex mb-3", isOut ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm", isOut ? "bg-primary text-white rounded-br-sm" : "bg-white text-gray-900 rounded-bl-sm border border-gray-100")}>
        {msg.body && <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>}
        {msg.mediaUrl && <div className="text-xs opacity-70 mt-1">[{msg.type} attachment]</div>}
        <div className={cn("flex items-center gap-1 mt-1 justify-end", isOut ? "text-white/70" : "text-gray-400")}>
          <span className="text-[10px]">{new Date(msg.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</span>
          {isOut && (
            msg.status === "READ" ? <CheckCheck className="w-3 h-3 text-blue-300" /> :
            msg.status === "DELIVERED" ? <CheckCheck className="w-3 h-3" /> :
            <Check className="w-3 h-3" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [search, setSearch] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Socket setup
  useEffect(() => {
    if (!session?.accessToken) return;
    socket = io(process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:4000", {
      auth: { token: session.accessToken },
    });
    socket.on("message:new", () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
    });
    socket.on("message:status", () => {
      if (selectedId) queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
    });
    return () => { socket?.disconnect(); socket = null; };
  }, [session?.accessToken, selectedId, queryClient]);

  const { data: convData } = useQuery({
    queryKey: ["conversations", statusFilter, search],
    queryFn: () => api.get("/conversations", { params: { status: statusFilter !== "ALL" ? statusFilter : undefined, q: search || undefined } }).then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: conversation } = useQuery({
    queryKey: ["conversation", selectedId],
    queryFn: () => api.get(`/conversations/${selectedId}`).then((r) => r.data),
    enabled: !!selectedId,
  });

  const { data: msgData } = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: () => api.get(`/conversations/${selectedId}/messages`).then((r) => r.data),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgData]);

  const sendMutation = useMutation({
    mutationFn: () => api.post("/messages/send", { conversationId: selectedId, type: "TEXT", body: messageText }),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
    },
    onError: () => toast.error("Failed to send message"),
  });

  const resolveMutation = useMutation({
    mutationFn: () => api.post(`/conversations/${selectedId}/resolve`),
    onSuccess: () => { toast.success("Conversation resolved"); queryClient.invalidateQueries({ queryKey: ["conversations"] }); setSelectedId(null); },
  });

  const noteMutation = useMutation({
    mutationFn: () => api.post(`/conversations/${selectedId}/notes`, { body: noteText }),
    onSuccess: () => { toast.success("Note added"); setNoteText(""); setShowNote(false); queryClient.invalidateQueries({ queryKey: ["messages", selectedId] }); },
  });

  const conversations = convData?.data || [];
  const messages = msgData?.data || [];
  const selectedConvo = conversations.find((c: { id: string }) => c.id === selectedId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversations list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">Inbox</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex gap-1.5 mt-3">
            {["ALL", "OPEN", "RESOLVED", "BOT"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium", statusFilter === s ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">No conversations</div>
          )}
          {conversations.map((c: { id: string; contactName: string; phone: string; unreadCount: number; lastMessageAt: string; status: string; messages?: { body?: string; type: string }[] }) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={cn("w-full text-left px-4 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors", selectedId === c.id && "bg-primary/5 border-l-2 border-l-primary")}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-semibold flex-shrink-0">
                  {getInitials(c.contactName || c.phone)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.contactName || c.phone}</p>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatRelativeTime(c.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{c.messages?.[0]?.body || c.messages?.[0]?.type || "No messages"}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="w-5 h-5 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0">
                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat view */}
      {selectedId ? (
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {/* Chat header */}
          <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-semibold">
                {getInitials(conversation?.contactName || conversation?.phone || "?")}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{conversation?.contactName || conversation?.phone}</p>
                <p className="text-xs text-gray-400 font-mono">{conversation?.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowNote(!showNote)} className={cn("p-2 rounded-lg transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100", showNote && "bg-yellow-50 text-yellow-600")}>
                <StickyNote className="w-4 h-4" />
              </button>
              <button onClick={() => resolveMutation.mutate()} disabled={conversation?.status === "RESOLVED"} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> Resolve
              </button>
            </div>
          </div>

          {/* Note input */}
          {showNote && (
            <div className="bg-yellow-50 border-b border-yellow-200 px-5 py-3 flex gap-2">
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add an internal note..." rows={2} className="flex-1 px-3 py-2 border border-yellow-200 rounded-lg text-sm bg-white resize-none focus:outline-none" />
              <div className="flex flex-col gap-1">
                <button onClick={() => noteMutation.mutate()} disabled={!noteText} className="px-3 py-2 bg-yellow-500 text-white rounded-lg text-xs hover:bg-yellow-600 disabled:opacity-50">Add</button>
                <button onClick={() => setShowNote(false)} className="px-3 py-2 border border-yellow-200 rounded-lg text-xs text-yellow-700 hover:bg-yellow-100"><X className="w-3 h-3" /></button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.map((msg: { id: string; direction: string; type: string; body?: string; status: string; timestamp: string; mediaUrl?: string }) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-100 p-4 flex-shrink-0">
            <div className="flex items-end gap-3">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (messageText.trim()) sendMutation.mutate(); } }}
                  placeholder="Type a message..."
                  rows={1}
                  className="w-full bg-transparent text-sm resize-none focus:outline-none text-gray-900"
                />
              </div>
              <button
                onClick={() => sendMutation.mutate()}
                disabled={!messageText.trim() || sendMutation.isPending}
                className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-600 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600">Select a conversation</h3>
            <p className="text-gray-400 text-sm mt-1">Choose a conversation from the left to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}
