from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from models import db, User, Class, Enrollment, Attendance
from datetime import datetime, timedelta

student_bp = Blueprint('student', __name__, url_prefix='/student')

# Middleware to check if user is student
@student_bp.before_request
def check_student():
    if not current_user.is_authenticated or current_user.role != 'student':
        flash('You do not have permission to access this page.', 'error')
        return redirect(url_for('auth.login'))

@student_bp.route('/dashboard')
@login_required
def dashboard():
    # Get current student's ID from logged-in user
    student_id = current_user.id
    
    # Get student's enrollments and classes
    enrollments = db.session.query(
        Enrollment, Class
    ).join(
        Class, Enrollment.class_id == Class.class_id
    ).filter(
        Enrollment.student_id == student_id,
        Enrollment.status == 'Active'
    ).all()
    
    # Get recent attendance for this student
    recent_attendance = db.session.query(
        Attendance, Class
    ).join(
        Class, Attendance.class_id == Class.class_id
    ).filter(
        Attendance.student_id == student_id
    ).order_by(Attendance.date.desc()).limit(5).all()
    
    # Calculate attendance statistics
    total_attendance = Attendance.query.filter_by(student_id=student_id).count()
    present_count = Attendance.query.filter_by(student_id=student_id, status='Present').count()
    absent_count = Attendance.query.filter_by(student_id=student_id, status='Absent').count()
    late_count = Attendance.query.filter_by(student_id=student_id, status='Late').count()
    
    # Calculate attendance rate (if there are records)
    attendance_rate = round((present_count / total_attendance) * 100) if total_attendance > 0 else 0
    
    # Get upcoming classes (next 7 days)
    today = datetime.now().date()
    next_week = today + timedelta(days=7)
    
    # In a real app, you would filter by scheduled dates
    # For now, we'll just pass all active enrollments
    upcoming_classes = enrollments[:3]  # Just showing first 3 for demo
    
    return render_template('student/dashboard.html',
                           active_page='dashboard',
                           student=current_user,
                           enrollments=enrollments,
                           recent_attendance=recent_attendance,
                           total_attendance=total_attendance,
                           present_count=present_count,
                           absent_count=absent_count,
                           late_count=late_count,
                           attendance_rate=attendance_rate,
                           upcoming_classes=upcoming_classes)

@student_bp.route('/attendance-history')
@login_required
def attendance_history():
    # Get current student's ID
    student_id = current_user.id
    
    # Get filter parameters
    class_filter = request.args.get('class_id', '')
    status_filter = request.args.get('status', '')
    date_start = request.args.get('date_start', '')
    date_end = request.args.get('date_end', '')
    
    # Get student's classes for dropdown
    classes = db.session.query(Class).join(
        Enrollment, Class.class_id == Enrollment.class_id
    ).filter(
        Enrollment.student_id == student_id
    ).all()
    
    # Get attendance records with filtering
    query = db.session.query(Attendance, Class).join(
        Class, Attendance.class_id == Class.class_id
    ).filter(
        Attendance.student_id == student_id
    )
    
    if class_filter:
        query = query.filter(Class.class_id == class_filter)
    
    if status_filter:
        query = query.filter(Attendance.status == status_filter)
    
    if date_start:
        query = query.filter(Attendance.date >= datetime.strptime(date_start, '%Y-%m-%d').date())
    
    if date_end:
        query = query.filter(Attendance.date <= datetime.strptime(date_end, '%Y-%m-%d').date())
    
    # Get attendances ordered by date (most recent first)
    attendances = query.order_by(Attendance.date.desc()).all()
    
    # Group by month for display
    attendance_by_month = {}
    for record in attendances:
        month_str = record[0].date.strftime('%B %Y')
        if month_str not in attendance_by_month:
            attendance_by_month[month_str] = []
        attendance_by_month[month_str].append(record)
    
    return render_template('student/attendance_history.html',
                           active_page='attendance_history',
                           student=current_user,
                           classes=classes,
                           attendances=attendances,
                           attendance_by_month=attendance_by_month,
                           class_filter=class_filter,
                           status_filter=status_filter,
                           date_start=date_start,
                           date_end=date_end)

@student_bp.route('/enrolment')
@login_required
def enrolment():
    # Get current student's ID
    student_id = current_user.id
    
    # Get all of student's enrollments (active and inactive)
    enrollments = db.session.query(
        Enrollment, Class
    ).join(
        Class, Enrollment.class_id == Class.class_id
    ).filter(
        Enrollment.student_id == student_id
    ).order_by(Enrollment.status).all()
    
    return render_template('student/enrollment.html',
                           active_page='enrollment',
                           student=current_user,
                           enrollments=enrollments) 