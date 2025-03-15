from models import db, Attendance, Class, Student, User
from sqlalchemy import and_, or_
from datetime import datetime

def get_attendance_records(instructor_id, class_id=None, student_name=None, 
                         date_start=None, date_end=None, page=1, per_page=10, export=False):
    """
    Get filtered attendance records with pagination
    """
    # Base query - join all necessary tables
    query = db.session.query(
        Attendance, Student, Class
    ).join(
        Student, Attendance.student_id == Student.id
    ).join(
        Class, Attendance.class_id == Class.id
    ).filter(
        Class.instructor_id == instructor_id,
        Attendance.archived == False  # Don't show archived records
    )
    
    # Apply filters if provided
    if class_id:
        query = query.filter(Class.id == class_id)
        
    if student_name:
        query = query.filter(
            or_(
                Student.first_name.like(f'%{student_name}%'),
                Student.last_name.like(f'%{student_name}%')
            )
        )
        
    if date_start:
        query = query.filter(Attendance.date >= date_start)
        
    if date_end:
        query = query.filter(Attendance.date <= date_end)
    
    # Get total count for pagination
    total_count = query.count()
    
    # If export, get all records, otherwise paginate
    if export:
        results = query.all()
    else:
        results = query.order_by(Attendance.date.desc()).offset((page - 1) * per_page).limit(per_page).all()
    
    # Format results
    records = []
    for attendance, student, class_obj in results:
        records.append({
            'id': attendance.id,
            'date': attendance.date.strftime('%Y-%m-%d'),
            'status': attendance.status,
            'comment': attendance.comment,
            'student_id': student.student_id,
            'student_name': f"{student.first_name} {student.last_name}",
            'class_id': class_obj.class_id,
            'class_name': class_obj.name
        })
    
    return records, total_count

def update_attendance_record(record_id, instructor_id, status, comment):
    """
    Update an attendance record status and comment
    """
    # Get the attendance record
    attendance = db.session.query(Attendance).join(
        Class, Attendance.class_id == Class.id
    ).filter(
        Attendance.id == record_id,
        Class.instructor_id == instructor_id,
        Attendance.archived == False
    ).first()
    
    # Check if record exists and instructor has permission
    if not attendance:
        return False, "Record not found or you don't have permission to edit it", None
    
    # Update the record
    attendance.status = status
    attendance.comment = comment
    attendance.updated_at = datetime.now()
    
    try:
        db.session.commit()
        
        # Get student and class info for the updated record
        student = Student.query.get(attendance.student_id)
        class_obj = Class.query.get(attendance.class_id)
        
        # Format the updated record
        updated_record = {
            'id': attendance.id,
            'date': attendance.date.strftime('%Y-%m-%d'),
            'status': attendance.status,
            'comment': attendance.comment,
            'student_id': student.student_id,
            'student_name': f"{student.first_name} {student.last_name}",
            'class_id': class_obj.class_id,
            'class_name': class_obj.name
        }
        
        return True, "Record updated successfully", updated_record
        
    except Exception as e:
        db.session.rollback()
        return False, f"Error updating record: {str(e)}", None

def archive_attendance_record(record_id, instructor_id):
    """
    Archive (soft delete) an attendance record
    """
    # Get the attendance record
    attendance = db.session.query(Attendance).join(
        Class, Attendance.class_id == Class.id
    ).filter(
        Attendance.id == record_id,
        Class.instructor_id == instructor_id,
        Attendance.archived == False
    ).first()
    
    # Check if record exists and instructor has permission
    if not attendance:
        return False, "Record not found or you don't have permission to archive it"
    
    # Soft delete by setting archived flag
    attendance.archived = True
    attendance.archived_at = datetime.now()
    
    try:
        db.session.commit()
        return True, "Record archived successfully"
        
    except Exception as e:
        db.session.rollback()
        return False, f"Error archiving record: {str(e)}" 