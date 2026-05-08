from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from datetime import datetime

notifications_bp = Blueprint("notifications", __name__)

DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def get_today_name():
    return datetime.utcnow().strftime("%A")  # e.g. "Monday"

@notifications_bp.route("/", methods=["GET"])
@token_required
def get_notifications():
    db    = current_app.db
    user  = db.users.find_one({"_id": ObjectId(request.user_id)})
    today = get_today_name()

    if not user:
        return jsonify([]), 200

    enrolled_ids = [ObjectId(cid) for cid in user.get("enrolled_courses", [])]
    courses      = list(db.courses.find({"_id": {"$in": enrolled_ids}})) if enrolled_ids else []

    notifications = []

    # Today's classes
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

    # Tomorrow's classes
    tomorrow_idx = (DAYS_ORDER.index(today) + 1) % 7
    tomorrow     = DAYS_ORDER[tomorrow_idx]
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

    # Low attendance warning (below 75%)
    attendance_records = list(db.attendance.find({"student_id": request.user_id}))
    course_attendance  = {}
    for r in attendance_records:
        cid = r["course_id"]
        if cid not in course_attendance:
            course_attendance[cid] = {"present": 0, "total": 0}
        course_attendance[cid]["total"]   += 1
        if r["status"] == "present":
            course_attendance[cid]["present"] += 1

    for cid, att in course_attendance.items():
        pct = round((att["present"] / att["total"]) * 100) if att["total"] > 0 else 100
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
                "message": f"Your attendance is {pct}% — below the 75% requirement.",
                "time":    None
            })

    # No classes today
    if not any(n["type"] == "class_today" for n in notifications):
        notifications.append({
            "type":    "no_class",
            "icon":    "✅",
            "title":   "No classes today",
            "message": f"Enjoy your day off! ({today})",
            "time":    None
        })

    # Sort by time
    notifications.sort(key=lambda x: x["time"] or "99:99")
    return jsonify(notifications), 200


@notifications_bp.route("/count", methods=["GET"])
@token_required
def get_count():
    """Returns unread notification count (today's classes + warnings)"""
    db    = current_app.db
    user  = db.users.find_one({"_id": ObjectId(request.user_id)})
    today = get_today_name()

    if not user:
        return jsonify({"count": 0}), 200

    enrolled_ids = [ObjectId(cid) for cid in user.get("enrolled_courses", [])]
    courses      = list(db.courses.find({"_id": {"$in": enrolled_ids}})) if enrolled_ids else []

    count = sum(
        1 for course in courses
        for slot in course.get("slots", [])
        if slot["day"] == today
    )
    return jsonify({"count": count}), 200