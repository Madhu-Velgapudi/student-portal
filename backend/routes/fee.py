from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.fee import new_fee
from datetime import datetime

fee_bp = Blueprint("fee", __name__)

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

def serialize(doc):
    doc["_id"] = str(doc["_id"])
    if "created_at" in doc:
        doc["created_at"] = doc["created_at"].strftime("%d %b %Y")
    if "paid_at" in doc and doc["paid_at"]:
        doc["paid_at"] = doc["paid_at"].strftime("%d %b %Y")
    return doc

# ── GET MY FEES (student) ──
@fee_bp.route("/my", methods=["GET"])
@token_required
def get_my_fees():
    db   = current_app.db
    fees = list(db.fees.find({"student_id": request.user_id}))
    fees.sort(key=lambda x: x.get("due_date", ""))

    total     = sum(f["amount"] for f in fees)
    paid      = sum(f["amount"] for f in fees if f["status"] == "paid")
    pending   = sum(f["amount"] for f in fees if f["status"] == "pending")
    overdue   = sum(f["amount"] for f in fees if f["status"] == "overdue")

    return jsonify({
        "fees":    [serialize(f) for f in fees],
        "summary": {
            "total":   total,
            "paid":    paid,
            "pending": pending,
            "overdue": overdue
        }
    }), 200

# ── ADD FEE (admin) ──
@fee_bp.route("/", methods=["POST"])
@token_required
@require_admin
def add_fee():
    db   = current_app.db
    data = request.get_json()

    student_id    = data.get("student_id")
    fee_type      = data.get("fee_type", "tuition")
    amount        = float(data.get("amount", 0))
    due_date      = data.get("due_date")
    semester      = data.get("semester", "1")
    academic_year = data.get("academic_year", "2024-25")

    if not all([student_id, amount, due_date]):
        return jsonify({"error": "student_id, amount and due_date are required"}), 400

    student = db.users.find_one({"_id": ObjectId(student_id)})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    fee    = new_fee(student_id, student["name"], fee_type, amount, due_date, semester, academic_year)
    result = db.fees.insert_one(fee)
    return jsonify({"message": "Fee added", "id": str(result.inserted_id)}), 201

# ── ADD FEE FOR ALL STUDENTS (admin) ──
@fee_bp.route("/bulk", methods=["POST"])
@token_required
@require_admin
def add_fee_bulk():
    db   = current_app.db
    data = request.get_json()

    fee_type      = data.get("fee_type", "tuition")
    amount        = float(data.get("amount", 0))
    due_date      = data.get("due_date")
    semester      = data.get("semester", "1")
    academic_year = data.get("academic_year", "2024-25")

    students = list(db.users.find({
        "is_admin":   {"$ne": True},
        "is_teacher": {"$ne": True},
        "is_verified": True
    }))

    fees = []
    for s in students:
        fees.append(new_fee(
            str(s["_id"]), s["name"],
            fee_type, amount, due_date,
            semester, academic_year
        ))

    if fees:
        db.fees.insert_many(fees)

    return jsonify({"message": f"Fee added for {len(fees)} students"}), 201

# ── MARK FEE AS PAID (admin) ──
@fee_bp.route("/<fee_id>/pay", methods=["POST"])
@token_required
@require_admin
def mark_paid(fee_id):
    current_app.db.fees.update_one(
        {"_id": ObjectId(fee_id)},
        {"$set": {"status": "paid", "paid_at": datetime.utcnow()}}
    )
    return jsonify({"message": "Fee marked as paid"}), 200

# ── DELETE FEE (admin) ──
@fee_bp.route("/<fee_id>", methods=["DELETE"])
@token_required
@require_admin
def delete_fee(fee_id):
    current_app.db.fees.delete_one({"_id": ObjectId(fee_id)})
    return jsonify({"message": "Fee deleted"}), 200

# ── GET ALL FEES (admin) ──
@fee_bp.route("/all", methods=["GET"])
@token_required
@require_admin
def get_all_fees():
    db   = current_app.db
    fees = list(db.fees.find())
    return jsonify([serialize(f) for f in fees]), 200

# ── GET FEES BY STUDENT (admin) ──
@fee_bp.route("/student/<student_id>", methods=["GET"])
@token_required
@require_admin
def get_student_fees(student_id):
    db   = current_app.db
    fees = list(db.fees.find({"student_id": student_id}))
    return jsonify([serialize(f) for f in fees]), 200