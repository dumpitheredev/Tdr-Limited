from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, make_response
from flask_login import login_required, current_user
from models import db, User, Class, Enrollment, Attendance, Company
from datetime import datetime, timedelta
import csv
from io import StringIO
from sqlalchemy import text

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

@admin_bp.route('/enrollment-management')
@login_required
def enrollment_management():
    """Main enrollment management page."""
    # Get URL parameters for filtering and pagination
    status_filter = request.args.get('status', '')
    search_term = request.args.get('search', '')
    per_page = int(request.args.get('per_page', 5))
    page = int(request.args.get('page', 1))
    
    # Get all students for the dropdowns
    students = User.query.filter_by(role='Student', is_active=True).all()
    
    # Get classes for the form
    classes = Class.query.filter_by(is_active=True).all()
    
    # Get counts for statistics cards
    total_students = User.query.filter_by(role='Student').count()
    
    try:
        # Get enrollment data using the data endpoint
        api_url = f"/admin/enrollment-management/data?status={status_filter}&search={search_term}&per_page={per_page}&page={page}"
        
        # Call our own API endpoint internally
        from flask import current_app
        with current_app.test_client() as client:
            response = client.get(api_url)
            data = response.get_json()
            
            # Extract data from the response
            enrollments = data.get('enrollments', [])
            pagination = data.get('pagination', {})
            
            # Get pagination values
            total_enrollments = pagination.get('total', 0)
            active_enrollments = pagination.get('active', 0)
            pending_enrollments = pagination.get('pending', 0)
            start_idx = pagination.get('start_idx', 0)
            end_idx = pagination.get('end_idx', 0)
    except Exception as e:
        print(f"Error fetching enrollments: {e}")
        enrollments = []
        total_enrollments = 0
        active_enrollments = 0
        pending_enrollments = 0
        total_students = User.query.filter_by(role='Student').count()
        start_idx = 0
        end_idx = 0
    
    return render_template('admin/enrollment_management.html', 
                         active_page='enrollment_management',
                         enrolments=enrollments,
                         students=students,
                         classes=classes,
                         total_enrollments=total_enrollments,
                         total_students=total_students,
                         active_enrollments=active_enrollments,
                         pending_enrollments=pending_enrollments,
                         status_filter=status_filter,
                         start_idx=start_idx,
                         end_idx=end_idx)

