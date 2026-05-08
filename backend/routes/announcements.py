from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.announcement import new_announcement

announcements_bp = Blueprint("announcements", __name__)

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
        doc["created_at"] = doc["created_at"].strftime("%d %b %Y, %I:%M %p")
    return doc

# ── GET ALL ACTIVE ANNOUNCEMENTS (students) ──
@announcements_bp.route("/", methods=["GET"])
@token_required
def get_announcements():
    db    = current_app.db
    items = list(db.announcements.find({"is_active": True}))
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return jsonify([serialize(i) for i in items]), 200

# ── GET UNREAD COUNT ──
@announcements_bp.route("/count", methods=["GET"])
@token_required
def get_count():
    db    = current_app.db
    count = db.announcements.count_documents({"is_active": True})
    return jsonify({"count": count}), 200

# ── POST ANNOUNCEMENT (admin/teacher only) ──
@announcements_bp.route("/", methods=["POST"])
@token_required
@require_admin_or_teacher
def post_announcement():
    db   = current_app.db
    data = request.get_json()

    title    = data.get("title", "").strip()
    message  = data.get("message", "").strip()
    priority = data.get("priority", "normal")

    if not title or not message:
        return jsonify({"error": "Title and message are required"}), 400

    user      = db.users.find_one({"_id": ObjectId(request.user_id)})
    posted_by = user["name"] if user else "Admin"

    item   = new_announcement(title, message, posted_by, priority)
    result = db.announcements.insert_one(item)
    return jsonify({"message": "Announcement posted", "id": str(result.inserted_id)}), 201

# ── DELETE ANNOUNCEMENT ──
@announcements_bp.route("/<ann_id>", methods=["DELETE"])
@token_required
@require_admin_or_teacher
def delete_announcement(ann_id):
    current_app.db.announcements.delete_one({"_id": ObjectId(ann_id)})
    return jsonify({"message": "Announcement deleted"}), 200

# ── ALL ANNOUNCEMENTS (admin view) ──
@announcements_bp.route("/all", methods=["GET"])
@token_required
@require_admin_or_teacher
def get_all_announcements():
    db    = current_app.db
    items = list(db.announcements.find())
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return jsonify([serialize(i) for i in items]), 200