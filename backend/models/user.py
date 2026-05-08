from datetime import datetime

def new_user(name, email, hashed_password):
    return {
        "name": name,
        "email": email,
        "password": hashed_password,
        "is_verified": False,
        "verification_token": None,
        "enrolled_courses": [],       # list of course_ids
        "created_at": datetime.utcnow()
    }