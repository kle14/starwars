import random
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

USERS = [
    ("Luke Skywalker", "Rebel"), ("Leia Organa", "Rebel"), ("Han Solo", "Smuggler"),
    ("Chewbacca", "Smuggler"), ("Obi-Wan Kenobi", "Jedi"), ("Yoda", "Jedi"),
    ("Darth Vader", "Sith"), ("Grand Moff Tarkin", "Imperial"),
    ("R2-D2", "Droid"), ("C-3PO", "Droid"),
]

CONVERSATIONS = [
    ("Falcon hyperdrive repairs", [
        ("Han Solo", "Hyperdrive is acting up again."),
        ("Chewbacca", "Check the motivator. It is fried."),
        ("C-3PO", "Sir, the odds of repairing it before the jump are quite poor."),
        ("Han Solo", "Nobody asked for odds, Threepio."),
        ("Chewbacca", "I need a new coupling from the Mos Eisley market."),
        ("Han Solo", "Fine. Budget is 200 credits, tops."),
        ("C-3PO", "I shall document the repair costs for the record."),
    ]),
    ("Echo Base evacuation plan", [
        ("Leia Organa", "Transports must be loaded by dawn."),
        ("Luke Skywalker", "Snowspeeders are ready to cover the evacuation."),
        ("Han Solo", "Shield generator will not last another hour."),
        ("Leia Organa", "Then we move the command staff first."),
        ("Luke Skywalker", "Copy. I will coordinate the squadron."),
        ("R2-D2", "Beep boop. Power grid at 40 percent."),
    ]),
    ("Jedi training sessions", [
        ("Yoda", "Patience, you must have. Rushing, the Force does not reward."),
        ("Luke Skywalker", "I keep losing focus during the lifting exercise."),
        ("Yoda", "Feel the Force around you, not only the rock."),
        ("Obi-Wan Kenobi", "Remember to breathe. Calm mind, steady hands."),
        ("Luke Skywalker", "I lifted it for ten seconds today."),
        ("Yoda", "Progress, this is. Tomorrow, heavier objects we try."),
    ]),
    ("Death Star schematics", [
        ("Grand Moff Tarkin", "The station will be fully operational within the month."),
        ("Darth Vader", "The Rebels are searching for a weakness. Tighten security."),
        ("Grand Moff Tarkin", "Security logs show no unauthorized access."),
        ("Darth Vader", "Then someone is hiding it well. Audit every officer."),
        ("Grand Moff Tarkin", "Understood. Audit begins tonight."),
    ]),
    ("Droid maintenance log", [
        ("C-3PO", "R2, you have oil leaking on the hangar floor again."),
        ("R2-D2", "Beep. Not my fault. Faulty seal."),
        ("C-3PO", "Oh dear, I shall report it to the mechanics."),
        ("R2-D2", "Whistle. Also my dome rotation is stuck."),
        ("C-3PO", "Honestly, the trouble you cause."),
    ]),
    ("Smuggler supply run", [
        ("Han Solo", "Cargo pickup is at Docking Bay 94."),
        ("Chewbacca", "Inspection droids are doing rounds near the bay."),
        ("Han Solo", "Then we go in late at night."),
        ("Chewbacca", "Fuel is low. We need to stop at the depot first."),
        ("Han Solo", "Fine, but make it quick."),
        ("Chewbacca", "Payment arrives tomorrow, right?"),
        ("Han Solo", "That is the plan. Do not jinx it."),
    ]),
    ("Force and the dark side", [
        ("Obi-Wan Kenobi", "Anakin was a good friend. I still carry that guilt."),
        ("Darth Vader", "That name means nothing to me now."),
        ("Obi-Wan Kenobi", "The Force remembers what you try to forget."),
        ("Darth Vader", "Power is the only thing that matters."),
        ("Obi-Wan Kenobi", "Then you have already lost."),
    ]),
]

FILLER = [
    "Copy that.", "Status update on the shipment?", "Moving to the rendezvous point.",
    "Signal is weak in this sector.", "Can you send the coordinates again?",
    "Understood. Standing by.", "Meeting moved to 0600.", "Supplies are running low.",
    "Keep this channel encrypted.", "I have a bad feeling about this route.",
    "Hyperspace lane is clear.", "Patrols spotted near the outer rim.",
    "Fuel cells are charging.", "Message received. Will reply soon.",
    "Check the navigation computer before we jump.", "Reinforcements are on the way.",
    "Droid inventory is complete.", "Please confirm the landing clearance.",
]

RANKS = ["Cmdr.", "Capt.", "Lt.", "Sgt.", "Agent", "Master", "Admiral"]
NAMES = ["Vex", "Dorn", "Kessa", "Tarn", "Iolo", "Brask", "Mira", "Jax", "Sol", "Nyx",
         "Orrin", "Pell", "Quill", "Rook", "Sabe", "Teza", "Ulan", "Veda", "Wren", "Zeph"]
FACTION_LIST = ["Jedi", "Sith", "Rebel", "Imperial", "Smuggler", "Droid"]
OPS = ["Convoy", "Blockade", "Recon", "Salvage", "Evacuation", "Patrol", "Supply run",
       "Escort", "Ambush", "Negotiation", "Training", "Maintenance"]
