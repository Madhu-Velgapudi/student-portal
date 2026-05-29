from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.exam import new_exam
from datetime import datetime

exam_bp = Blueprint("exam", __name__)

def require_admin_or_teacher(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        db   = current_app.db
        user = db.users.find_one({"_id": ObjectId(request.user_id)})
        if not user or (not user.get("is_admin") and not user.get("is_teacher")):
            return jsonify({"error": "Admin or Teacher access required"}), 403
        return f(*args, **kwargs)
    return decorated

def serialize(doc):
    doc["_id"] = str(doc["_id"])
    doc.pop("created_at", None)
    return doc

# ── GET EXAMS FOR STUDENT ──
@exam_bp.route("/my", methods=["GET"])
@token_required
def get_my_exams():
    db   = current_app.db
    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    if not user:
        return jsonify([]), 200

    enrolled_ids = user.get("enrolled_courses", [])
    exams = list(db.exams.find({"course_id": {"$in": enrolled_ids}}))
    exams.sort(key=lambda x: x.get("date", ""))
    return jsonify([serialize(e) for e in exams]), 200

# ── GET ALL EXAMS (admin/teacher) ──
@exam_bp.route("/", methods=["GET"])
@token_required
@require_admin_or_teacher
def get_all_exams():
    db    = current_app.db
    exams = list(db.exams.find())
    exams.sort(key=lambda x: x.get("date", ""))
    return jsonify([serialize(e) for e in exams]), 200

# ── ADD EXAM ──
@exam_bp.route("/", methods=["POST"])
@token_required
@require_admin_or_teacher
def add_exam():
    db   = current_app.db
    data = request.get_json()

    course_id   = data.get("course_id")
    exam_type   = data.get("exam_type", "midterm")
    date        = data.get("date")
    start_time  = data.get("start_time")
    end_time    = data.get("end_time")
    room        = data.get("room", "TBD")
    total_marks = int(data.get("total_marks", 100))

    if not all([course_id, date, start_time]):
        return jsonify({"error": "course_id, date and start_time are required"}), 400

    try:
        course = db.courses.find_one({"_id": ObjectId(course_id)})
        if not course:
            return jsonify({"error": "Course not found"}), 404
    except Exception:
        return jsonify({"error": "Invalid course ID"}), 400

    exam   = new_exam(course_id, course["name"], course["code"], exam_type, date, start_time, end_time, room, total_marks)
    result = db.exams.insert_one(exam)
    return jsonify({"message": "Exam scheduled", "id": str(result.inserted_id)}), 201

# ── DELETE EXAM ──
@exam_bp.route("/<exam_id>", methods=["DELETE"])
@token_required
@require_admin_or_teacher
def delete_exam(exam_id):
    current_app.db.exams.delete_one({"_id": ObjectId(exam_id)})
    return jsonify({"message": "Exam deleted"}), 200