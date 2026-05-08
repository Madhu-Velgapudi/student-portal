from datetime import datetime

def new_attendance_record(student_id, course_id, course_code, slot_day, slot_time, status):
    """
    status: 'present' | 'absent'
    """
    return {
        "student_id":  student_id,
        "course_id":   course_id,
        "course_code": course_code,
        "slot_day":    slot_day,
        "slot_time":   slot_time,
        "status":      status,
        "date":        datetime.utcnow().strftime("%Y-%m-%d"),
        "marked_at":   datetime.utcnow()
    }