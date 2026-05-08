from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.course import new_course
from services.auth_service import check_password, generate_jwt, hash_password
from datetime import datetime
import os

admin_bp = Blueprint("admin", __name__)

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

# ── ADMIN LOGIN ──
@admin_bp.route("/login", methods=["POST"])
def admin_login():
    db   = current_app.db
    data = request.get_json()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = db.users.find_one({"email": email})
    if not user or not check_password(password, user["password"]):
        return jsonify({"error": "Invalid credentials"}), 401
    if not user.get("is_admin"):
        return jsonify({"error": "This account does not have admin access"}), 403

    token = generate_jwt(str(user["_id"]), user["email"])
    return jsonify({
        "token": token,
        "admin": {"name": user["name"], "email": user["email"]}
    }), 200

# ── ADMIN STATS ──
@admin_bp.route("/stats", methods=["GET"])
@token_required
@require_admin
def get_stats():
    db = current_app.db
    # Exclude admins and teachers from student count
    students = list(db.users.find({
        "is_admin":   {"$ne": True},
        "is_teacher": {"$ne": True}
    }))
    total_enrollments = sum(len(u.get("enrolled_courses", [])) for u in students)
    return jsonify({
        "total_students":    len(students),
        "total_courses":     db.courses.count_documents({}),
        "total_enrollments": total_enrollments,
        "verified_students": sum(1 for u in students if u.get("is_verified"))
    }), 200

# ── ALL STUDENTS WITH DETAILS ──
@admin_bp.route("/students", methods=["GET"])
@token_required
@require_admin
def get_students():
    db = current_app.db
    # Exclude admins and teachers
    students = list(db.users.find({
        "is_admin":   {"$ne": True},
        "is_teacher": {"$ne": True}
    }))
    result = []

    for u in students:
        uid          = str(u["_id"])
        enrolled_ids = u.get("enrolled_courses", [])

        courses = []
        for cid in enrolled_ids:
            try:
                course = db.courses.find_one({"_id": ObjectId(cid)})
                if course:
                    courses.append({
                        "id":      cid,
                        "name":    course["name"],
                        "code":    course["code"],
                        "credits": course["credits"]
                    })
            except Exception:
                pass

        att_records = list(db.attendance.find({"student_id": uid}))
        present     = sum(1 for r in att_records if r["status"] == "present")
        total       = len(att_records)
        att_pct     = round((present / total) * 100) if total > 0 else 0

        result.append({
            "_id":              uid,
            "name":             u["name"],
            "email":            u["email"],
            "is_verified":      u.get("is_verified", False),
            "is_active":        u.get("is_active", True),
            "enrolled_courses": courses,
            "total_credits":    sum(c["credits"] for c in courses),
            "attendance_pct":   att_pct,
            "created_at":       u["created_at"].strftime("%d %b %Y") if u.get("created_at") else "—"
        })

    return jsonify(result), 200

# ── SINGLE STUDENT DETAIL ──
@admin_bp.route("/students/<student_id>", methods=["GET"])
@token_required
@require_admin
def get_student_detail(student_id):
    db   = current_app.db
    user = db.users.find_one({"_id": ObjectId(student_id)})
    if not user:
        return jsonify({"error": "Student not found"}), 404

    courses = []
    for cid in user.get("enrolled_courses", []):
        try:
            course = db.courses.find_one({"_id": ObjectId(cid)})
            if course:
                courses.append({
                    "id":      cid,
                    "name":    course["name"],
                    "code":    course["code"],
                    "credits": course["credits"],
                    "slots":   course["slots"]
                })
        except Exception:
            pass

    att_records = list(db.attendance.find({"student_id": student_id}))
    att_summary = {}
    for r in att_records:
        cid = r["course_id"]
        if cid not in att_summary:
            att_summary[cid] = {"present": 0, "absent": 0}
        att_summary[cid][r["status"]] += 1

    for c in courses:
        att   = att_summary.get(c["id"], {"present": 0, "absent": 0})
        total = att["present"] + att["absent"]
        c["attendance"] = round((att["present"] / total) * 100) if total > 0 else 0

    return jsonify({
        "_id":     student_id,
        "name":    user["name"],
        "email":   user["email"],
        "courses": courses,
        "joined":  user["created_at"].strftime("%d %b %Y") if user.get("created_at") else "—"
    }), 200

# ── TOGGLE USER ──
@admin_bp.route("/users/<user_id>/toggle", methods=["POST"])
@token_required
@require_admin
def toggle_user(user_id):
    db   = current_app.db
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    new_status = not user.get("is_active", True)
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": new_status}})
    return jsonify({"message": f"User {'activated' if new_status else 'deactivated'}", "is_active": new_status}), 200

# ── DELETE USER ──
@admin_bp.route("/users/<user_id>", methods=["DELETE"])
@token_required
@require_admin
def delete_user(user_id):
    current_app.db.users.delete_one({"_id": ObjectId(user_id)})
    return jsonify({"message": "User deleted"}), 200

# ── GET ALL COURSES ──
@admin_bp.route("/courses", methods=["GET"])
@token_required
@require_admin
def get_courses():
    db      = current_app.db
    courses = list(db.courses.find())
    for c in courses:
        c["_id"] = str(c["_id"])
        c.pop("created_at", None)
    return jsonify(courses), 200

# ── ADD COURSE ──
@admin_bp.route("/courses", methods=["POST"])
@token_required
@require_admin
def add_course():
    db   = current_app.db
    data = request.get_json()
    name       = data.get("name", "").strip()
    code       = data.get("code", "").strip().upper()
    credits    = int(data.get("credits", 3))
    department = data.get("department", "").strip()
    slots      = data.get("slots", [])

    if not name or not code or not department:
        return jsonify({"error": "Name, code and department are required"}), 400
    if db.courses.find_one({"code": code}):
        return jsonify({"error": f"Course code {code} already exists"}), 409

    course = new_course(name, code, credits, department, slots)
    result = db.courses.insert_one(course)
    return jsonify({"message": f"Course {name} added", "id": str(result.inserted_id)}), 201

# ── DELETE COURSE ──
@admin_bp.route("/courses/<course_id>", methods=["DELETE"])
@token_required
@require_admin
def delete_course(course_id):
    db = current_app.db
    db.courses.delete_one({"_id": ObjectId(course_id)})
    db.users.update_many({}, {"$pull": {"enrolled_courses": course_id}})
    return jsonify({"message": "Course deleted"}), 200

# ── MAKE ADMIN (one-time setup) ──
@admin_bp.route("/make-admin", methods=["POST"])
def make_admin():
    db     = current_app.db
    data   = request.get_json()
    secret = data.get("secret")
    email  = data.get("email")

    if secret != os.getenv("ADMIN_SECRET", "admin-setup-secret"):
        return jsonify({"error": "Invalid secret"}), 403

    user = db.users.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.users.update_one({"_id": user["_id"]}, {"$set": {"is_admin": True}})
    return jsonify({"message": f"{email} is now an admin"}), 200