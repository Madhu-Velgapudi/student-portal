from datetime import datetime
from bson import ObjectId

DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def get_today_name():
    return datetime.utcnow().strftime("%A")

def get_tomorrow_name():
    today_idx = DAYS_ORDER.index(get_today_name())
    return DAYS_ORDER[(today_idx + 1) % 7]

def generate_notifications(db, user_id: str) -> list:
    """
    Generates a list of notification dicts for a student based on:
    - Today's classes
    - Tomorrow's classes
    - Low attendance warnings (below 75%)
    - No class today
    """
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return []

    today    = get_today_name()
    tomorrow = get_tomorrow_name()

    enrolled_ids = [ObjectId(cid) for cid in user.get("enrolled_courses", [])]
    courses      = list(db.courses.find({"_id": {"$in": enrolled_ids}})) if enrolled_ids else []

    notifications = []

    # ── TODAY'S CLASSES ──
    for course in courses:
        for slot in course.get("slots", []):
            if slot["day"] == today:
                notifications.append({
                    "type":    "class_today",
                    "icon":    "📅",
                    "title":   f"{course['name']} today",
                    "message": f"{slot['start']} – {slot['end']} in {slot.get('room', 'TBD')}",
                    "time":    slot["start"]
                })

    # ── TOMORROW'S CLASSES ──
    for course in courses:
        for slot in course.get("slots", []):
            if slot["day"] == tomorrow:
                notifications.append({
                    "type":    "class_tomorrow",
                    "icon":    "🔔",
                    "title":   f"{course['name']} tomorrow",
                    "message": f"{tomorrow} at {slot['start']} in {slot.get('room', 'TBD')}",
                    "time":    slot["start"]
                })

    # ── LOW ATTENDANCE WARNINGS ──
    att_records = list(db.attendance.find({"student_id": user_id}))
    course_att  = {}
    for r in att_records:
        cid = r["course_id"]
        if cid not in course_att:
            course_att[cid] = {"present": 0, "total": 0, "name": ""}
        course_att[cid]["total"] += 1
        if r["status"] == "present":
            course_att[cid]["present"] += 1

    for cid, att in course_att.items():
        total = att["total"]
        pct   = round((att["present"] / total) * 100) if total > 0 else 100
        if pct < 75:
            try:
                course = db.courses.find_one({"_id": ObjectId(cid)})
                name   = course["name"] if course else "A course"
            except Exception:
                name = "A course"
            notifications.append({
                "type":    "low_attendance",
                "icon":    "⚠️",
                "title":   f"Low attendance: {name}",
                "message": f"Your attendance is {pct}% — below the 75% threshold.",
                "time":    None
            })

    # ── NO CLASS TODAY ──
    if not any(n["type"] == "class_today" for n in notifications):
        notifications.append({
            "type":    "no_class",
            "icon":    "✅",
            "title":   "No classes today",
            "message": f"Enjoy your free day! ({today})",
            "time":    None
        })

    # Sort: timed notifications first, then untimed
    notifications.sort(key=lambda x: (x["time"] is None, x["time"] or ""))
    return notifications


def get_today_class_count(db, user_id: str) -> int:
    """Returns count of classes scheduled for today — used for notification badge."""
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return 0

    today        = get_today_name()
    enrolled_ids = [ObjectId(cid) for cid in user.get("enrolled_courses", [])]
    if not enrolled_ids:
        return 0

    courses = list(db.courses.find({"_id": {"$in": enrolled_ids}}))
    return sum(
        1 for course in courses
        for slot in course.get("slots", [])
        if slot["day"] == today
    )