PLACES = ["Kessel", "Naboo", "Jakku", "Bespin", "Lothal", "Scarif", "Yavin", "Ryloth",
          "Coruscant", "Dantooine", "Mon Cala", "Utapau"]
CODES = ["Alpha", "Bravo", "Cobalt", "Delta", "Ember", "Falcon", "Ghost", "Helix", "Iron", "Jade"]
THINGS = ["cargo", "spice shipment", "medpacs", "blaster crates", "hyperdrive core",
          "astromech", "transport", "fighter wing", "holocron", "power coupling"]
TEMPLATES = [
    "Fuel reserves at {place} are down to {n} percent.",
    "Rerouting the {thing} through {place}.",
    "Did anyone confirm the {thing} delivery?",
    "Imperial patrol spotted near {place}, {n} ships.",
    "We need {n} more {thing} before the jump.",
    "Hyperdrive on the {thing} is failing again.",
    "The Force feels disturbed around {place}.",
    "Encrypted the {thing} manifest with key {code}.",
    "Meet at {place} in {n} hours.",
    "Shields at {n} percent, requesting backup.",
    "Who authorized the {thing} transfer?",
    "Sensors show an anomaly near {place}.",
    "Droid unit {code}-{n} needs a memory wipe.",
    "Credits are short. {n} thousand to cover the {thing}.",
    "Lightsaber crystals arrived from {place}.",
    "Security audit flagged the {thing} at {place}.",
]


def fake_line():
    return random.choice(TEMPLATES).format(
        place=random.choice(PLACES), thing=random.choice(THINGS),
        code=random.choice(CODES), n=random.randint(2, 98))


def seed(path: Path, extra_chats: int = 300):
    random.seed(42)
    c = sqlite3.connect(path)
    c.executescript("""
        CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT, faction TEXT);
        CREATE TABLE conversations(id INTEGER PRIMARY KEY, title TEXT);
        CREATE TABLE participants(conversation_id INTEGER, user_id INTEGER);
        CREATE TABLE messages(id INTEGER PRIMARY KEY, conversation_id INTEGER,
                              user_id INTEGER, text TEXT, ts TEXT);
    """)
    ids = {}
    by_faction = {f: [] for f in FACTION_LIST}
    for name, faction in USERS:
        uid = c.execute("INSERT INTO users(name, faction) VALUES (?,?)", (name, faction)).lastrowid
        ids[name] = uid
        by_faction[faction].append(uid)
    for _ in range(40):
        f = random.choice(FACTION_LIST)
        name = f"{random.choice(RANKS)} {random.choice(NAMES)}-{random.randint(1, 99)}"
        uid = c.execute("INSERT INTO users(name, faction) VALUES (?,?)", (name, f)).lastrowid
        by_faction[f].append(uid)
    all_ids = [u for v in by_faction.values() for u in v]

    now = datetime.now(timezone.utc)

    def add_conv(title, members, lines, span_days):
        cid = c.execute("INSERT INTO conversations(title) VALUES (?)", (title,)).lastrowid
        for u in set(members):
            c.execute("INSERT INTO participants VALUES (?,?)", (cid, u))
        t = now - timedelta(days=random.uniform(1, span_days))
        rows = []
        for uid, text in lines:
            t += timedelta(minutes=random.randint(1, 90))
            if t > now:
                t = now - timedelta(minutes=random.randint(1, 60))
            rows.append((cid, uid, text, t.isoformat(timespec="seconds")))
        rows.sort(key=lambda r: r[3])
        c.executemany("INSERT INTO messages(conversation_id,user_id,text,ts) VALUES (?,?,?,?)", rows)

    for title, lines in CONVERSATIONS:
        speakers = sorted({n for n, _ in lines})
        full = [(ids[n], t) for n, t in lines]
        for _ in range(random.randint(25, 40)):
            full.insert(random.randint(0, len(full)),
                        (ids[random.choice(speakers)], random.choice(FILLER)))
        add_conv(title, [ids[s] for s in speakers], full, 13)

    for _ in range(extra_chats):
        main = random.choice(FACTION_LIST)
        members = random.sample(by_faction[main], k=min(len(by_faction[main]), random.randint(1, 3)))
        members += random.sample(all_ids, k=random.randint(1, 2))
        size = min(500, int(random.paretovariate(1.2) * 20) + 8)
        title = f"{random.choice(OPS)} {random.choice(CODES)} - {random.choice(PLACES)}"
        lines = [(random.choice(members), fake_line()) for _ in range(size)]
        add_conv(title, members, lines, 60)

    c.executescript("""
        CREATE INDEX idx_msg_conv_ts ON messages(conversation_id, ts, id);
        CREATE INDEX idx_msg_user ON messages(user_id);
        CREATE VIRTUAL TABLE messages_fts USING fts5(text, content='messages', content_rowid='id');
        INSERT INTO messages_fts(messages_fts) VALUES('rebuild');
    """)
    c.commit()
    c.close()
