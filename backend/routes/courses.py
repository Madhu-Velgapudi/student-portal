from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from middleware.auth_middleware import token_required
from models.course import SEED_COURSES

courses_bp = Blueprint("courses", __name__)

def serialize_course(c):
    c["_id"] = str(c["_id"])
    c.pop("created_at", None)
    return c

@courses_bp.route("/", methods=["GET"])
@token_required
def get_all_courses():
    db = current_app.db
    courses = list(db.courses.find())
    return jsonify([serialize_course(c) for c in courses]), 200


@courses_bp.route("/enrolled", methods=["GET"])
@token_required
def get_enrolled():
    db   = current_app.db
    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    enrolled_ids = [ObjectId(cid) for cid in user.get("enrolled_courses", [])]
    courses = list(db.courses.find({"_id": {"$in": enrolled_ids}}))
    return jsonify([serialize_course(c) for c in courses]), 200


@courses_bp.route("/enroll", methods=["POST"])
@token_required
def enroll():
    db        = current_app.db
    data      = request.get_json()
    course_id = data.get("course_id")

    if not course_id:
        return jsonify({"error": "course_id required"}), 400

    course = db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    user = db.users.find_one({"_id": ObjectId(request.user_id)})
    if course_id in user.get("enrolled_courses", []):
        return jsonify({"error": "Already enrolled"}), 409

    db.users.update_one(
        {"_id": ObjectId(request.user_id)},
        {"$push": {"enrolled_courses": course_id}}
    )
    return jsonify({"message": f"Enrolled in {course['name']}"}), 200


@courses_bp.route("/drop", methods=["POST"])
@token_required
def drop():
    db        = current_app.db
    data      = request.get_json()
    course_id = data.get("course_id")

    if not course_id:
        return jsonify({"error": "course_id required"}), 400

    db.users.update_one(
        {"_id": ObjectId(request.user_id)},
        {"$pull": {"enrolled_courses": course_id}}
    )
    return jsonify({"message": "Course dropped"}), 200


@courses_bp.route("/seed", methods=["POST"])
def seed_courses():
    """One-time seed endpoint — call once to populate courses collection."""
    db = current_app.db
    if db.courses.count_documents({}) > 0:
        return jsonify({"message": "Courses already seeded"}), 200
    db.courses.insert_many(SEED_COURSES)
    return jsonify({"message": f"Seeded {len(SEED_COURSES)} courses"}), 201