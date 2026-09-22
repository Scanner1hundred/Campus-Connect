"use client";

import { useState, useTransition } from "react";
import { markNotificationRead, markAllNotificationsRead } from "@/app/market/notifications/actions";

const LABELS = {
  sale: { icon: "💰", label: "Sale" },
  purchase: { icon: "🛍️", label: "Purchase" },
  rent_payment: { icon: "📥", label: "Rent payout" },
  rental_payment: { icon: "📤", label: "Rental payment" },
  admin_review: { icon: "🛡️", label: "Admin review" },
  // Existing types your schema already had, kept so old rows still render:
  message: { icon: "💬", label: "Message" },
  order: { icon: "📦", label: "Order" },
  payment: { icon: "💳", label: "Payment" },
  review: { icon: "⭐", label: "Review" },
  favorite: { icon: "❤️", label: "Favorite" },
  system: { icon: "🔔", label: "System" },
};

export default function NotificationsList({ initialNotifications }) {
  const [items, setItems] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const unreadCount = items.filter((n) => !n.is_read).length;

  function handleMarkRead(id) {
    setItems((prev) => prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n)));
    startTransition(() => markNotificationRead(id));
  }

  function handleMarkAll() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    startTransition(() => markAllNotificationsRead());
  }

  if (items.length === 0) {
    return <p className="notif-empty">No notifications yet.</p>;
  }

  return (
    <div>
      {unreadCount > 0 && (
        <button className="notif-mark-all" onClick={handleMarkAll} disabled={isPending}>
          Mark all as read ({unreadCount})
        </button>
      )}
      <ul className="notif-list">
        {items.map((n) => {
          const meta = LABELS[n.type] ?? { icon: "🔔", label: n.type };
          return (
            <li
              key={n.notification_id}
              className={`notif-item${n.is_read ? "" : " notif-item-unread"}`}
              onClick={() => !n.is_read && handleMarkRead(n.notification_id)}
            >
              <span className="notif-icon">{meta.icon}</span>
              <div className="notif-body">
                <div className="notif-top">
                  <span className="notif-type">{meta.label}</span>
                  <span className="notif-date">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <p className="notif-msg-title">{n.title}</p>
                {n.message && <p className="notif-msg-body">{n.message}</p>}
              </div>
              {!n.is_read && <span className="notif-dot" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
