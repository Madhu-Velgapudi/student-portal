DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

def build_timetable(enrolled_courses):
    """
    Takes a list of course dicts (with slots) and returns
    a structured timetable dict keyed by day.
    """
    timetable = {day: [] for day in DAYS_ORDER}

    for course in enrolled_courses:
        for slot in course.get("slots", []):
            day = slot.get("day")
            if day in timetable:
                timetable[day].append({
                    "course_name": course["name"],
                    "course_code": course["code"],
                    "start": slot["start"],
                    "end": slot["end"],
                    "room": slot.get("room", "TBD"),
                    "credits": course["credits"]
                })

    # Sort each day's slots by start time
    for day in timetable:
        timetable[day].sort(key=lambda x: x["start"])

    return timetable