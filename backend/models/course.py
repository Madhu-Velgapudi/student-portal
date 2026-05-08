from datetime import datetime

def new_course(name, code, credits, department, slots):
    """
    slots: list of dicts like [{"day": "Monday", "start": "09:00", "end": "10:00", "room": "A101"}]
    """
    return {
        "name": name,
        "code": code,
        "credits": credits,
        "department": department,
        "slots": slots,
        "created_at": datetime.utcnow()
    }

# Seed data — call once to populate courses
SEED_COURSES = [
    {
        "name": "Data Structures",
        "code": "CS101",
        "credits": 4,
        "department": "Computer Science",
        "slots": [
            {"day": "Monday",    "start": "09:00", "end": "10:00", "room": "A101"},
            {"day": "Wednesday", "start": "09:00", "end": "10:00", "room": "A101"},
        ]
    },
    {
        "name": "Database Management",
        "code": "CS102",
        "credits": 3,
        "department": "Computer Science",
        "slots": [
            {"day": "Tuesday",  "start": "11:00", "end": "12:00", "room": "B202"},
            {"day": "Thursday", "start": "11:00", "end": "12:00", "room": "B202"},
        ]
    },
    {
        "name": "Operating Systems",
        "code": "CS103",
        "credits": 4,
        "department": "Computer Science",
        "slots": [
            {"day": "Monday",  "start": "14:00", "end": "15:00", "room": "C303"},
            {"day": "Friday",  "start": "14:00", "end": "15:00", "room": "C303"},
        ]
    },
    {
        "name": "Computer Networks",
        "code": "CS104",
        "credits": 3,
        "department": "Computer Science",
        "slots": [
            {"day": "Tuesday",   "start": "09:00", "end": "10:00", "room": "A105"},
            {"day": "Thursday",  "start": "09:00", "end": "10:00", "room": "A105"},
        ]
    },
    {
        "name": "Web Development",
        "code": "CS105",
        "credits": 3,
        "department": "Computer Science",
        "slots": [
            {"day": "Wednesday", "start": "14:00", "end": "15:00", "room": "Lab1"},
            {"day": "Friday",    "start": "10:00", "end": "11:00", "room": "Lab1"},
        ]
    },
    {
        "name": "Machine Learning",
        "code": "CS106",
        "credits": 4,
        "department": "Computer Science",
        "slots": [
            {"day": "Monday",    "start": "11:00", "end": "12:00", "room": "D404"},
            {"day": "Thursday",  "start": "14:00", "end": "15:00", "room": "D404"},
        ]
    },
]