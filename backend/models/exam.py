from datetime import datetime

def new_exam(course_id, course_name, course_code, exam_type, date, start_time, end_time, room, total_marks):
    """
    exam_type: 'midterm' | 'final' | 'quiz' | 'practical'
    """
    return {
        "course_id":   course_id,
        "course_name": course_name,
        "course_code": course_code,
        "exam_type":   exam_type,
        "date":        date,
        "start_time":  start_time,
        "end_time":    end_time,
        "room":        room,
        "total_marks": total_marks,
        "created_at":  datetime.utcnow()
    }