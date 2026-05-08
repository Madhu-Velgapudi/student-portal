from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.content import new_syllabus_week, new_material, new_course_announcement
from datetime import datetime

content_bp = Blueprint("content", __name__)

def serialize(doc):
    doc["_id"] = str(doc["_id"])
    if "created_at" in doc:
        doc["created_at"] = doc["created_at"].strftime("%d %b %Y, %I:%M %p")
    return doc

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

# ══════════════════════════════════════
# SYLLABUS
# ══════════════════════════════════════

@content_bp.route("/<course_id>/syllabus", methods=["GET"])
@token_required
def get_syllabus(course_id):
    db    = current_app.db
    items = list(db.content.find({"course_id": course_id, "type": "syllabus"}))
    items.sort(key=lambda x: x.get("week", 0))
    return jsonify([serialize(i) for i in items]), 200


@content_bp.route("/<course_id>/syllabus", methods=["POST"])
@token_required
@require_admin_or_teacher
def add_syllabus(course_id):
    db   = current_app.db
    data = request.get_json()
    week  = data.get("week")
    topic = data.get("topic", "").strip()
    desc  = data.get("description", "").strip()

    if not week or not topic:
        return jsonify({"error": "Week number and topic are required"}), 400

    # Check if week already exists
    existing = db.content.find_one({"course_id": course_id, "type": "syllabus", "week": int(week)})
    if existing:
        db.content.update_one(
            {"_id": existing["_id"]},
            {"$set": {"topic": topic, "description": desc}}
        )
        return jsonify({"message": f"Week {week} updated"}), 200

    item = new_syllabus_week(course_id, int(week), topic, desc)
    db.content.insert_one(item)
    return jsonify({"message": f"Week {week} added"}), 201


@content_bp.route("/<course_id>/syllabus/<item_id>", methods=["DELETE"])
@token_required
@require_admin_or_teacher
def delete_syllabus(course_id, item_id):
    current_app.db.content.delete_one({"_id": ObjectId(item_id), "course_id": course_id})
    return jsonify({"message": "Deleted"}), 200


# ══════════════════════════════════════
# MATERIALS
# ══════════════════════════════════════

@content_bp.route("/<course_id>/materials", methods=["GET"])
@token_required
def get_materials(course_id):
    db    = current_app.db
    items = list(db.content.find({"course_id": course_id, "type": "material"}))
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return jsonify([serialize(i) for i in items]), 200


@content_bp.route("/<course_id>/materials", methods=["POST"])
@token_required
@require_admin_or_teacher
def add_material(course_id):
    db   = current_app.db
    data = request.get_json()

    title         = data.get("title", "").strip()
    material_type = data.get("material_type", "link")
    url           = data.get("url", "").strip()
    description   = data.get("description", "").strip()

    if not title:
        return jsonify({"error": "Title is required"}), 400

    # Get poster name
    user      = db.users.find_one({"_id": ObjectId(request.user_id)})
    posted_by = user["name"] if user else "Admin"

    item = new_material(course_id, title, material_type, url, description, posted_by)
    db.content.insert_one(item)
    return jsonify({"message": f"Material '{title}' added"}), 201


@content_bp.route("/<course_id>/materials/<item_id>", methods=["DELETE"])
@token_required
@require_admin_or_teacher
def delete_material(course_id, item_id):
    current_app.db.content.delete_one({"_id": ObjectId(item_id), "course_id": course_id})
    return jsonify({"message": "Deleted"}), 200


# ══════════════════════════════════════
# COURSE ANNOUNCEMENTS
# ══════════════════════════════════════

@content_bp.route("/<course_id>/announcements", methods=["GET"])
@token_required
def get_course_announcements(course_id):
    db    = current_app.db
    items = list(db.content.find({"course_id": course_id, "type": "announcement"}))
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return jsonify([serialize(i) for i in items]), 200


@content_bp.route("/<course_id>/announcements", methods=["POST"])
@token_required
@require_admin_or_teacher
def add_course_announcement(course_id):
    db   = current_app.db
    data = request.get_json()

    title   = data.get("title", "").strip()
    message = data.get("message", "").strip()

    if not title or not message:
        return jsonify({"error": "Title and message are required"}), 400

    user      = db.users.find_one({"_id": ObjectId(request.user_id)})
    posted_by = user["name"] if user else "Admin"

    item = new_course_announcement(course_id, title, message, posted_by)
    db.content.insert_one(item)
    return jsonify({"message": "Announcement posted"}), 201


@content_bp.route("/<course_id>/announcements/<item_id>", methods=["DELETE"])
@token_required
@require_admin_or_teacher
def delete_course_announcement(course_id, item_id):
    current_app.db.content.delete_one({"_id": ObjectId(item_id), "course_id": course_id})
    return jsonify({"message": "Deleted"}), 200


# ══════════════════════════════════════
# GET ALL CONTENT FOR A COURSE (single call)
# ══════════════════════════════════════

@content_bp.route("/<course_id>/all", methods=["GET"])
@token_required
def get_all_content(course_id):
    db    = current_app.db
    items = list(db.content.find({"course_id": course_id}))

    syllabus      = sorted([serialize(i) for i in items if i["type"] == "syllabus"],      key=lambda x: x.get("week", 0))
    materials     = sorted([serialize(i) for i in items if i["type"] == "material"],      key=lambda x: x["created_at"], reverse=True)
    announcements = sorted([serialize(i) for i in items if i["type"] == "announcement"],  key=lambda x: x["created_at"], reverse=True)

    # Get course info
    try:
        course = db.courses.find_one({"_id": ObjectId(course_id)})
        course_info = {
            "name":       course["name"],
            "code":       course["code"],
            "department": course["department"],
            "credits":    course["credits"]
        } if course else {}
    except Exception:
        course_info = {}

    return jsonify({
        "course":        course_info,
        "syllabus":      syllabus,
        "materials":     materials,
        "announcements": announcements
    }), 200