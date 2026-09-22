"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { sendMessage } from "@/app/market/messages/actions";

export default function MessageThread({
  listingId,
  listingTitle,
  withId,
  currentUserId,
  initialMessages,
  backHref,
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  function handleSend(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;

    // Optimistic append — this is a logistics chat, not a negotiation, so
    // there's nothing to validate beyond "not empty."
    const optimistic = {
      message_id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: withId,
      message: body,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages((m) => [...m, optimistic]);
    setText("");
    setError(null);

    startTransition(async () => {
      const res = await sendMessage({ listingId, receiverId: withId, message: body });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="msg-thread">
      <div className="msg-thread-header">
        <Link href={backHref} className="msg-back">
          ← Back
        </Link>
        <h3>{listingTitle}</h3>
      </div>

      <div className="msg-thread-body">
        {messages.map((m) => (
          <div
            key={m.message_id}
            className={`msg-bubble ${m.sender_id === currentUserId ? "msg-bubble-mine" : "msg-bubble-theirs"}`}
          >
            <p>{m.message}</p>
            <span className="msg-time">{new Date(m.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {error && <p className="msg-error">{error}</p>}

      <form className="msg-composer" onSubmit={handleSend}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Talk logistics — condition, pickup time, meeting spot…"
          maxLength={2000}
          disabled={isPending}
        />
        <button type="submit" disabled={isPending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
