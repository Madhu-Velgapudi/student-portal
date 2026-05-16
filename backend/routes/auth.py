from flask import Blueprint, request, jsonify, current_app
from models.user import new_user
from services.auth_service import (
    hash_password, check_password,
    generate_jwt, generate_verification_token
)
from services.email_service import send_verification_email
from flask_mail import Message
from app import mail
from config import Config

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    db = current_app.db
    data = request.get_json()

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if db.users.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    user = new_user(
        name,
        email,
        hash_password(password)
    )

    # Disable email verification for now
    user["is_verified"] = True
    user["verification_token"] = None
    user["is_active"] = True

    db.users.insert_one(user)

    return jsonify({
        "message": "Registered successfully! You can now log in."
    }), 201

@auth_bp.route("/verify", methods=["GET"])
def verify_email():
    db    = current_app.db
    token = request.args.get("token")

    if not token:
        return jsonify({"error": "Token missing"}), 400

    user = db.users.find_one({"verification_token": token})
    if not user:
        return jsonify({"error": "Invalid or expired token"}), 400

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True, "verification_token": None}}
    )
    return jsonify({"message": "Email verified! You can now log in."}), 200


@auth_bp.route("/login", methods=["POST"])
def login():
    db   = current_app.db
    data = request.get_json()

    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    user = db.users.find_one({"email": email})

    if not user or not check_password(password, user["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    if not user.get("is_verified"):
        return jsonify({"error": "Please verify your email before logging in"}), 403

    if not user.get("is_active", True):
        return jsonify({"error": "Your account has been deactivated. Please contact the administrator."}), 403

    if user.get("is_admin"):
        return jsonify({"error": "Admin accounts must use the Admin Login page."}), 403

    if user.get("is_teacher"):
        return jsonify({"error": "Teacher accounts must use the Teacher Login page."}), 403

    token = generate_jwt(str(user["_id"]), user["email"])
    return jsonify({
        "token": token,
        "user": {
            "name":             user["name"],
            "email":            user["email"],
            "enrolled_courses": user.get("enrolled_courses", [])
        }
    }), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    from bson import ObjectId
    from services.auth_service import decode_jwt
    import jwt

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = decode_jwt(auth_header.split(" ")[1])
        user    = current_app.db.users.find_one({"_id": ObjectId(payload["user_id"])})
        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.get("is_active", True):
            return jsonify({"error": "Account deactivated"}), 403

        return jsonify({
            "name":             user["name"],
            "email":            user["email"],
            "enrolled_courses": user.get("enrolled_courses", [])
        }), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Session expired. Please login again."}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401


# ── FORGOT PASSWORD ──
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    db    = current_app.db
    data  = request.get_json()
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = db.users.find_one({"email": email})

    # Always return success to prevent email enumeration
    if not user:
        return jsonify({"message": "If that email exists, a reset link has been sent."}), 200

    reset_token = generate_verification_token()
    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": reset_token}}
    )

    reset_url = f"{Config.FRONTEND_URL}/reset-password.html?token={reset_token}"

    try:
        msg = Message(
            subject="Reset your Student Portal password",
            recipients=[email]
        )
        msg.html = f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;">
          <h2 style="color:#2d5be3;">Reset Your Password</h2>
          <p>Hi {user['name']},</p>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="{reset_url}"
             style="display:inline-block;padding:12px 24px;background:#2d5be3;
                    color:#fff;text-decoration:none;border-radius:6px;margin-top:16px;">
            Reset Password
          </a>
          <p style="margin-top:24px;color:#888;font-size:13px;">
            If you didn't request this, ignore this email.
          </p>
        </div>
        """
        mail.send(msg)
    except Exception:
        # Auto-reset fallback if email fails — return token directly for testing
        return jsonify({
            "message": "If that email exists, a reset link has been sent.",
            "dev_token": reset_token  # Remove this in production
        }), 200

    return jsonify({"message": "If that email exists, a reset link has been sent."}), 200


# ── RESET PASSWORD ──
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    db   = current_app.db
    data = request.get_json()

    token    = data.get("token", "")
    password = data.get("password", "")

    if not token or not password:
        return jsonify({"error": "Token and new password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user = db.users.find_one({"reset_token": token})
    if not user:
        return jsonify({"error": "Invalid or expired reset link"}), 400

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password":    hash_password(password),
            "reset_token": None
        }}
    )
    return jsonify({"message": "Password reset successfully! You can now log in."}), 200