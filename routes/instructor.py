from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, current_app
from flask_login import login_required, current_user
from models import db, User, Class, Enrollment, Attendance
from datetime import datetime, date, timedelta

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
    
    # Format classes for the weekly schedule view
    instructor_classes = []
    days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    
    # Map to store classes by day for easier template rendering
    schedule = {
        'Monday': [],
        'Tuesday': [],
        'Wednesday': [],
        'Thursday': [],
        'Friday': []
    }
    
    # Process classes for weekly schedule display
    for cls in classes:
        # Check if class has day and time information
        if hasattr(cls, 'day_of_week') and hasattr(cls, 'start_time') and hasattr(cls, 'end_time'):
            day = cls.day_of_week
            
            # Format times for display
            start_time_str = cls.start_time.strftime("%I:%M%p").lower().lstrip('0')
            end_time_str = cls.end_time.strftime("%I:%M%p").lower().lstrip('0')
            
            # Create formatted class entry
            class_entry = {
                'id': cls.id,
                'name': cls.name,
                'day': day,
                'start_time': start_time_str,
                'end_time': end_time_str,
                'formatted_time': f"{start_time_str} - {end_time_str}"
            }
            
            # Add to the appropriate day in schedule
            if day in schedule:
                schedule[day].append(class_entry)
            
            # Also add to the flat list
            instructor_classes.append(class_entry)
        else:
            # For classes without day/time info (in case your model is different)
            current_app.logger.info(f"Class {cls.id} missing schedule information: day={getattr(cls, 'day_of_week', None)}, start={getattr(cls, 'start_time', None)}, end={getattr(cls, 'end_time', None)}")
    
    # Get recently marked attendance
    recent_attendance = Attendance.query.join(
        Class, Attendance.class_id == Class.id
    ).filter(
        Class.instructor_id == instructor_id
    ).order_by(Attendance.date.desc()).limit(5).all()
    
    # Check for maintenance announcement
    announcements = []
    try:
        from models import AdminSettings
        
        now = datetime.utcnow()
        settings = AdminSettings.query.first()
        
        if settings:
            # Scenario 1: During active maintenance
            if settings.maintenance_mode:
                # Format time range if available
                time_info = ""
                if settings.maintenance_start_time and settings.maintenance_end_time:
                    start_time = settings.maintenance_start_time.strftime('%B %d, %Y at %I:%M %p')
                    end_time = settings.maintenance_end_time.strftime('%B %d, %Y at %I:%M %p')
                    time_info = f" from {start_time} to {end_time}"
                elif settings.maintenance_start_time:
                    start_time = settings.maintenance_start_time.strftime('%B %d, %Y at %I:%M %p')
                    time_info = f" starting at {start_time}"
                
                # Create announcement object for active maintenance
                announcements.append({
                    'id': 'maintenance',
                    'title': 'System Maintenance (Limited Access)',
                    'date': datetime.now().strftime('%B %d, %Y'),
                    'content': f"{settings.maintenance_message or 'The system is currently undergoing maintenance'}{time_info}. During maintenance, you can only view this dashboard. All other system functionality is unavailable until maintenance ends or is turned off by an administrator. Students and other users cannot access the system at all during this time.",
                    'type': 'warning',
                    'is_maintenance': True,
                    'created_at': datetime.now()
                })
            
            # Scenario 2: Upcoming scheduled maintenance
            elif settings.maintenance_start_time and not settings.maintenance_mode:
                # Check if maintenance is scheduled within the next 48 hours
                if now < settings.maintenance_start_time and settings.maintenance_start_time - now <= timedelta(hours=48):
                    # Format time range
                    start_time = settings.maintenance_start_time.strftime('%B %d, %Y at %I:%M %p')
                    time_info = f" on {start_time}"
                    if settings.maintenance_end_time:
                        end_time = settings.maintenance_end_time.strftime('%B %d, %Y at %I:%M %p')
                        time_info = f" from {start_time} to {end_time}"
                    
                    # Create announcement object for upcoming maintenance
                    announcements.append({
                        'id': 'upcoming_maintenance',
                        'title': 'Upcoming System Maintenance',
                        'date': datetime.now().strftime('%B %d, %Y'),
                        'content': f"{settings.maintenance_message or 'The system will be undergoing scheduled maintenance'}{time_info}. IMPORTANT: When maintenance begins, all users except super administrators will be automatically logged out. Instructors will be able to view their dashboard, but not access other areas of the system. Please save your work and inform your students about this scheduled downtime.",
                        'type': 'info',
                        'is_maintenance': False,
                        'created_at': datetime.now()
                    })
            
            # Scenario 3: Additional announcement for active maintenance with scheduled end time
            elif settings.maintenance_mode and settings.maintenance_end_time and now < settings.maintenance_end_time:
                end_time = settings.maintenance_end_time.strftime('%B %d, %Y at %I:%M %p')
                announcements.append({
                    'id': 'maintenance_end',
                    'title': 'Maintenance End Time',
                    'date': datetime.now().strftime('%B %d, %Y'),
                    'content': f"The current maintenance is scheduled to end at {end_time}. The system will automatically become fully available to all users at that time.",
                    'type': 'info',
                    'is_maintenance': True,
                    'created_at': datetime.now()
                })
    except Exception as e:
        # Log the error but don't break the page
        current_app.logger.error(f"Error retrieving maintenance settings: {str(e)}")
    
    # Mock schedule for sample view if no data exists
    if not any(schedule.values()):
        # Create sample schedule based on the screenshot data
        schedule = {
            'Monday': [
                {'name': 'General Engineering', 'start_time': '8:00am', 'end_time': '10:00am'},
                {'name': 'General Engineering', 'start_time': '9:30am', 'end_time': '11:00am'},
                {'name': 'General Engineering', 'start_time': '11:15am', 'end_time': '12:45pm'},
                {'name': 'General Engineering', 'start_time': '1:15pm', 'end_time': '2:45pm'},
                {'name': 'General Engineering', 'start_time': '3:00pm', 'end_time': '4:50pm'}
            ],
            'Tuesday': [
                {'name': 'Engineering for England', 'start_time': '8:00am', 'end_time': '10:00am'},
                {'name': 'Engineering for England', 'start_time': '9:30am', 'end_time': '11:00am'},
                {'name': 'Engineering for England', 'start_time': '11:15am', 'end_time': '12:45pm'},
                {'name': 'Engineering for England', 'start_time': '1:15pm', 'end_time': '2:45pm'},
                {'name': 'Engineering for England', 'start_time': '3:00pm', 'end_time': '4:50pm'}
            ],
            'Wednesday': [
                {'name': 'Manufacturing Engineering', 'start_time': '8:00am', 'end_time': '10:00am'},
                {'name': 'Manufacturing Engineering', 'start_time': '10:15am', 'end_time': '12:15am'},
                {'name': 'Manufacturing Engineering', 'start_time': '1:00pm', 'end_time': '3:00pm'},
                {'name': 'Manufacturing Engineering', 'start_time': '3:00pm', 'end_time': '4:50pm'}
            ],
            'Thursday': [
                {'name': 'Literature', 'start_time': '8:00am', 'end_time': '11:00am'},
                {'name': 'Applied Computing', 'start_time': '10:15am', 'end_time': '12:15am'},
                {'name': 'Biology', 'start_time': '1:00pm', 'end_time': '3:00pm'},
                {'name': 'Quiz', 'start_time': '3:00pm', 'end_time': '4:50pm'}
            ],
            'Friday': [
                {'name': 'Drama and Theatre art', 'start_time': '8:00am', 'end_time': '11:00am'},
                {'name': 'Finance management', 'start_time': '10:15am', 'end_time': '12:15am'},
                {'name': 'Research', 'start_time': '1:00pm', 'end_time': '3:00pm'},
                {'name': 'History', 'start_time': '3:00pm', 'end_time': '4:50pm'}
            ]
        }
    
    return render_template('instructor/dashboard.html',
                           active_page='dashboard',
                           classes=classes,
                           class_count=class_count,
                           student_count=student_count,
                           upcoming_classes=upcoming_classes,
                           recent_attendance=recent_attendance,
                           instructor_classes=instructor_classes,
                           schedule=schedule,
                           announcements=announcements)

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