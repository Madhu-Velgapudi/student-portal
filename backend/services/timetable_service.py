from bson import ObjectId
from models.timetable import build_timetable

def get_student_timetable(db, user_id: str) -> dict:
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {}

    enrolled_ids = [ObjectId(cid) for cid in user.get("enrolled_courses", [])]
    if not enrolled_ids:
        return {}

    courses = list(db.courses.find({"_id": {"$in": enrolled_ids}}))
    return build_timetable(courses)