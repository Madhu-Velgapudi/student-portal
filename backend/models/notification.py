from datetime import datetime

def new_notification(student_id, notif_type, title, message, icon="🔔"):
    """
    notif_type: 'class_today' | 'class_tomorrow' | 'low_attendance' | 'no_class'
    """
    return {
        "student_id": student_id,
        "type":       notif_type,
        "icon":       icon,
        "title":      title,
        "message":    message,
        "is_read":    False,
        "created_at": datetime.utcnow()
    }