from datetime import datetime

def new_announcement(title, message, posted_by="Admin", priority="normal"):
    """
    priority: 'normal' | 'important' | 'urgent'
    """
    return {
        "title":     title,
        "message":   message,
        "posted_by": posted_by,
        "priority":  priority,
        "is_active": True,
        "created_at": datetime.utcnow()
    }