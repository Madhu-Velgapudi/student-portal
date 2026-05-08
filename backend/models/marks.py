from datetime import datetime

def new_mark(student_id, course_id, course_name, course_code, credits, marks, posted_by):
    """
    marks: score out of 100
    """
    grade, points = get_grade(marks)
    return {
        "student_id":   student_id,
        "course_id":    course_id,
        "course_name":  course_name,
        "course_code":  course_code,
        "credits":      credits,
        "marks":        marks,
        "grade":        grade,
        "grade_points": points,
        "posted_by":    posted_by,
        "created_at":   datetime.utcnow(),
        "updated_at":   datetime.utcnow()
    }

def get_grade(marks):
    if marks >= 91: return ("S", 10.0)
    if marks >= 81: return ("A", 9.0)
    if marks >= 71: return ("B", 8.0)
    if marks >= 61: return ("C", 7.0)
    if marks >= 50: return ("D", 6.0)
    return ("F", 0.0)