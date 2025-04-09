from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, make_response, abort
from flask_login import login_required, current_user
from models import db, User, Class, Enrollment, Attendance, Company
from datetime import datetime, timedelta
import csv
from io import StringIO
from sqlalchemy import text, or_, func, case
import time
from functools import wraps

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# --------------- Helper Functions ---------------

def admin_required(f):
    """Decorator to check if user is an admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role.lower() != 'admin':
            flash('You do not have permission to access this page.', 'error')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def filter_by_role(query, role):
    """Filter query by role (case insensitive)"""
    return query.filter(or_(
        User.role == role.capitalize(),
        User.role == role.lower()
    ))

def apply_user_filters(query, status_filter=None, search_term=None, role=None):
    """Apply common filters to a User query"""
    # Apply role filter if provided
    if role:
        query = filter_by_role(query, role)
    
    # Apply status filter if provided
    if status_filter:
        is_active = status_filter == 'Active'
        query = query.filter(User.is_active == is_active)
    
    # Apply search filter if provided
    if search_term:
        query = query.filter(or_(
            User.first_name.like(f'%{search_term}%'),
            User.last_name.like(f'%{search_term}%'),
            User.email.like(f'%{search_term}%'),
            User.id.like(f'%{search_term}%')
        ))
    
    return query

def export_query_to_csv(query, filename_prefix, headers, row_formatter):
    """Export query results to CSV"""
    # Create CSV string
    output = StringIO()
    writer = csv.writer(output)
    
    # Write headers
    writer.writerow(headers)
    
    # Write data using the provided formatter function
    for item in query:
        writer.writerow(row_formatter(item))
    
    # Create response
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename={filename_prefix}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    
    return response

def safe_query_execution(func, error_fallback):
    """Execute a database query function with error handling"""
    try:
        return func()
    except Exception as e:
        print(f"Error in database query: {e}")
        # Show error message but still use fallback data for rendering
        flash(f"Database error: {str(e)}", "error")
        # Return the fallback data instead of None
        return error_fallback

# Middleware to check if user is admin
@admin_bp.before_request
def check_admin():
    if not current_user.is_authenticated or current_user.role != 'admin':
        flash('You do not have permission to access this page.', 'error')
        return redirect(url_for('auth.login'))

@admin_bp.route('/dashboard')
@login_required
def dashboard():
    # Get dashboard stats with error handling using the helper functions
    student_count = safe_query_execution(
        lambda: filter_by_role(User.query, 'student').count(),
        0
    )
    
    instructor_count = safe_query_execution(
        lambda: filter_by_role(User.query, 'instructor').count(),
        0
    )
    
    class_count = safe_query_execution(
        lambda: Class.query.count(),
        0
    )
    
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
    search_term = request.args.get('search', '')
    
    # Add timestamp for cache busting
    now = int(time.time())
    
    def get_user_data():
        # Get all users for stats
        all_users = User.query.all()
        total_users = len(all_users)
        active_users = len([u for u in all_users if u.is_active])
        inactive_users = total_users - active_users
        
        # Build the query with filters
        query = User.query
        
        # Apply role filter if provided
        if role_filter:
            query = query.filter(User.role == role_filter)
        
        # Apply status and search filters using the helper function
        query = apply_user_filters(query, 
                                  status_filter=status_filter, 
                                  search_term=search_term)
        
        # Get the users with eager loading of relationships
        users = query.all()
        
        # Enhance user data with related information
        enhanced_users = []
        for user in users:
            enhanced_user = user  # Use the actual user object
            
            # For students, add enrollment data
            if user.role == 'student':
                # Get enrollment data
                enrollments = db.session.query(Enrollment, Class)\
                    .join(Class, Enrollment.class_id == Class.id)\
                    .filter(Enrollment.student_id == user.id)\
                    .all()
                
                # Format enrollments for the template
                formatted_enrollments = []
                for enrollment, class_obj in enrollments:
                    formatted_enrollments.append({
                        'class_id': class_obj.id,
                        'class_name': class_obj.name,
                        'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}",
                        'status': enrollment.status
                    })
                
                # Store enrollments on the user object
                enhanced_user.enrollments = formatted_enrollments
                
                # Get attendance statistics
                attendance_stats = db.session.query(
                    func.sum(case((Attendance.status == 'Present', 1), else_=0)).label('present'),
                    func.sum(case((Attendance.status == 'Absent', 1), else_=0)).label('absent')
                ).filter(Attendance.student_id == user.id).first()
                
                # Add attendance data
                enhanced_user.attendance = {
                    'present': attendance_stats.present or 0,
                    'absent': attendance_stats.absent or 0
                }
                
            # For instructors, add classes data
            elif user.role == 'instructor':
                # Get classes taught
                classes = Class.query.filter_by(instructor_id=user.id).all()
                
                # Format classes for the template
                formatted_classes = []
                for class_obj in classes:
                    # Count enrolled students
                    enrolled_count = Enrollment.query.filter_by(
                        class_id=class_obj.id, 
                        status='Active'
                    ).count()
                    
                    formatted_classes.append({
                        'id': class_obj.id,
                        'name': class_obj.name,
                        'day': class_obj.day_of_week,
                        'time': f"{class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}",
                        'enrolled_count': enrolled_count,
                        'is_active': class_obj.is_active
                    })
                
                # Store classes on the user object
                enhanced_user.classes_taught = formatted_classes
                
            # For admins, add mock permissions (replace with real permissions when implemented)
            elif user.role == 'admin':
                # Set mock permissions based on user ID or other factors
                permissions = [
                    'user_management',
                    'class_management',
                    'enrollment_management',
                    'report_generation'
                ]
                
                # Add super_admin for first admin
                if str(user.id).endswith('1'):
                    permissions.append('super_admin')
                    permissions.append('system_settings')
                    enhanced_user.admin_role = 'Super Administrator'
                else:
                    enhanced_user.admin_role = 'Administrator'
                
                # Store permissions on the user object
                enhanced_user.permissions = permissions
            
            enhanced_users.append(enhanced_user)
        
        return {
            'users': enhanced_users,
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': inactive_users
        }
    
    # Use safe execution with fallback
    fallback = {
        'users': [],
        'total_users': 0,
        'active_users': 0,
        'inactive_users': 0
    }
    
    result = safe_query_execution(get_user_data, fallback)
    
    return render_template('admin/user_management.html', 
                          active_page='user_management',
                          users=result['users'],
                          total_users=result['total_users'],
                          active_users=result['active_users'],
                          inactive_users=result['inactive_users'],
                          role_filter=role_filter,
                          status_filter=status_filter,
                          search_term=search_term,
                          now=now)

@admin_bp.route('/student-management')
@login_required
def student_management():
    # Get filter parameters
    status_filter = request.args.get('status', '')
    search_term = request.args.get('search', '')
    
    def get_student_data():
        # Get all students for stats
        all_students = filter_by_role(User.query, 'student').all()
        total_students = len(all_students)
        active_students = len([s for s in all_students if s.is_active])
        inactive_students = total_students - active_students
        
        # Get filtered students using the helper function
        query = apply_user_filters(User.query, 
                                  status_filter=status_filter, 
                                  search_term=search_term, 
                                  role='student')
        
        students = query.all()
        
        return {
            'students': students,
            'total_students': total_students,
            'active_students': active_students,
            'inactive_students': inactive_students
        }
    
    # Use safe execution with fallback empty values
    fallback = {
        'students': [],
        'total_students': 0,
        'active_students': 0,
        'inactive_students': 0
    }
    
    result = safe_query_execution(get_student_data, fallback)
    
    return render_template('admin/student_management.html',
                           active_page='student_management',
                          students=result['students'],
                          total_students=result['total_students'],
                          active_students=result['active_students'],
                          inactive_students=result['inactive_students'],
                           status_filter=status_filter,
                          search_term=search_term)

@admin_bp.route('/class-management')
@login_required
def class_management():
    def get_class_data():
        # Query classes directly from database
        classes = Class.query.all()
    
        # Get instructors with properly formatted fields for the dropdown
        instructors = filter_by_role(User.query, 'instructor').all()
        
        return {
            'classes': classes,
            'instructors': instructors
        }
    
    # Use safe execution with fallback
    result = safe_query_execution(
        get_class_data,
        {'classes': [], 'instructors': []}
    )
    
    return render_template('admin/class_management.html', 
                           active_page='class_management',
                          classes=result['classes'],
                          instructors=result['instructors'],
                          total_classes=len(result['classes']))

@admin_bp.route('/enrollment-management')
@login_required
def enrollment_management():
    """Main enrollment management page."""
    def get_enrollment_data():
        # Get URL parameters for filtering and pagination
        status_filter = request.args.get('status', '')
        search_term = request.args.get('search', '')
        per_page = int(request.args.get('per_page', 5))
        page = int(request.args.get('page', 1))
        
        # Get all active students for the dropdowns
        students = filter_by_role(User.query, 'student').filter_by(is_active=True).all()
        
        # Get active classes for the form
        classes = Class.query.filter_by(is_active=True).all()
        
        # Get counts for statistics cards
        total_students = filter_by_role(User.query, 'student').count()
        
        # Call our own API endpoint internally
        from flask import current_app
        with current_app.test_client() as client:
            api_url = f"/admin/enrollment-management/data?status={status_filter}&search={search_term}&per_page={per_page}&page={page}"
            response = client.get(api_url)
            data = response.get_json()
            
            # Extract data from the response
            enrollments = data.get('enrollments', [])
            pagination = data.get('pagination', {})
            
            # Extract pagination values
            total_enrollments = pagination.get('total', 0)
            active_enrollments = pagination.get('active', 0)
            pending_enrollments = pagination.get('pending', 0)
            start_idx = pagination.get('start_idx', 0)
            end_idx = pagination.get('end_idx', 0)
            
        return {
            'students': students,
            'classes': classes,
            'enrollments': enrollments,
            'total_students': total_students,
            'total_enrollments': total_enrollments,
            'active_enrollments': active_enrollments,
            'pending_enrollments': pending_enrollments,
            'start_idx': start_idx,
            'end_idx': end_idx
        }
    
    # Use safe execution with appropriate fallback
    fallback = {
        'students': [],
        'classes': [],
        'enrollments': [],
        'total_students': 0,
        'total_enrollments': 0,
        'active_enrollments': 0,
        'pending_enrollments': 0,
        'start_idx': 0,
        'end_idx': 0
    }
    
    result = safe_query_execution(get_enrollment_data, fallback)
    
    # Get filter parameters for passing to template
    status_filter = request.args.get('status', '')
    
    return render_template('admin/enrollment_management.html', 
                           active_page='enrollment_management',
                         enrolments=result['enrollments'],
                         students=result['students'],
                         classes=result['classes'],
                         total_enrollments=result['total_enrollments'],
                         total_students=result['total_students'],
                         active_enrollments=result['active_enrollments'],
                         pending_enrollments=result['pending_enrollments'],
                         status_filter=status_filter,
                         start_idx=result['start_idx'],
                         end_idx=result['end_idx'])

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
        
        # Step 2: Get student data for efficient lookups - handle both capitalization styles
        students_data = {}
        student_query = User.query.filter(
            (User.role == 'Student') | (User.role == 'student')
        ).all()
        
        for student in student_query:
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
    instructor_id = request.args.get('instructor_id', '')
    student_name = request.args.get('student_name', '')
    status = request.args.get('status', '')
    date_start = request.args.get('date_start', '')
    date_end = request.args.get('date_end', '')
    
    def get_attendance_data():
        try:
            # Get all classes for the dropdown
            classes = Class.query.all()
            
            # Get all instructors for the dropdown
            instructors = filter_by_role(User.query, 'instructor').all()
            
            # Get attendance records with filtering
            query = db.session.query(
                Attendance, User, Class
            ).join(
                User, Attendance.student_id == User.id
            ).join(
                Class, Attendance.class_id == Class.id
            )
            
            # Apply student role filter
            query = query.filter(or_(User.role == 'Student', User.role == 'student'))
            
            # Apply class filter if provided
            if class_id:
                query = query.filter(Class.id == class_id)
            
            # Apply instructor filter if provided
            if instructor_id:
                query = query.filter(Class.instructor_id == instructor_id)
            
            # Apply status filter if provided
            if status:
                query = query.filter(Attendance.status == status)
            
            # Apply student name filter if provided
            if student_name:
                query = query.filter(
                    or_(
                        User.first_name.like(f'%{student_name}%'),
                        User.last_name.like(f'%{student_name}%'),
                        User.id.like(f'%{student_name}%')
                    )
                )
            
            # Apply date filters if provided
            if date_start:
                query = query.filter(Attendance.date >= datetime.strptime(date_start, '%Y-%m-%d'))
            
            if date_end:
                query = query.filter(Attendance.date <= datetime.strptime(date_end, '%Y-%m-%d'))
            
            # Get results ordered by date
            attendances = query.order_by(Attendance.date.desc()).all()
            
            return {
                'classes': classes,
                'instructors': instructors,
                'attendances': attendances
            }
        except Exception as e:
            # Log the specific error
            import logging
            logging.error(f"Error fetching attendance data: {str(e)}")
            # Raise a more specific error
            raise ValueError(f"Failed to retrieve attendance data: {str(e)}")
    
    # Use safe execution with fallback
    fallback = {
        'classes': [],
        'instructors': [],
        'attendances': []
    }
    
    result = safe_query_execution(get_attendance_data, fallback)
    
    # Set default date range if none provided
    if not date_start and not date_end:
        today = datetime.now()
        thirty_days_ago = today - timedelta(days=30)
        date_start = thirty_days_ago.strftime('%Y-%m-%d')
        date_end = today.strftime('%Y-%m-%d')
    
    return render_template('admin/view_attendance.html',
                           active_page='view_attendance',
                           classes=result['classes'],
                           instructors=result['instructors'],
                           attendances=result['attendances'],
                           selected_class=class_id,
                           selected_instructor=instructor_id,
                           student_name=student_name,
                           status=status,
                           date_start=date_start,
                           date_end=date_end)

@admin_bp.route('/mark-attendance')
@login_required
def mark_attendance():
    def get_attendance_data():
        # Get active students for attendance marking
        students = filter_by_role(User.query, 'student').filter_by(is_active=True).all()
    
        # Get all active classes
        classes = Class.query.filter_by(is_active=True).all()
        
        return {
            'students': students,
            'classes': classes
        }
    
    # Use safe execution with fallback
    fallback = {
        'students': [],
        'classes': []
    }
    
    result = safe_query_execution(get_attendance_data, fallback)
    
    # Get today's date formatted
    today = datetime.now().strftime('%Y-%m-%d')
    
    return render_template('admin/mark_attendance.html',
                           active_page='mark_attendance',
                           classes=result['classes'],
                           students=result['students'],
                           today=today)

@admin_bp.route('/export-users-csv')
@login_required
def export_users_csv():
    # Get filter parameters
    role_filter = request.args.get('role', '')
    search_term = request.args.get('search', '')

    # Build the query with filters
    query = User.query
    
    # Apply role filter if provided
    if role_filter:
        query = query.filter(User.role == role_filter)
    
    # Apply search filter
    if search_term:
        query = query.filter(or_(
            User.first_name.like(f'%{search_term}%'),
            User.last_name.like(f'%{search_term}%'),
            User.email.like(f'%{search_term}%')
        ))
    
    # Define CSV headers
    headers = ['ID', 'First Name', 'Last Name', 'Email', 'Role', 'Status']
    
    # Define row formatter function
    def format_user_row(user):
        return [
            user.id,
            user.first_name,
            user.last_name,
            user.email,
            user.role,
            'Active' if user.is_active else 'Inactive'
        ]
    
    return export_query_to_csv(
        query=query,
        filename_prefix='users',
        headers=headers,
        row_formatter=format_user_row
    )

@admin_bp.route('/export-students-to-csv')
@login_required
def export_students_to_csv():
    # Create query to get students with both capitalized and lowercase role names
    query = filter_by_role(User.query, 'student')
    
    # Define CSV headers
    headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Status']
    
    # Define row formatter function
    def format_student_row(student):
        return [
            student.id,
            student.first_name,
            student.last_name,
            student.email,
            student.phone or '',
            'Active' if student.is_active else 'Inactive'
        ]
    
    return export_query_to_csv(
        query=query,
        filename_prefix='students',
        headers=headers,
        row_formatter=format_student_row
    )

@admin_bp.route('/export-instructors-to-csv')
@login_required
def export_instructors_to_csv():
    # Create query to get instructors with both capitalized and lowercase role names
    query = filter_by_role(User.query, 'instructor')
    
    # Define CSV headers
    headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Status']
    
    # Define row formatter function
    def format_instructor_row(instructor):
        return [
            instructor.id,
            instructor.first_name,
            instructor.last_name,
            instructor.email,
            instructor.phone or '',
            'Active' if instructor.is_active else 'Inactive'
        ]
    
    return export_query_to_csv(
        query=query,
        filename_prefix='instructors',
        headers=headers,
        row_formatter=format_instructor_row
    )

@admin_bp.route('/company-management')
@login_required
def company_management():
    def get_company_data():
        # Get all companies for stats
        all_companies = Company.query.all()
        total_companies = len(all_companies)
        active_companies = len([c for c in all_companies if c.is_active])
        inactive_companies = total_companies - active_companies
        
        # Format company data for template
        formatted_companies = []
        for company in all_companies:
            formatted_companies.append({
                'id': company.id,
                'name': company.name,
                'address': company.address,
                'status': 'Active' if company.is_active else 'Inactive'
            })
        
        return {
            'companies': formatted_companies,
            'total_companies': total_companies,
            'active_companies': active_companies,
            'inactive_companies': inactive_companies
        }
    
    # Use safe execution with fallback
    fallback = {
        'companies': [],
        'total_companies': 0,
        'active_companies': 0,
        'inactive_companies': 0
    }
    
    result = safe_query_execution(get_company_data, fallback)
    
    return render_template('admin/company_management.html', 
                          active_page='company_management',
                           companies=result['companies'],
                           total_companies=result['total_companies'],
                           active_companies=result['active_companies'],
                           inactive_companies=result['inactive_companies'])

@admin_bp.route('/instructor-management')
@login_required
def instructor_management():
    # Get filter parameters
    status_filter = request.args.get('status', '')
    search_term = request.args.get('search', '')
    
    def get_instructor_data():
        # Get all instructors for stats
        all_instructors = filter_by_role(User.query, 'instructor').all()
        total_instructors = len(all_instructors)
        active_instructors = len([i for i in all_instructors if i.is_active])
        inactive_instructors = total_instructors - active_instructors
        
        # Apply filters using the helper function
        query = apply_user_filters(User.query, 
                                   status_filter=status_filter, 
                                   search_term=search_term, 
                                   role='instructor')
        
        instructors = query.all()
        
        # Format instructor data for template
        formatted_instructors = []
        for instructor in instructors:
            formatted_instructors.append({
                'name': f"{instructor.first_name} {instructor.last_name}",
                'user_id': instructor.id,
                'role': 'Instructor',
                'status': 'Active' if instructor.is_active else 'Inactive',
                'profile_img': instructor.profile_img or 'profile.png'  # Default profile image
            })
            
        return {
            'instructors': formatted_instructors,
            'total_instructors': total_instructors,
            'active_instructors': active_instructors,
            'inactive_instructors': inactive_instructors
        }
    
    # Use safe execution with fallback
    fallback = {
        'instructors': [],
        'total_instructors': 0,
        'active_instructors': 0,
        'inactive_instructors': 0
    }
    
    result = safe_query_execution(get_instructor_data, fallback)
    
    return render_template('admin/instructor_management.html', 
                           active_page='instructor_management',
                           instructors=result['instructors'],
                           total_instructors=result['total_instructors'],
                           active_instructors=result['active_instructors'],
                           inactive_instructors=result['inactive_instructors'],
                           status_filter=status_filter,
                           search_term=search_term)

@admin_bp.route('/archive-view')
@login_required
def view_archive():
    # Check if user is an admin
    if current_user.role.lower() != 'admin':
        abort(403)  # Forbidden
    
    # Get the archive type from the URL query string
    archive_type = request.args.get('type', '')
    
    def get_archive_data():
        # Get archived classes and students
        archived_classes = Class.query.filter_by(is_archived=True).all()
        
        # Get archived students (role can be Student or student)
        archived_students = filter_by_role(User.query, 'student').filter_by(is_archived=True).all()
        
        # Get archived instructors (role can be Instructor or instructor)
        archived_instructors = filter_by_role(User.query, 'instructor').filter_by(is_archived=True).all()
        
        # Get archived admins (role can be Admin or admin or Administrator)
        archived_admins = User.query.filter(
            User.is_archived==True,
            db.or_(
                User.role.ilike('admin'),
                User.role.ilike('administrator')
            )
        ).all()
        
        # Get archived attendance records
        archived_attendance = Attendance.query.filter_by(is_archived=True).all()
        
        # All archived users combined
        archived_users = User.query.filter_by(is_archived=True).all()
        
        return {
            'archived_classes': archived_classes,
            'archived_students': archived_students,
            'archived_instructors': archived_instructors,
            'archived_admins': archived_admins,
            'archived_attendance': archived_attendance,
            'archived_counts': {
                'class': len(archived_classes),
                'student': len(archived_students),
                'instructor': len(archived_instructors),
                'admin': len(archived_admins),
                'attendance': len(archived_attendance),
                'user': len(archived_users)
            }
        }
    
    # Use safe execution with fallback
    fallback = {
        'archived_classes': [],
        'archived_students': [],
        'archived_instructors': [],
        'archived_admins': [],
        'archived_attendance': [],
        'archived_counts': {
            'class': 0,
            'student': 0,
            'instructor': 0,
            'admin': 0,
            'attendance': 0,
            'user': 0
        }
    }
    
    result = safe_query_execution(get_archive_data, fallback)
    
    return render_template('admin/archive.html',
                           active_page='view_archive',
                           archived_classes=result['archived_classes'],
                           archived_students=result['archived_students'],
                           archived_instructors=result['archived_instructors'],
                           archived_admins=result['archived_admins'],
                           archived_attendance=result['archived_attendance'],
                           archive_type=archive_type,
                           archived_counts=result['archived_counts'])

@admin_bp.route('/reports')
@login_required
@admin_required
def reports():
    """
    Render the reports page
    """
    return render_template('admin/reports.html', now=int(time.time()))
