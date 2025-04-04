from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_required, current_user
from models import db, User, Class, Enrollment, Attendance
from datetime import datetime, date

instructor_bp = Blueprint('instructor', __name__, url_prefix='/instructor')

# Middleware to check if user is instructor
@instructor_bp.before_request
def check_instructor():
    if not current_user.is_authenticated or current_user.role != 'instructor':
        flash('You do not have permission to access this page.', 'error')
        return redirect(url_for('auth.login'))

@instructor_bp.route('/dashboard')
@login_required
def dashboard():
    # Get instructor data
    instructor_id = current_user.id
    
    # Get classes taught by this instructor
    classes = Class.query.filter_by(instructor_id=instructor_id).all()
    class_count = len(classes)
    
    # Get student count across all instructor's classes
    student_count = db.session.query(Enrollment).join(
        Class, Enrollment.class_id == Class.id
    ).filter(
        Class.instructor_id == instructor_id
    ).distinct(Enrollment.student_id).count()
    
    # Get upcoming classes for this week
    # In a real application, you would filter by date range
    upcoming_classes = classes[:3]  # Just take first 3 for demo
    
    # Get recently marked attendance
    recent_attendance = Attendance.query.join(
        Class, Attendance.class_id == Class.id
    ).filter(
        Class.instructor_id == instructor_id
    ).order_by(Attendance.date.desc()).limit(5).all()
    
    return render_template('instructor/dashboard.html',
                           active_page='dashboard',
                           classes=classes,
                           class_count=class_count,
                           student_count=student_count,
                           upcoming_classes=upcoming_classes,
                           recent_attendance=recent_attendance)

@instructor_bp.route('/mark-attendance')
@login_required
def mark_attendance():
    # Get instructor's classes
    instructor_id = current_user.id
    classes = Class.query.filter_by(instructor_id=instructor_id).all()
    
    # Get class ID from query parameters
    class_id = request.args.get('class_id', '')
    
    # Get enrolled students for the selected class
    students = []
    if class_id:
        # Get the class
        selected_class = Class.query.filter_by(id=class_id).first()
        
        if selected_class:
            # Get enrolled students
            students = db.session.query(User).join(
                Enrollment, User.id == Enrollment.student_id
            ).filter(
                Enrollment.class_id == class_id,
                User.role == 'Student',
                User.is_active == True
            ).all()
    
    # Get today's date formatted
    today = datetime.now().strftime('%Y-%m-%d')
    
    return render_template('instructor/mark_attendance.html', 
                           active_page='mark_attendance',
                           classes=classes,
                           selected_class_id=class_id,
                           students=students,
                           today=today)

@instructor_bp.route('/view-attendance')
@login_required
def view_attendance():
    # Get instructor's classes
    instructor_id = current_user.id
    
    # Get filter parameters
    class_id = request.args.get('class_id', '')
    date = request.args.get('date', '')
    student_name = request.args.get('student_name', '')
    
    # Get all classes for filter
    classes = Class.query.filter_by(instructor_id=instructor_id).all()
    
    # Get attendance records with filtering
    query = db.session.query(
        Attendance, User, Class
    ).join(
        User, Attendance.student_id == User.id
    ).join(
        Class, Attendance.class_id == Class.id
    ).filter(
        Class.instructor_id == instructor_id,
        User.role == 'Student'
    )
    
    if class_id:
        query = query.filter(Class.id == class_id)
    
    if date:
        query = query.filter(Attendance.date == datetime.strptime(date, '%Y-%m-%d'))
    
    if student_name:
        query = query.filter(
            (User.first_name.like(f'%{student_name}%')) |
            (User.last_name.like(f'%{student_name}%'))
        )
    
    # Sort by date (most recent first) then by class name
    query = query.order_by(Attendance.date.desc(), Class.name)
    
    # Get results
    attendances = query.all()
    
    # Group by date for display
    attendance_by_date = {}
    for record in attendances:
        date_str = record[0].date.strftime('%Y-%m-%d')
        if date_str not in attendance_by_date:
            attendance_by_date[date_str] = []
        attendance_by_date[date_str].append(record)
    
    return render_template('instructor/view_attendance.html',
                           active_page='view_attendance',
                           classes=classes,
                           attendance_by_date=attendance_by_date,
                           selected_class_id=class_id,
                           selected_date=date,
                           student_name=student_name,
                           total_records=len(attendances))

@instructor_bp.route('/instructor-profile')
@login_required
def instructor_profile():
    # Get the current instructor data
    instructor = User.query.filter_by(id=current_user.id).first()
    return render_template('instructor/profile.html', instructor=instructor) 