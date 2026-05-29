from flask import Blueprint, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from datetime import datetime, timedelta

analytics_bp = Blueprint("analytics", __name__)

def require_admin(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        db   = current_app.db
        user = db.users.find_one({"_id": ObjectId(request.user_id)})
        if not user or not user.get("is_admin"):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated

from flask import request

@analytics_bp.route("/overview", methods=["GET"])
@token_required
def get_overview():
    db = current_app.db

    # Basic counts
    students  = list(db.users.find({"is_admin": {"$ne": True}, "is_teacher": {"$ne": True}}))
    courses   = list(db.courses.find())
    teachers  = list(db.users.find({"is_teacher": True}))

    total_students    = len(students)
    verified_students = sum(1 for s in students if s.get("is_verified"))
    total_courses     = len(courses)
    total_teachers    = len(teachers)
    total_enrollments = sum(len(s.get("enrolled_courses", [])) for s in students)

    # Enrollment per course
    course_enrollment = []
    for c in courses:
        cid   = str(c["_id"])
        count = db.users.count_documents({
            "enrolled_courses": cid,
            "is_teacher": {"$ne": True},
            "is_admin":   {"$ne": True}
        })
        course_enrollment.append({
            "code":  c["code"],
            "name":  c["name"],
            "count": count
        })
    course_enrollment.sort(key=lambda x: x["count"], reverse=True)

    # Attendance overview per course
    attendance_stats = []
    for c in courses:
        cid     = str(c["_id"])
        records = list(db.attendance.find({"course_id": cid}))
        if records:
            present = sum(1 for r in records if r["status"] == "present")
            pct     = round((present / len(records)) * 100)
        else:
            pct = 0
        attendance_stats.append({
            "code": c["code"],
            "name": c["name"],
            "pct":  pct
        })

    # Department distribution
    dept_map = {}
    for c in courses:
        dept = c.get("department", "Other")
        dept_map[dept] = dept_map.get(dept, 0) + 1

    dept_distribution = [{"dept": k, "count": v} for k, v in dept_map.items()]

    # Recent registrations (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_registrations = db.users.count_documents({
        "is_admin":   {"$ne": True},
        "is_teacher": {"$ne": True},
        "created_at": {"$gte": week_ago}
    })

    # Fee summary
    total_fees_pending = 0
    total_fees_paid    = 0
    try:
        pending_fees = list(db.fees.find({"status": "pending"}))
        paid_fees    = list(db.fees.find({"status": "paid"}))
        total_fees_pending = sum(f.get("amount", 0) for f in pending_fees)
        total_fees_paid    = sum(f.get("amount", 0) for f in paid_fees)
    except Exception:
        pass

    # Assignment stats
    total_assignments  = db.assignments.count_documents({}) if hasattr(db, 'assignments') else 0
    total_submissions  = db.submissions.count_documents({}) if hasattr(db, 'submissions') else 0

    return jsonify({
        "overview": {
            "total_students":       total_students,
            "verified_students":    verified_students,
            "total_courses":        total_courses,
            "total_teachers":       total_teachers,
            "total_enrollments":    total_enrollments,
            "recent_registrations": recent_registrations,
            "total_assignments":    total_assignments,
            "total_submissions":    total_submissions
        },
        "course_enrollment":  course_enrollment,
        "attendance_stats":   attendance_stats,
        "dept_distribution":  dept_distribution,
        "fees": {
            "pending": total_fees_pending,
            "paid":    total_fees_paid
        }
    }), 200