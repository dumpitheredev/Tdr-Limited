from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, make_response
from flask_login import login_required, current_user
from models import db, User, Class, Enrollment, Attendance, Company
from datetime import datetime
import csv
from io import StringIO

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# Middleware to check if user is admin
@admin_bp.before_request
def check_admin():
    if not current_user.is_authenticated or current_user.role != 'admin':
        flash('You do not have permission to access this page.', 'error')
        return redirect(url_for('auth.login'))

@admin_bp.route('/dashboard')
@login_required
def dashboard():
    # Get dashboard stats
    student_count = User.query.filter_by(role='student').count()
    instructor_count = User.query.filter_by(role='instructor').count()
    
    # Use try-except for Class queries that might fail due to schema mismatches
    try:
        class_count = Class.query.count()
    except Exception as e:
        print(f"Error counting classes: {e}")
        class_count = 0
    
    return render_template('admin/dashboard.html', 
                           active_page='dashboard',
                           student_count=student_count,
                           instructor_count=instructor_count,
                           class_count=class_count)

@admin_bp.route('/admin-profile')
@login_required
def admin_profile():
    # Get the current admin user data
    admin = User.query.filter_by(id=current_user.id).first()
    return render_template('admin/profile.html', 
                           active_page='admin_profile',
                           admin=admin)

@admin_bp.route('/user-management')
@login_required
def user_management():
    # Get filter parameters
    role_filter = request.args.get('role', '')
    status_filter = request.args.get('status', '')
    search = request.args.get('search', '')
    
    # Get all users for stats
    all_users = User.query.all()
    total_users = len(all_users)
    active_users = len([u for u in all_users if u.is_active])
    inactive_users = total_users - active_users
    
    # Get all users (later we'll add filtering)
    query = User.query
    
    # Apply filters
    if role_filter:
        query = query.filter(User.role == role_filter)
    
    if status_filter:
        is_active = status_filter == 'Active'
        query = query.filter(User.is_active == is_active)
    
    if search:
        query = query.filter(
            (User.first_name.like(f'%{search}%')) |
            (User.last_name.like(f'%{search}%')) |
            (User.email.like(f'%{search}%'))
        )
    
    users = query.all()
    
    return render_template('admin/user_management.html', 
                          active_page='user_management',
                          users=users,
                          total_users=total_users,
                          active_users=active_users,
                          inactive_users=inactive_users,
                          role_filter=role_filter,
                          status_filter=status_filter,
                          search_term=search)

@admin_bp.route('/student-management')
@login_required
def student_management():
    # Get filter parameters
    status_filter = request.args.get('status', '')
    search = request.args.get('search', '')
    
    # Get all students for stats
    all_students = User.query.filter_by(role='Student').all()
    total_students = len(all_students)
    active_students = len([s for s in all_students if s.is_active])
    inactive_students = total_students - active_students
    
    # Get filtered students
    query = User.query.filter_by(role='Student')
    
    if status_filter:
        is_active = status_filter == 'Active'
        query = query.filter(User.is_active == is_active)
    
    if search:
        query = query.filter(
            (User.first_name.like(f'%{search}%')) |
            (User.last_name.like(f'%{search}%')) |
            (User.email.like(f'%{search}%')) |
            (User.id.like(f'%{search}%'))
        )
    
    students = query.all()
    
    return render_template('admin/student_management.html',
                           active_page='student_management',
                           students=students,
                           total_students=total_students,
                           active_students=active_students,
                           inactive_students=inactive_students,
                           status_filter=status_filter,
                           search_term=search)

@admin_bp.route('/class-management')
@login_required
def class_management():
    # Use try-except for Class queries that might fail due to schema mismatches
    try:
        classes = Class.query.all()
    except Exception as e:
        print(f"Error fetching classes: {e}")
        classes = []
    
    # Get instructors with properly formatted fields for the dropdown
    instructors = User.query.filter_by(role='Instructor').all()
    
    return render_template('admin/class_management.html', 
                           active_page='class_management',
                           classes=classes,
                           instructors=instructors,
                           total_classes=len(classes))

