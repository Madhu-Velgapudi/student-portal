from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.assignment import new_assignment, new_submission
from datetime import datetime

assignment_bp = Blueprint("assignment", __name__)

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
    if "created_at" in doc:
        doc["created_at"] = doc["created_at"].strftime("%d %b %Y")
    if "submitted_at" in doc:
        doc["submitted_at"] = doc["submitted_at"].strftime("%d %b %Y, %I:%M %p")
    return doc

# ── GET ASSIGNMENTS FOR STUDENT ──
@assignment_bp.route("/my", methods=["GET"])
@token_required
def get_my_assignments():
    db   = current_app.db
    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    if not user:
        return jsonify([]), 200

    enrolled_ids = user.get("enrolled_courses", [])
    assignments  = list(db.assignments.find({"course_id": {"$in": enrolled_ids}}))

    result = []
    for a in assignments:
        aid = str(a["_id"])
        sub = db.submissions.find_one({
            "assignment_id": aid,
            "student_id":    request.user_id
        })
        a_data = serialize(a)
        a_data["submission"] = serialize(sub) if sub else None
        result.append(a_data)

    result.sort(key=lambda x: x.get("due_date", ""))
    return jsonify(result), 200

# ── SUBMIT ASSIGNMENT ──
@assignment_bp.route("/<assignment_id>/submit", methods=["POST"])
@token_required
def submit_assignment(assignment_id):
    db   = current_app.db
    data = request.get_json()
    answer = data.get("answer", "").strip()

    if not answer:
        return jsonify({"error": "Answer is required"}), 400

    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Check if already submitted
    existing = db.submissions.find_one({
        "assignment_id": assignment_id,
        "student_id":    request.user_id
    })

    if existing:
        db.submissions.update_one(
            {"_id": existing["_id"]},
            {"$set": {"answer": answer, "submitted_at": datetime.utcnow(), "status": "resubmitted"}}
        )
        return jsonify({"message": "Assignment resubmitted!"}), 200

    sub = new_submission(assignment_id, request.user_id, user["name"], answer)
    db.submissions.insert_one(sub)
    return jsonify({"message": "Assignment submitted successfully!"}), 201

# ── GET ALL ASSIGNMENTS (teacher/admin) ──
@assignment_bp.route("/course/<course_id>", methods=["GET"])
@token_required
@require_admin_or_teacher
def get_course_assignments(course_id):
    db          = current_app.db
    assignments = list(db.assignments.find({"course_id": course_id}))
    return jsonify([serialize(a) for a in assignments]), 200

# ── ADD ASSIGNMENT ──
@assignment_bp.route("/", methods=["POST"])
@token_required
@require_admin_or_teacher
def add_assignment():
    db   = current_app.db
    data = request.get_json()

    course_id   = data.get("course_id")
    title       = data.get("title", "").strip()
    description = data.get("description", "").strip()
    due_date    = data.get("due_date")
    total_marks = int(data.get("total_marks", 100))

    if not all([course_id, title, due_date]):
        return jsonify({"error": "course_id, title and due_date are required"}), 400

    try:
        course = db.courses.find_one({"_id": ObjectId(course_id)})
        if not course:
            return jsonify({"error": "Course not found"}), 404
    except Exception:
        return jsonify({"error": "Invalid course ID"}), 400

    user      = db.users.find_one({"_id": ObjectId(request.user_id)})
    posted_by = user["name"] if user else "Teacher"

    assignment = new_assignment(
        course_id, course["name"], course["code"],
        title, description, due_date, total_marks, posted_by
    )
    result = db.assignments.insert_one(assignment)
    return jsonify({"message": f"Assignment '{title}' added", "id": str(result.inserted_id)}), 201

# ── DELETE ASSIGNMENT ──
@assignment_bp.route("/<assignment_id>", methods=["DELETE"])
@token_required
@require_admin_or_teacher
def delete_assignment(assignment_id):
    current_app.db.assignments.delete_one({"_id": ObjectId(assignment_id)})
    current_app.db.submissions.delete_many({"assignment_id": assignment_id})
    return jsonify({"message": "Assignment deleted"}), 200

# ── GET SUBMISSIONS FOR AN ASSIGNMENT (teacher) ──
@assignment_bp.route("/<assignment_id>/submissions", methods=["GET"])
@token_required
@require_admin_or_teacher
def get_submissions(assignment_id):
    db   = current_app.db
    subs = list(db.submissions.find({"assignment_id": assignment_id}))
    return jsonify([serialize(s) for s in subs]), 200

# ── GRADE SUBMISSION ──
@assignment_bp.route("/submissions/<sub_id>/grade", methods=["POST"])
@token_required
@require_admin_or_teacher
def grade_submission(sub_id):
    db       = current_app.db
    data     = request.get_json()
    grade    = data.get("grade")
    feedback = data.get("feedback", "")

    db.submissions.update_one(
        {"_id": ObjectId(sub_id)},
        {"$set": {"grade": grade, "feedback": feedback, "status": "graded"}}
    )
    return jsonify({"message": "Graded successfully"}), 200