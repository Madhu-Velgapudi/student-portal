from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.marks import new_mark, get_grade
from datetime import datetime

marks_bp = Blueprint("marks", __name__)

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

def serialize(doc):
    doc["_id"] = str(doc["_id"])
    doc.pop("created_at", None)
    doc.pop("updated_at", None)
    return doc

# ── ENTER / UPDATE MARKS (teacher/admin) ──
@marks_bp.route("/enter", methods=["POST"])
@token_required
@require_teacher_or_admin
def enter_marks():
    db   = current_app.db
    data = request.get_json()

    student_id = data.get("student_id")
    course_id  = data.get("course_id")
    marks      = data.get("marks")

    if not all([student_id, course_id, marks is not None]):
        return jsonify({"error": "student_id, course_id and marks are required"}), 400

    marks = float(marks)
    if marks < 0 or marks > 100:
        return jsonify({"error": "Marks must be between 0 and 100"}), 400

    # Get course info
    try:
        course = db.courses.find_one({"_id": ObjectId(course_id)})
        if not course:
            return jsonify({"error": "Course not found"}), 404
    except Exception:
        return jsonify({"error": "Invalid course ID"}), 400

    # Get teacher name
    teacher = db.users.find_one({"_id": ObjectId(request.user_id)})
    posted_by = teacher["name"] if teacher else "Teacher"

    grade, points = get_grade(marks)

    existing = db.marks.find_one({
        "student_id": student_id,
        "course_id":  course_id
    })

    if existing:
        db.marks.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "marks":        marks,
                "grade":        grade,
                "grade_points": points,
                "posted_by":    posted_by,
                "updated_at":   datetime.utcnow()
            }}
        )
        return jsonify({"message": f"Marks updated to {marks}"}), 200

    mark = new_mark(
        student_id, course_id,
        course["name"], course["code"], course["credits"],
        marks, posted_by
    )
    db.marks.insert_one(mark)
    return jsonify({"message": f"Marks entered: {marks}"}), 201


# ── GET MARKS FOR A COURSE (teacher view) ──
@marks_bp.route("/course/<course_id>", methods=["GET"])
@token_required
@require_teacher_or_admin
def get_course_marks(course_id):
    db = current_app.db

    # Get all enrolled students
    students = list(db.users.find({
        "enrolled_courses": course_id,
        "is_teacher":       {"$ne": True},
        "is_admin":         {"$ne": True}
    }))

    result = []
    for s in students:
        sid  = str(s["_id"])
        mark = db.marks.find_one({"student_id": sid, "course_id": course_id})
        result.append({
            "student_id":   sid,
            "name":         s["name"],
            "email":        s["email"],
            "marks":        mark["marks"]        if mark else None,
            "grade":        mark["grade"]        if mark else "—",
            "grade_points": mark["grade_points"] if mark else None,
        })

    return jsonify(result), 200


# ── GET MY MARKS (student view) ──
@marks_bp.route("/my", methods=["GET"])
@token_required
def get_my_marks():
    db    = current_app.db
    marks = list(db.marks.find({"student_id": request.user_id}))

    if not marks:
        return jsonify({"marks": [], "cgpa": 0, "total_credits": 0}), 200

    total_points  = 0
    total_credits = 0
    result        = []

    for m in marks:
        credits        = m.get("credits", 0)
        total_points  += m["grade_points"] * credits
        total_credits += credits
        result.append({
            "course_id":    m["course_id"],
            "course_name":  m["course_name"],
            "course_code":  m["course_code"],
            "credits":      credits,
            "marks":        m["marks"],
            "grade":        m["grade"],
            "grade_points": m["grade_points"],
            "posted_by":    m.get("posted_by", "Teacher")
        })

    cgpa = round(total_points / total_credits, 2) if total_credits > 0 else 0

    return jsonify({
        "marks":         result,
        "cgpa":          cgpa,
        "total_credits": total_credits,
        "total_points":  round(total_points, 1)
    }), 200