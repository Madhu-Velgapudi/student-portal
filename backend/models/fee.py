from datetime import datetime

def new_fee(student_id, student_name, fee_type, amount, due_date, semester, academic_year):
    """
    fee_type: 'tuition' | 'exam' | 'library' | 'hostel' | 'other'
    """
    return {
        "student_id":    student_id,
        "student_name":  student_name,
        "fee_type":      fee_type,
        "amount":        amount,
        "due_date":      due_date,
        "semester":      semester,
        "academic_year": academic_year,
        "status":        "pending",
        "paid_at":       None,
        "created_at":    datetime.utcnow()
    }