@admin_bp.route('/enrolment-management')
@login_required
def enrolment_management():
    # Get all students for the dropdowns
    students = User.query.filter_by(role='student', is_active=True).all()
    
    # Use try-except for Class and Enrollment queries that might fail
    try:
        # Get all enrollments with student and class info
        enrollments = db.session.query(
            Enrollment, User, Class
        ).join(
            User, Enrollment.student_id == User.id
        ).join(
            Class, Enrollment.class_id == Class.id
        ).filter(
            User.role == 'student'
        ).all()
        
        classes = Class.query.filter_by(status='Active').all()
        
        # Calculate pagination variables
        total_enrollments = len(enrollments)
        active_enrollments = len([e for e in enrollments if e[0].status == 'Active'])
        completed_enrollments = len([e for e in enrollments if e[0].status == 'Completed'])
        pending_enrollments = len([e for e in enrollments if e[0].status == 'Pending'])
    except Exception as e:
        print(f"Error fetching enrollments or classes: {e}")
        enrollments = []
        classes = []
        total_enrollments = 0
        active_enrollments = 0
        completed_enrollments = 0
        pending_enrollments = 0
    
    # Calculate pagination variables
    per_page = int(request.args.get('per_page', 10))
    page = int(request.args.get('page', 1))
    start_idx = (page - 1) * per_page if total_enrollments > 0 else 0
    end_idx = min(start_idx + per_page, total_enrollments) if total_enrollments > 0 else 0
    
    # Get counts for statistics cards
    total_students = User.query.filter_by(role='student').count()
    
    return render_template('admin/enrolment_management.html', 
                           active_page='enrolment_management',
                           enrollments=enrollments,
                           students=students,
                           classes=classes,
                           total_enrollments=total_enrollments,
                           start_idx=start_idx,
                           end_idx=end_idx,
                           page=page,
                           per_page=per_page,
                           total_students=total_students,
                           active_enrollments=active_enrollments,
                           completed_enrollments=completed_enrollments,
                           pending_enrollments=pending_enrollments)

@admin_bp.route('/attendance-view')
@login_required
def attendance_view():
    # Get filter parameters
    class_id = request.args.get('class_id', '')
    date_start = request.args.get('date_start', '')
    date_end = request.args.get('date_end', '')
    
    # Use try-except for Class and Attendance queries that might fail
    try:
        # Get all classes for the dropdown
        classes = Class.query.all()
        
        # Get attendance records with filtering
        query = db.session.query(
            Attendance, User, Class
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        ).filter(
            User.role == 'student'
        )
        
        if class_id:
            query = query.filter(Class.id == class_id)
        
        if date_start:
            query = query.filter(Attendance.date >= datetime.strptime(date_start, '%Y-%m-%d'))
        
        if date_end:
            query = query.filter(Attendance.date <= datetime.strptime(date_end, '%Y-%m-%d'))
        
        attendances = query.order_by(Attendance.date.desc()).all()
    except Exception as e:
        print(f"Error fetching attendance or classes: {e}")
        classes = []
        attendances = []
    
    return render_template('admin/attendance_view.html',
                           active_page='attendance_view',
                           classes=classes,
                           attendances=attendances,
                           selected_class=class_id,
                           date_start=date_start,
                           date_end=date_end)

@admin_bp.route('/mark-attendance')
@login_required
def mark_attendance():
    # Get students for attendance marking
    students = User.query.filter_by(role='student', is_active=True).all()
    
    # Use try-except for Class queries that might fail
    try:
        # Get all classes
        classes = Class.query.filter_by(status='Active').all()
    except Exception as e:
        print(f"Error fetching classes: {e}")
        classes = []
    
    # Get today's date formatted
    today = datetime.now().strftime('%Y-%m-%d')
    
    return render_template('admin/mark_attendance.html',
                           active_page='mark_attendance',
                           classes=classes,
                           students=students,
                           today=today)

@admin_bp.route('/export-users-csv')
@login_required
def export_users_csv():
    # Get filter parameters
    role_filter = request.args.get('role', '')
    search_term = request.args.get('search', '')

    # Get filtered users
    query = User.query
    
    if role_filter:
        query = query.filter(User.role == role_filter)
    
    if search_term:
        query = query.filter(
            (User.first_name.like(f'%{search_term}%')) |
            (User.last_name.like(f'%{search_term}%')) |
            (User.email.like(f'%{search_term}%'))
        )
    
    users = query.all()

    # Create CSV string
    output = StringIO()
    writer = csv.writer(output)
    
    # Write headers
    writer.writerow(['ID', 'Name', 'Email', 'Role', 'Status'])
    
    # Write data
    for user in users:
        writer.writerow([
            user.id,
            f"{user.first_name} {user.last_name}",
            user.email,
            user.role,
            'Active' if user.is_active else 'Inactive'
        ])
    
    # Create the response
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename=users_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    
    return response

