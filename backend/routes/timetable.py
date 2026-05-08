from flask import Blueprint, jsonify, current_app, request
from middleware.auth_middleware import token_required
from services.timetable_service import get_student_timetable

timetable_bp = Blueprint("timetable", __name__)

@timetable_bp.route("/", methods=["GET"])
@token_required
def get_timetable():
    db = current_app.db
    timetable = get_student_timetable(db, request.user_id)
    return jsonify(timetable), 200