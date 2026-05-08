from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from services.auth_service import check_password, hash_password

profile_bp = Blueprint("profile", __name__)

@profile_bp.route("/", methods=["GET"])
@token_required
def get_profile():
    db = current_app.db
    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    enrolled_count = len(user.get("enrolled_courses", []))
    return jsonify({
        "name":             user["name"],
        "email":            user["email"],
        "avatar_color":     user.get("avatar_color", "#2d5be3"),
        "enrolled_count":   enrolled_count,
        "created_at":       user["created_at"].strftime("%B %Y") if user.get("created_at") else "—"
    }), 200


@profile_bp.route("/update", methods=["POST"])
@token_required
def update_profile():
    db   = current_app.db
    data = request.get_json()
    name         = data.get("name", "").strip()
    avatar_color = data.get("avatar_color", "").strip()

    if not name:
        return jsonify({"error": "Name cannot be empty"}), 400

    update_fields = {"name": name}
    if avatar_color:
        update_fields["avatar_color"] = avatar_color

    db.users.update_one(
        {"_id": ObjectId(request.user_id)},
        {"$set": update_fields}
    )
    return jsonify({"message": "Profile updated successfully"}), 200


@profile_bp.route("/change-password", methods=["POST"])
@token_required
def change_password():
    db   = current_app.db
    data = request.get_json()

    current_pw = data.get("current_password", "")
    new_pw     = data.get("new_password", "")

    if not current_pw or not new_pw:
        return jsonify({"error": "Both fields are required"}), 400

    if len(new_pw) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    if not check_password(current_pw, user["password"]):
        return jsonify({"error": "Current password is incorrect"}), 401

    db.users.update_one(
        {"_id": ObjectId(request.user_id)},
        {"$set": {"password": hash_password(new_pw)}}
    )
    return jsonify({"message": "Password changed successfully"}), 200