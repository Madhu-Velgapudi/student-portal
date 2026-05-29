from datetime import datetime

def new_assignment(course_id, course_name, course_code, title, description, due_date, total_marks, posted_by):
    return {
        "course_id":   course_id,
        "course_name": course_name,
        "course_code": course_code,
        "title":       title,
        "description": description,
        "due_date":    due_date,
        "total_marks": total_marks,
        "posted_by":   posted_by,
        "created_at":  datetime.utcnow()
    }

def new_submission(assignment_id, student_id, student_name, answer, submitted_at=None):
    return {
        "assignment_id": assignment_id,
        "student_id":    student_id,
        "student_name":  student_name,
        "answer":        answer,
        "grade":         None,
        "feedback":      None,
        "status":        "submitted",
        "submitted_at":  submitted_at or datetime.utcnow()
    }