from datetime import datetime

def new_syllabus_week(course_id, week_number, topic, description=""):
    return {
        "course_id":   course_id,
        "type":        "syllabus",
        "week":        week_number,
        "topic":       topic,
        "description": description,
        "created_at":  datetime.utcnow()
    }

def new_material(course_id, title, material_type, url="", description="", posted_by="Admin"):
    """
    material_type: 'link' | 'note' | 'video' | 'pdf'
    """
    return {
        "course_id":   course_id,
        "type":        "material",
        "title":       title,
        "material_type": material_type,
        "url":         url,
        "description": description,
        "posted_by":   posted_by,
        "created_at":  datetime.utcnow()
    }

def new_course_announcement(course_id, title, message, posted_by="Admin"):
    return {
        "course_id":  course_id,
        "type":       "announcement",
        "title":      title,
        "message":    message,
        "posted_by":  posted_by,
        "created_at": datetime.utcnow()
    }