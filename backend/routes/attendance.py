from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.attendance import new_attendance_record
from datetime import datetime, timezone, timedelta

attendance_bp = Blueprint("attendance", __name__)

IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_date():
    return datetime.now(IST).strftime("%Y-%m-%d")

def get_ist_day():
    return datetime.now(IST).strftime("%A")

def require_teacher_or_admin(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        db   = current_app.db
        user = db.users.find_one({"_id": ObjectId(request.user_id)})
        if not user or (not user.get("is_teacher") and not user.get("is_admin")):
            return jsonify({"error": "Teacher or Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated

# ══════════════════════════════════════
# TEACHER — Mark attendance for a student
# ══════════════════════════════════════
@attendance_bp.route("/teacher/mark", methods=["POST"])
@token_required
@require_teacher_or_admin
def teacher_mark_attendance():
    db   = current_app.db
    data = request.get_json()

    student_id  = data.get("student_id")
    course_id   = data.get("course_id")
    course_code = data.get("course_code", "")
    slot_day    = data.get("slot_day")
    slot_time   = data.get("slot_time", "")
    status      = data.get("status")
    date        = data.get("date") or get_ist_date()

    if not all([student_id, course_id, slot_day, status]):
        return jsonify({"error": "student_id, course_id, slot_day and status are required"}), 400

    if status not in ["present", "absent"]:
        return jsonify({"error": "Status must be 'present' or 'absent'"}), 400

    existing = db.attendance.find_one({
        "student_id": student_id,
        "course_id":  course_id,
        "slot_day":   slot_day,
        "date":       date
    })

    if existing:
        db.attendance.update_one(
            {"_id": existing["_id"]},
            {"$set": {"status": status}}
        )
        return jsonify({"message": f"Attendance updated to {status}"}), 200

    record = new_attendance_record(
        student_id, course_id, course_code, slot_day, slot_time, status
    )
    record["date"] = date
    db.attendance.insert_one(record)
    return jsonify({"message": f"Marked {status}"}), 201


# ══════════════════════════════════════
# TEACHER — Get all students for a course with attendance
# ══════════════════════════════════════
@attendance_bp.route("/teacher/course/<course_id>", methods=["GET"])
@token_required
@require_teacher_or_admin
def get_course_attendance(course_id):
    db      = current_app.db
    date    = request.args.get("date", get_ist_date())
    slot_day = request.args.get("slot_day", get_ist_day())

    # Get all students enrolled in this course
    students = list(db.users.find({
        "enrolled_courses": course_id,
        "is_teacher":       {"$ne": True},
        "is_admin":         {"$ne": True}
    }))

    result = []
    for s in students:
        sid = str(s["_id"])

        # Get today's attendance for this slot
        today_att = db.attendance.find_one({
            "student_id": sid,
            "course_id":  course_id,
            "slot_day":   slot_day,
            "date":       date
        })

        # Get overall attendance stats
        all_att = list(db.attendance.find({
            "student_id": sid,
            "course_id":  course_id
        }))
        present = sum(1 for r in all_att if r["status"] == "present")
        total   = len(all_att)
        pct     = round((present / total) * 100) if total > 0 else 0

        result.append({
            "student_id":   sid,
            "name":         s["name"],
            "email":        s["email"],
            "today_status": today_att["status"] if today_att else None,
            "present":      present,
            "total":        total,
            "percentage":   pct
        })

    return jsonify(result), 200


# ══════════════════════════════════════
# TEACHER — Get available dates for a course slot
# ══════════════════════════════════════
@attendance_bp.route("/teacher/dates/<course_id>", methods=["GET"])
@token_required
@require_teacher_or_admin
def get_available_dates(course_id):
    """Returns past dates for each slot day so teacher can mark past attendance"""
    db     = current_app.db
    course = db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        return jsonify([]), 404

    IST_now = datetime.now(IST)
    dates   = []

    for slot in course.get("slots", []):
        day  = slot["day"]
        # Get last 4 occurrences of this day
        day_map = {
            "Monday": 0, "Tuesday": 1, "Wednesday": 2,
            "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6
        }
        target_weekday = day_map.get(day, 0)
        current        = IST_now

        slot_dates = []
        for _ in range(8):  # Look back up to 8 weeks
            diff    = (current.weekday() - target_weekday) % 7
            past_day = current - timedelta(days=diff)
            date_str = past_day.strftime("%Y-%m-%d")
            if date_str not in [d["date"] for d in slot_dates]:
                slot_dates.append({
                    "date":     date_str,
                    "day":      day,
                    "display":  past_day.strftime("%d %b %Y (%A)"),
                    "slot_time": f"{slot['start']} – {slot['end']}"
                })
            current = past_day - timedelta(days=1)

        dates.extend(slot_dates[:4])  # Last 4 occurrences per slot

    return jsonify(dates), 200


# ══════════════════════════════════════
# STUDENT — View own attendance (read only)
# ══════════════════════════════════════
@attendance_bp.route("/my", methods=["GET"])
@token_required
def get_my_attendance():
    db      = current_app.db
    records = list(db.attendance.find({"student_id": request.user_id}))

    summary = {}
    for r in records:
        cid = r["course_id"]
        if cid not in summary:
            summary[cid] = {
                "course_id":   cid,
                "course_code": r.get("course_code", ""),
                "present":     0,
                "absent":      0,
                "records":     []
            }
        summary[cid][r["status"]] += 1
        summary[cid]["records"].append({
            "date":      r["date"],
            "slot_day":  r["slot_day"],
            "slot_time": r.get("slot_time", ""),
            "status":    r["status"]
        })

    for cid, s in summary.items():
        try:
            course = db.courses.find_one({"_id": ObjectId(cid)})
            s["course_name"] = course["name"] if course else "Unknown"
        except Exception:
            s["course_name"] = "Unknown"
        total = s["present"] + s["absent"]
        s["percentage"] = round((s["present"] / total) * 100) if total > 0 else 0
        # Sort records by date descending
        s["records"].sort(key=lambda x: x["date"], reverse=True)

    return jsonify(list(summary.values())), 200