@admin_bp.route('/export-students-csv')
@login_required
def export_students_csv():
    # Get filter parameters
    status_filter = request.args.get('status', '')
    search_term = request.args.get('search', '')
    
    # Get filtered students
    query = User.query.filter_by(role='Student')
    
    if status_filter:
        is_active = status_filter.lower() == 'active'
        query = query.filter(User.is_active == is_active)
    
    if search_term:
        query = query.filter(
            (User.first_name.like(f'%{search_term}%')) |
            (User.last_name.like(f'%{search_term}%')) |
            (User.email.like(f'%{search_term}%')) |
            (User.id.like(f'%{search_term}%'))
        )
    
    students = query.all()
    
    # Create CSV
    si = StringIO()
    writer = csv.writer(si)
    
    # Write header
    writer.writerow(['ID', 'Name', 'Email', 'Status'])
    
    # Write data
    for student in students:
        writer.writerow([
            student.id,
            f"{student.first_name} {student.last_name}",
            student.email,
            'Active' if student.is_active else 'Inactive'
        ])
    
    # Create response
    output = make_response(si.getvalue())
    output.headers['Content-Disposition'] = f'attachment; filename=students_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    output.headers['Content-type'] = 'text/csv'
    
    return output

@admin_bp.route('/company-management')
@login_required
def company_management():
    # For now, we'll return a basic template with mock data
    # In the future, this would connect to a Company model
    companies = [
        {
            'id': 1,
            'name': 'Acme Corporation',
            'contact_name': 'John Smith',
            'email': 'john@acme.com',
            'phone': '555-123-4567',
            'status': 'Active'
        },
        {
            'id': 2,
            'name': 'Wayne Enterprises',
            'contact_name': 'Bruce Wayne',
            'email': 'bruce@wayne.com',
            'phone': '555-876-5432',
            'status': 'Active'
        },
        {
            'id': 3,
            'name': 'Stark Industries',
            'contact_name': 'Tony Stark',
            'email': 'tony@stark.com',
            'phone': '555-432-1098',
            'status': 'Inactive'
        }
    ]
    
    return render_template('admin/company_management.html', 
                          active_page='company_management',
                          companies=companies,
                          total_companies=len(companies),
                          active_companies=len([c for c in companies if c['status'] == 'Active']),
                          inactive_companies=len([c for c in companies if c['status'] == 'Inactive']))

@admin_bp.route('/instructor-management')
@login_required
def instructor_management():
    # Get filter parameters
    status_filter = request.args.get('status', '')
    search = request.args.get('search', '')
    
    # Get all instructors for stats
    instructors_query = User.query.filter_by(role='instructor')
    all_instructors = instructors_query.all()
    total_instructors = len(all_instructors)
    active_instructors = len([i for i in all_instructors if i.is_active])
    inactive_instructors = total_instructors - active_instructors
    
    # Apply filters if provided
    query = User.query.filter_by(role='instructor')
    
    if status_filter:
        is_active = status_filter == 'Active'
        query = query.filter(User.is_active == is_active)
    
    if search:
        query = query.filter(
            (User.first_name.like(f'%{search}%')) |
            (User.last_name.like(f'%{search}%')) |
            (User.email.like(f'%{search}%'))
        )
    
    instructors = query.all()
    
    # Format instructor data for template
    formatted_instructors = []
    for instructor in instructors:
        formatted_instructors.append({
            'name': f"{instructor.first_name} {instructor.last_name}",
            'user_id': instructor.id,
            'role': 'Instructor',
            'status': 'Active' if instructor.is_active else 'Inactive',
            'profile_img': 'profile.png'  # Default profile image
        })
    
    return render_template('admin/instructor_management.html', 
                           active_page='instructor_management',
                           instructors=formatted_instructors,
                           total_instructors=total_instructors,
                           active_instructors=active_instructors,
                           inactive_instructors=inactive_instructors,
                           status_filter=status_filter,
                           search_term=search)

@admin_bp.route('/view-archive')
@login_required
def view_archive():
    """View archived records."""
    # Get the archive type from the query parameter, if provided
    archive_type = request.args.get('type', '')
    
    # In a real app, you would query archived records
    # For now, we'll use the template with mock data
    
    return render_template('admin/archive.html',
                           active_page='view_archive',
                           archive_type=archive_type,) 