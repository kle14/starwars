import re
import sqlite3
from contextlib import asynccontextmanager, closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from seed import seed

DB = Path(__file__).parent / "chats.db"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DB.exists():
        seed(DB)
    yield


app = FastAPI(title="Holonet Admin", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_methods=["*"], allow_headers=["*"])


def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


def fts_query(q: str):
    toks = re.findall(r"\w+", q or "")
    return " ".join(f'"{t}"*' for t in toks) if toks else None


def build(q, user_id, faction, conversation_id, date_from, date_to):
    fq = fts_query(q)
    if fq:
        sql = "FROM messages_fts JOIN messages m ON m.id = messages_fts.rowid"
        where, args = ["messages_fts MATCH ?"], [fq]
    else:
        sql, where, args = "FROM messages m", [], []
        if q and q.strip():
            where.append("0")
    sql += (" JOIN users u ON u.id = m.user_id"
            " JOIN conversations c ON c.id = m.conversation_id")
    if user_id:
        where.append("m.user_id = ?"); args.append(user_id)
    if faction:
        where.append("u.faction = ?"); args.append(faction)
    if conversation_id:
        where.append("m.conversation_id = ?"); args.append(conversation_id)
    if date_from:
        where.append("m.ts >= ?"); args.append(date_from)
    if date_to:
        where.append("m.ts <= ?"); args.append(date_to + "T23:59:59")
    if where:
        sql += " WHERE " + " AND ".join(where)
    return sql, args, fq


@app.get("/api/stats")
def stats():
    with closing(db()) as c:
        one = lambda sql: c.execute(sql).fetchone()[0]
        today = datetime.now(timezone.utc).date()
        counts = {r["day"]: r["n"] for r in c.execute(
            "SELECT substr(ts,1,10) AS day, COUNT(*) AS n FROM messages GROUP BY day")}
        per_day = [{"day": (today - timedelta(days=i)).isoformat(),
                    "count": counts.get((today - timedelta(days=i)).isoformat(), 0)}
                   for i in range(13, -1, -1)]
        top_users = [dict(r) for r in c.execute("""
            SELECT u.name, u.faction, COUNT(*) AS count FROM messages m
            JOIN users u ON u.id = m.user_id GROUP BY u.id ORDER BY count DESC LIMIT 5""")]
        return {"messages": one("SELECT COUNT(*) FROM messages"),
                "conversations": one("SELECT COUNT(*) FROM conversations"),
                "users": one("SELECT COUNT(*) FROM users"),
                "per_day": per_day, "top_users": top_users}


@app.get("/api/users")
def users():
    with closing(db()) as c:
        return [dict(r) for r in c.execute("SELECT id, name, faction FROM users ORDER BY name")]


@app.get("/api/galaxy")
def galaxy(limit: int = Query(3000, le=10000)):
    with closing(db()) as c:
        U = {r["id"]: r for r in c.execute("SELECT id, name, faction FROM users")}
        convs = c.execute("""
            SELECT c.id, c.title, COUNT(m.id) AS n, MAX(m.ts) AS last_ts
            FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
            GROUP BY c.id ORDER BY last_ts DESC LIMIT ?""", (limit,)).fetchall()
        per = {}
        for r in c.execute("""SELECT conversation_id AS cid, user_id AS uid, COUNT(*) AS k
                              FROM messages GROUP BY conversation_id, user_id"""):
            per.setdefault(r["cid"], []).append((r["k"], r["uid"]))
        out = []
        for r in convs:
            ranked = sorted(per.get(r["id"], []), reverse=True)
            out.append({
                "id": r["id"], "title": r["title"], "n": r["n"], "last_ts": r["last_ts"],
                "group": U[ranked[0][1]]["faction"] if ranked else "Droid",
                "p": [U[u]["name"] for _, u in ranked[:5]],
            })
        return out


@app.get("/api/search/hits")
def search_hits(q: str = "", user_id: Optional[int] = None, faction: Optional[str] = None,
                date_from: Optional[str] = None, date_to: Optional[str] = None):
    sql, args, _ = build(q, user_id, faction, None, date_from, date_to)
    with closing(db()) as c:
        rows = c.execute(f"SELECT m.conversation_id AS id, COUNT(*) AS n {sql} "
                         "GROUP BY m.conversation_id", args).fetchall()
        return {"hits": [dict(r) for r in rows]}


@app.get("/api/search")
def search(q: str = "", user_id: Optional[int] = None, faction: Optional[str] = None,
           conversation_id: Optional[int] = None, date_from: Optional[str] = None,
           date_to: Optional[str] = None, limit: int = Query(30, le=200), offset: int = 0):
    sql, args, fq = build(q, user_id, faction, conversation_id, date_from, date_to)
    snip = "snippet(messages_fts, 0, '[[', ']]', '…', 18)" if fq else "m.text"
    order = "bm25(messages_fts)" if fq else "m.ts DESC"
    with closing(db()) as c:
        total = c.execute(f"SELECT COUNT(*) {sql}", args).fetchone()[0]
        rows = c.execute(
            f"""SELECT m.id, m.conversation_id, m.ts, {snip} AS snip,
                       u.name AS user, u.faction, c.title AS conversation
                {sql} ORDER BY {order} LIMIT ? OFFSET ?""", args + [limit, offset]).fetchall()
        return {"total": total, "results": [dict(r) for r in rows]}


@app.get("/api/conversations/{cid}/messages")
def messages(cid: int, offset: int = -1, limit: int = Query(60, le=300),
             around: Optional[int] = None):
    with closing(db()) as c:
        conv = c.execute("SELECT id, title FROM conversations WHERE id=?", (cid,)).fetchone()
        if not conv:
            raise HTTPException(404, "Conversation not found")
        total = c.execute("SELECT COUNT(*) FROM messages WHERE conversation_id=?", (cid,)).fetchone()[0]
        if around:
            idx = c.execute("""SELECT COUNT(*) FROM messages WHERE conversation_id=? AND
                (ts < (SELECT ts FROM messages WHERE id=?) OR
                 (ts = (SELECT ts FROM messages WHERE id=?) AND id < ?))""",
                            (cid, around, around, around)).fetchone()[0]
            offset = max(0, idx - limit // 2)
        elif offset < 0:
            offset = max(0, total - limit)
        rows = c.execute("""SELECT m.id, m.text, m.ts, u.name AS user, u.faction
                            FROM messages m JOIN users u ON u.id = m.user_id
                            WHERE m.conversation_id=? ORDER BY m.ts, m.id LIMIT ? OFFSET ?""",
                         (cid, limit, offset)).fetchall()
        parts = [dict(p) for p in c.execute(
            """SELECT u.id, u.name, u.faction FROM participants p
               JOIN users u ON u.id = p.user_id WHERE p.conversation_id=?""", (cid,))]
        return {"conversation": {**dict(conv), "participants": parts},
                "messages": [dict(r) for r in rows], "offset": offset, "total": total}
