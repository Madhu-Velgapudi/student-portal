from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from services.auth_service import (
    hash_password, check_password,
    generate_jwt, generate_verification_token
)
import os

teacher_bp = Blueprint("teacher", __name__)

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

def require_teacher(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        db   = current_app.db
        user = db.users.find_one({"_id": ObjectId(request.user_id)})
        if not user or (not user.get("is_teacher") and not user.get("is_admin")):
            return jsonify({"error": "Teacher access required"}), 403
        return f(*args, **kwargs)
    return decorated

# ── TEACHER LOGIN ──
@teacher_bp.route("/login", methods=["POST"])
def teacher_login():
    db   = current_app.db
    data = request.get_json()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = db.users.find_one({"email": email})
    if not user or not check_password(password, user["password"]):
        return jsonify({"error": "Invalid credentials"}), 401
    if not user.get("is_teacher") and not user.get("is_admin"):
        return jsonify({"error": "This account does not have teacher access"}), 403
    if not user.get("is_active", True):
        return jsonify({"error": "Account deactivated"}), 403

    token = generate_jwt(str(user["_id"]), user["email"])
    return jsonify({
        "token": token,
        "teacher": {
            "name":            user["name"],
            "email":           user["email"],
            "assigned_courses": user.get("assigned_courses", [])
        }
    }), 200

# ── CREATE TEACHER (admin only) ──
@teacher_bp.route("/create", methods=["POST"])
@token_required
@require_admin
def create_teacher():
    db   = current_app.db
    data = request.get_json()
    name     = data.get("name", "").strip()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if db.users.find_one({"email": email}):
        return jsonify({"error": "Email already exists"}), 409

    teacher = {
        "name":              name,
        "email":             email,
        "password":          hash_password(password),
        "is_teacher":        True,
        "is_admin":          False,
        "is_verified":       True,
        "is_active":         True,
        "assigned_courses":  [],
        "enrolled_courses":  [],
        "created_at":        __import__('datetime').datetime.utcnow()
    }
    result = db.users.insert_one(teacher)
    return jsonify({"message": f"Teacher {name} created", "id": str(result.inserted_id)}), 201

# ── GET ALL TEACHERS (admin only) ──
@teacher_bp.route("/", methods=["GET"])
@token_required
@require_admin
def get_teachers():
    db       = current_app.db
    teachers = list(db.users.find({"is_teacher": True}))
    result   = []
    for t in teachers:
        assigned = []
        for cid in t.get("assigned_courses", []):
            try:
                course = db.courses.find_one({"_id": ObjectId(cid)})
                if course:
                    assigned.append({"id": cid, "name": course["name"], "code": course["code"]})
            except Exception:
                pass
        result.append({
            "_id":              str(t["_id"]),
            "name":             t["name"],
            "email":            t["email"],
            "is_active":        t.get("is_active", True),
            "assigned_courses": assigned,
            "created_at":       t["created_at"].strftime("%d %b %Y") if t.get("created_at") else "—"
        })
    return jsonify(result), 200

# ── ASSIGN COURSE TO TEACHER (admin only) ──
@teacher_bp.route("/<teacher_id>/assign", methods=["POST"])
@token_required
@require_admin
def assign_course(teacher_id):
    db        = current_app.db
    data      = request.get_json()
    course_id = data.get("course_id")

    teacher = db.users.find_one({"_id": ObjectId(teacher_id), "is_teacher": True})
    if not teacher:
        return jsonify({"error": "Teacher not found"}), 404

    if course_id in teacher.get("assigned_courses", []):
        return jsonify({"error": "Course already assigned"}), 409

    db.users.update_one(
        {"_id": ObjectId(teacher_id)},
        {"$push": {"assigned_courses": course_id}}
    )
    return jsonify({"message": "Course assigned"}), 200

# ── UNASSIGN COURSE ──
@teacher_bp.route("/<teacher_id>/unassign", methods=["POST"])
@token_required
@require_admin
def unassign_course(teacher_id):
    db        = current_app.db
    data      = request.get_json()
    course_id = data.get("course_id")

    db.users.update_one(
        {"_id": ObjectId(teacher_id)},
        {"$pull": {"assigned_courses": course_id}}
    )
    return jsonify({"message": "Course unassigned"}), 200

# ── DELETE TEACHER ──
@teacher_bp.route("/<teacher_id>", methods=["DELETE"])
@token_required
@require_admin
def delete_teacher(teacher_id):
    current_app.db.users.delete_one({"_id": ObjectId(teacher_id)})
    return jsonify({"message": "Teacher deleted"}), 200

# ── GET TEACHER'S ASSIGNED COURSES ──
@teacher_bp.route("/my-courses", methods=["GET"])
@token_required
@require_teacher
def my_courses():
    db   = current_app.db
    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    if not user:
        return jsonify([]), 200

    courses = []
    for cid in user.get("assigned_courses", []):
        try:
            course = db.courses.find_one({"_id": ObjectId(cid)})
            if course:
                course["_id"] = str(course["_id"])
                course.pop("created_at", None)
                # Get enrolled student count
                count = db.users.count_documents({
                    "enrolled_courses": str(course["_id"]),
                    "is_teacher": {"$ne": True},
                    "is_admin": {"$ne": True}
                })
                course["student_count"] = count
                courses.append(course)
        except Exception:
            pass

    return jsonify(courses), 200

# ── TEACHER PROFILE ──
@teacher_bp.route("/me", methods=["GET"])
@token_required
@require_teacher
def teacher_me():
    db   = current_app.db
    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    if not user:
        return jsonify({"error": "Not found"}), 404
    return jsonify({
        "name":             user["name"],
        "email":            user["email"],
        "assigned_courses": user.get("assigned_courses", [])
    }), 200
