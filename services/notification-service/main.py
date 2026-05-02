# services/notification-service/main.py
# QuickBite Notification Service — Python FastAPI (shows polyglot skills)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import asyncpg
import asyncio
import os
from datetime import datetime

app = FastAPI(title="QuickBite Notification Service", version="1.0.0")

DB_DSN = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', 5432)}/{os.getenv('DB_NAME', 'notifications_db')}"

pool = None

@app.on_event("startup")
async def startup():
    global pool
    pool = await asyncpg.create_pool(DB_DSN, min_size=2, max_size=10)
    await migrate()

@app.on_event("shutdown")
async def shutdown():
    await pool.close()

async def migrate():
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id          SERIAL PRIMARY KEY,
                user_id     INT NOT NULL,
                type        VARCHAR(50) NOT NULL,
                message     TEXT NOT NULL,
                order_id    INT,
                read        BOOLEAN DEFAULT FALSE,
                created_at  TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_user_notifications ON notifications(user_id);
        """)
    print("✅ Notifications table ready")

# ── Models ────────────────────────────────────────────────────
class NotificationCreate(BaseModel):
    user_id: int
    type: str
    message: str
    order_id: Optional[int] = None

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    message: str
    order_id: Optional[int]
    read: bool
    created_at: datetime

# ── Routes ────────────────────────────────────────────────────
@app.post("/api/notifications/send", status_code=201)
async def send_notification(data: NotificationCreate):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO notifications (user_id, type, message, order_id)
               VALUES($1, $2, $3, $4) RETURNING *""",
            data.user_id, data.type, data.message, data.order_id
        )
        # In production: integrate with Firebase/Twilio/SendGrid here
        print(f"📬 Notification sent → user {data.user_id}: {data.message}")
        return dict(row)

@app.get("/api/notifications/{user_id}")
async def get_notifications(user_id: int, unread_only: bool = False):
    async with pool.acquire() as conn:
        q = "SELECT * FROM notifications WHERE user_id=$1"
        if unread_only:
            q += " AND read=false"
        q += " ORDER BY created_at DESC LIMIT 50"
        rows = await conn.fetch(q, user_id)
        return [dict(r) for r in rows]

@app.put("/api/notifications/{notification_id}/read")
async def mark_read(notification_id: int):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE notifications SET read=true WHERE id=$1 RETURNING *",
            notification_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Notification not found")
        return dict(row)

@app.put("/api/notifications/user/{user_id}/read-all")
async def mark_all_read(user_id: int):
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE notifications SET read=true WHERE user_id=$1 AND read=false",
            user_id
        )
        return {"message": "All notifications marked as read"}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "notification-service", "language": "Python/FastAPI"}
