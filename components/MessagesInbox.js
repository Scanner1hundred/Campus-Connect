"use client";

import Link from "next/link";

export default function MessagesInbox({ threads, activeListingId, activeWithId }) {
  return (
    <div className="msg-inbox">
      <h2 className="msg-inbox-title">Messages</h2>
      {threads.length === 0 && <p className="msg-empty-small">No conversations yet.</p>}
      <ul className="msg-inbox-list">
        {threads.map((t) => {
          const active = t.listing_id === activeListingId && t.counterpart_id === activeWithId;
          return (
            <li key={`${t.listing_id}-${t.counterpart_id}`}>
              <Link
                href={`/market/messages?listing=${t.listing_id}&with=${t.counterpart_id}`}
                className={`msg-inbox-item${active ? " msg-inbox-item-active" : ""}`}
              >
                <div className="msg-inbox-item-top">
                  <span className="msg-inbox-listing">{t.listing_title}</span>
                  {t.unread_count > 0 && <span className="msg-badge">{t.unread_count}</span>}
                </div>
                <p className="msg-inbox-preview">{t.last_message}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