@admin_bp.route('/enrollment-management/data')
@login_required
def enrollment_management_data():
    """API endpoint for enrollment management data (AJAX)"""
    # Get URL parameters for filtering and pagination
    status_filter = request.args.get('status', '')
    search_term = request.args.get('search', '')
    per_page = int(request.args.get('per_page', 5))
    page = int(request.args.get('page', 1))
    
    try:
        # Step 1: Get basic enrollment data
        enrollments = db.session.execute(text("""
            SELECT id, student_id, class_id, enrollment_date, status, unenrollment_date
            FROM enrollment
            ORDER BY enrollment_date DESC
        """)).fetchall()
        
        # Step 2: Get student data for efficient lookups
        students_data = {}
        for student in User.query.filter_by(role='Student').all():
            students_data[student.id] = {
                'id': student.id,
                'name': f"{student.first_name} {student.last_name}",
                'email': student.email,
                'company_id': student.company_id,
                'is_active': student.is_active,
                'profile_img': student.profile_img or 'profile.png'
            }
        
        # Step 3: Get class data for efficient lookups
        classes_data = {}
        for class_obj in Class.query.all():
            classes_data[class_obj.id] = {
                'id': class_obj.id,
                'name': class_obj.name
            }
        
        # Step 4: Process enrollments and filter by search term
        processed_enrollments = []
        for enrollment in enrollments:
            # Extract enrollment data
            enrollment_id = enrollment[0]
            student_id = enrollment[1]
            class_id = enrollment[2]
            enrollment_date = enrollment[3]
            status = enrollment[4]
            unenrollment_date = enrollment[5]
            
            # Skip if student doesn't exist in our data
            if student_id not in students_data:
                continue
                
            # Get student and class data
            student_data = students_data.get(student_id, {})
            class_data = classes_data.get(class_id, {})
            
            # Apply search filter if specified
            student_name = student_data.get('name', 'Unknown')
            if search_term and not (
                search_term.lower() in student_name.lower() or 
                search_term.lower() in str(student_id).lower()
            ):
                continue
                
            # Create the enrollment record
            processed_enrollments.append({
                'id': enrollment_id,
                'student_id': student_id,
                'class_id': class_id,
                'enrollment_date': enrollment_date.strftime('%Y-%m-%d') if hasattr(enrollment_date, 'strftime') else str(enrollment_date),
                'status': status,
                'unenrollment_date': unenrollment_date.strftime('%Y-%m-%d') if unenrollment_date and hasattr(unenrollment_date, 'strftime') else str(unenrollment_date) if unenrollment_date else None,
                'student_name': student_name,
                'student_status': 'Active' if student_data.get('is_active', False) else 'Inactive',
                'class_name': class_data.get('name', 'Unknown Class'),
                'student_profile_img': student_data.get('profile_img', 'profile.png')
            })
        
        # Step 5: Apply status filter if provided
        if status_filter:
            processed_enrollments = [e for e in processed_enrollments if e['status'] == status_filter]
            
        # Step 6: Group by student for display
        student_enrollments = {}
        
        for enrollment in processed_enrollments:
            student_id = enrollment['student_id']
            
            # Initialize student data if first time seeing this student
            if student_id not in student_enrollments:
                student_data = students_data.get(student_id, {})
                company_id = student_data.get('company_id')
                
                # Get company name if available
                company_name = "Not Assigned"
                if company_id:
                    try:
                        company = Company.query.get(company_id)
                        if company:
                            company_name = company.name
                    except Exception:
                        pass
                
                student_enrollments[student_id] = {
                    'id': enrollment['id'],
                    'student': {
                        'user_id': student_id,
                        'name': enrollment['student_name'],
                        'status': enrollment['student_status'],
                        'profile_img': enrollment['student_profile_img']
                    },
                    'company': {
                        'company_id': company_id,
                        'name': company_name
                    },
                    'enrollment_date': enrollment['enrollment_date'],
                    'status': enrollment['status'],
                    'classes': []
                }
            
            # Add class to student's classes list
            class_info = {
                'class_id': enrollment['class_id'],
                'name': enrollment['class_name']
            }
            
            # Add unenrollment_date if it exists
            if enrollment['unenrollment_date']:
                class_info['unenrollment_date'] = enrollment['unenrollment_date']
            
            # Skip duplicate classes
            student_classes = student_enrollments[student_id]['classes']
            if not any(c.get('class_id') == enrollment['class_id'] for c in student_classes):
                student_classes.append(class_info)
        
        # Step 7: Calculate active class counts for each student
        formatted_enrollments = list(student_enrollments.values())
        for student_enrollment in formatted_enrollments:
            # Count only classes without unenrollment_date
            active_classes = [cls for cls in student_enrollment['classes'] if not cls.get('unenrollment_date')]
            student_enrollment['active_class_count'] = len(active_classes)
        
        # Step 8: Calculate statistics for cards
        total_enrollments = len(formatted_enrollments)
        active_enrollments = sum(1 for e in formatted_enrollments if e['status'] == 'Active')
        pending_enrollments = sum(1 for e in formatted_enrollments if e['status'] == 'Pending')
        
        # Step 9: Apply pagination
        start_idx = (page - 1) * per_page
        end_idx = min(start_idx + per_page, total_enrollments)
        paginated_enrollments = formatted_enrollments[start_idx:end_idx] if formatted_enrollments else []
        
        # Return JSON response with data and pagination info
        return jsonify({
            'enrollments': paginated_enrollments,
            'pagination': {
                'current_page': page,
                'per_page': per_page,
                'total': total_enrollments,
                'start_idx': start_idx,
                'end_idx': end_idx,
                'active': active_enrollments,
                'pending': pending_enrollments
            }
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

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
        classes = Class.query.filter_by(is_active=True).all()
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
