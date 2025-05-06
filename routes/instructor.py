from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify, current_app, session, Response
from flask_login import login_required, current_user
from models import db, User, Class, Enrollment, Attendance
from datetime import datetime, date, timedelta
import os
import csv
import io
import traceback
from werkzeug.utils import secure_filename

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

@instructor_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def instructor_profile():
    """Main profile view for instructors."""
    # Get the current instructor data
    instructor = User.query.filter_by(id=current_user.id).first()
    
    # Check if this is a first-time login that requires password change
    change_password = request.args.get('change_password') == 'True' or session.get('password_change_required')
    
    # For GET requests, render the template
    if request.method == 'GET':
        return render_template('instructor/profile.html', 
                               instructor=instructor,
                               active_page='instructor_profile',
                               change_password=change_password)
    
    # POST requests are now handled by dedicated routes
    return redirect(url_for('instructor.instructor_profile'))

@instructor_bp.route('/update-profile', methods=['POST'])
@login_required
def update_profile():
    """Handle instructor profile information updates."""
    try:
        # Get the current instructor
        instructor = User.query.filter_by(id=current_user.id).first()
        
        # Update basic profile information
        instructor.first_name = request.form.get('firstName', instructor.first_name)
        instructor.last_name = request.form.get('lastName', instructor.last_name)
        instructor.email = request.form.get('email', instructor.email)
        instructor.department = request.form.get('department', instructor.department)
        instructor.qualification = request.form.get('qualification', instructor.qualification)
        instructor.specialization = request.form.get('specialization', instructor.specialization)
        
        db.session.commit()
        flash('Profile updated successfully', 'success')
        current_app.logger.info(f"Profile updated for instructor {instructor.id}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating profile: {str(e)}")
        flash(f'Error updating profile: {str(e)}', 'error')
    
    return redirect(url_for('instructor.instructor_profile'))

@instructor_bp.route('/update-password', methods=['POST'])
@login_required
def update_password():
    """Handle instructor password updates with validation."""
    try:
        # Get form data
        current_password = request.form.get('currentPassword')
        new_password = request.form.get('newPassword')
        confirm_password = request.form.get('confirmPassword')
        
        # Get the current instructor
        instructor = User.query.filter_by(id=current_user.id).first()
        
        # Check if this is a first login (password change is required)
        is_first_login = instructor.first_login
        
        # If it's not first login, verify current password
        if not is_first_login and not instructor.check_password(current_password):
            flash('Current password is incorrect', 'error')
            return redirect(url_for('instructor.instructor_profile'))
        
        # Verify new password and confirmation match
        if new_password != confirm_password:
            flash('New password and confirmation do not match', 'error')
            return redirect(url_for('instructor.instructor_profile', change_password=is_first_login))
        
        # Update password
        instructor.set_password(new_password)
        
        # If this was first login, update the flag and remove the session flag
        if is_first_login:
            instructor.first_login = False
            if 'password_change_required' in session:
                session.pop('password_change_required')
        
        db.session.commit()
        flash('Password updated successfully', 'success')
        current_app.logger.info(f"Password updated for instructor {instructor.id}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating password: {str(e)}")
        flash(f'Error updating password: {str(e)}', 'error')
    
    return redirect(url_for('instructor.instructor_profile'))

@instructor_bp.route('/update-notification-settings', methods=['POST'])
@login_required
def update_notification_settings():
    """Handle notification preference updates."""
    try:
        # Get the current instructor
        instructor = User.query.filter_by(id=current_user.id).first()
        
        # Initialize settings if not exists
        if not hasattr(instructor, 'settings') or not instructor.settings:
            instructor.settings = {}
        
        # Update settings
        instructor.settings['email_notifications'] = 'emailNotifications' in request.form
        instructor.settings['sms_notifications'] = 'smsNotifications' in request.form
        instructor.settings['notification_frequency'] = request.form.get('notificationFrequency', 'immediate')
        
        db.session.commit()
        flash('Notification preferences updated successfully', 'success')
        current_app.logger.info(f"Notification settings updated for instructor {instructor.id}")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating notification preferences: {str(e)}")
        flash(f'Error updating notification preferences: {str(e)}', 'error')
    
    return redirect(url_for('instructor.instructor_profile'))

@instructor_bp.route('/upload-profile-picture', methods=['POST'])
@login_required
def upload_profile_picture():
    """Handle profile picture uploads with enhanced security and error handling."""
    try:
        if 'profileImage' not in request.files:
            flash('No file selected', 'error')
            return redirect(url_for('instructor.instructor_profile'))
        
        file = request.files['profileImage']
        
        if file.filename == '':
            flash('No file selected', 'error')
            return redirect(url_for('instructor.instructor_profile'))
        
        if file and allowed_file(file.filename):
            # Check if UPLOAD_FOLDER is configured
            if 'UPLOAD_FOLDER' not in current_app.config:
                current_app.logger.error("UPLOAD_FOLDER configuration missing")
                flash('Server configuration error: Upload folder not configured', 'error')
                return redirect(url_for('instructor.instructor_profile'))
            
            # Generate secure filename
            filename = secure_filename(file.filename)
            
            # Add timestamp to make filename unique
            base, ext = os.path.splitext(filename)
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            unique_filename = f"{current_user.id}_{base}_{timestamp}{ext}"
            
            # Ensure upload directory exists
            upload_folder = current_app.config['UPLOAD_FOLDER']
            os.makedirs(upload_folder, exist_ok=True)
            
            # Save the file with size validation
            if file.content_length and file.content_length > current_app.config.get('MAX_CONTENT_LENGTH', 5 * 1024 * 1024):
                flash('File is too large. Maximum size is 5MB.', 'error')
                return redirect(url_for('instructor.instructor_profile'))
                
            file_path = os.path.join(upload_folder, unique_filename)
            file.save(file_path)
            
            # Update the user's profile image in database
            instructor = User.query.get(current_user.id)
            instructor.profile_img = unique_filename
            db.session.commit()
            
            flash('Profile picture updated successfully', 'success')
            current_app.logger.info(f"Profile picture updated for instructor {instructor.id}")
        else:
            flash('Invalid file type. Please upload an image file (jpg, png, gif).', 'error')
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error uploading profile picture: {str(e)}")
        flash(f'Error uploading profile picture: {str(e)}', 'error')
    
    return redirect(url_for('instructor.instructor_profile'))

def allowed_file(filename):
    """Check if the file extension is allowed"""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS 

@instructor_bp.route('/api/attendance', methods=['GET'])
@login_required
def get_instructor_attendance():
    """API endpoint to get attendance records for an instructor"""
    try:
        # Check if user is instructor
        if not hasattr(current_user, 'role') or current_user.role.lower() != 'instructor':
            return jsonify({'error': 'Unauthorized access'}), 403
            
        # Get instructor ID
        instructor_id = current_user.id
        
        # Get filter parameters
        class_id = request.args.get('class_id', '')
        student_name = request.args.get('student_name', '')
        date_start = request.args.get('date_start', '')
        date_end = request.args.get('date_end', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        # Build query
        query = db.session.query(
            Attendance, User, Class
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        ).filter(
            Class.instructor_id == instructor_id,
            User.role == 'Student',
            Attendance.is_archived == False
        )
        
        # Apply filters
        if class_id:
            query = query.filter(Class.id == class_id)
        
        if student_name:
            query = query.filter(
                (User.first_name.ilike(f'%{student_name}%')) |
                (User.last_name.ilike(f'%{student_name}%'))
            )
        
        if date_start:
            try:
                start_date = datetime.strptime(date_start, '%Y-%m-%d').date()
                query = query.filter(Attendance.date >= start_date)
            except ValueError:
                pass
                
        if date_end:
            try:
                end_date = datetime.strptime(date_end, '%Y-%m-%d').date()
                query = query.filter(Attendance.date <= end_date)
            except ValueError:
                pass
        
        # Get total count for pagination
        total_records = query.count()
        
        # Calculate stats
        stats_query = db.session.query(
            Attendance.status, db.func.count(Attendance.id)
        ).join(
            Class, Attendance.class_id == Class.id
        ).filter(
            Class.instructor_id == instructor_id,
            Attendance.is_archived == False
        ).group_by(Attendance.status)
        
        # Apply the same filters to stats
        if class_id:
            stats_query = stats_query.filter(Class.id == class_id)
            
        if student_name:
            stats_query = stats_query.join(
                User, Attendance.student_id == User.id
            ).filter(
                (User.first_name.ilike(f'%{student_name}%')) |
                (User.last_name.ilike(f'%{student_name}%'))
            )
            
        if date_start:
            try:
                start_date = datetime.strptime(date_start, '%Y-%m-%d').date()
                stats_query = stats_query.filter(Attendance.date >= start_date)
            except ValueError:
                pass
                
        if date_end:
            try:
                end_date = datetime.strptime(date_end, '%Y-%m-%d').date()
                stats_query = stats_query.filter(Attendance.date <= end_date)
            except ValueError:
                pass
        
        # Execute stats query
        stats_results = stats_query.all()
        
        # Format stats
        stats = {
            'total': total_records,
            'present': 0,
            'absent': 0,
            'late': 0,
            'other': 0
        }
        
        for status, count in stats_results:
            status_lower = status.lower() if status else 'other'
            if status_lower in ['present', 'absent', 'late']:
                stats[status_lower] = count
            else:
                stats['other'] += count
        
        # Sort by date (most recent first) then by class name
        query = query.order_by(Attendance.date.desc(), Class.name)
        
        # Apply pagination
        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page)
        
        # Execute query
        results = query.all()
        
        # Format records
        records = []
        for attendance, student, class_obj in results:
            record = {
                'id': attendance.id,
                'date': attendance.date.strftime('%Y-%m-%d'),
                'status': attendance.status,
                'comment': attendance.comments,
                'student_id': student.id,
                'student_name': f"{student.first_name} {student.last_name}",
                'student_email': student.email,
                'student_profile_img': student.profile_img,
                'class_id': class_obj.id,
                'class_name': class_obj.name
            }
            records.append(record)
        
        # Format response
        response = {
            'records': records,
            'pagination': {
                'total': total_records,
                'page': page,
                'per_page': per_page,
                'pages': (total_records + per_page - 1) // per_page
            },
            'stats': stats
        }
        
        return jsonify(response)
    except Exception as e:
        print(f"Error fetching instructor attendance: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@instructor_bp.route('/api/attendance/<string:record_id>', methods=['GET'])
@login_required
def get_instructor_attendance_record(record_id):
    """API endpoint to get a specific attendance record for an instructor"""
    try:
        # Check if user is instructor
        if not hasattr(current_user, 'role') or current_user.role.lower() != 'instructor':
            return jsonify({'error': 'Unauthorized access'}), 403
            
        # Get instructor ID
        instructor_id = current_user.id
        
        # Get the attendance record
        attendance = db.session.query(
            Attendance, User, Class
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        ).filter(
            Attendance.id == record_id,
            Class.instructor_id == instructor_id
        ).first()
        
        if not attendance:
            return jsonify({'error': 'Attendance record not found or unauthorized'}), 404
            
        # Format record
        record = {
            'id': attendance[0].id,
            'date': attendance[0].date.strftime('%Y-%m-%d'),
            'status': attendance[0].status,
            'comment': attendance[0].comments,
            'student_id': attendance[1].id,
            'student_name': f"{attendance[1].first_name} {attendance[1].last_name}",
            'student_email': attendance[1].email,
            'student_profile_img': attendance[1].profile_img,
            'class_id': attendance[2].id,
            'class_name': attendance[2].name
        }
        
        return jsonify(record)
    except Exception as e:
        # print(f"Error fetching attendance record: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@instructor_bp.route('/api/attendance/<string:record_id>', methods=['PUT'])
@login_required
def update_instructor_attendance_record(record_id):
    """API endpoint to update a specific attendance record for an instructor"""
    try:
        # Check if user is instructor
        if not hasattr(current_user, 'role') or current_user.role.lower() != 'instructor':
            return jsonify({'error': 'Unauthorized access'}), 403
            
        # Get instructor ID
        instructor_id = current_user.id
        
        # Get JSON data from request
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Get the attendance record
        attendance_query = db.session.query(
            Attendance
        ).join(
            Class, Attendance.class_id == Class.id
        ).filter(
            Attendance.id == record_id,
            Class.instructor_id == instructor_id
        )
        
        attendance = attendance_query.first()
        
        if not attendance:
            return jsonify({'error': 'Attendance record not found or unauthorized'}), 404
            
        # Update fields
        if 'status' in data:
            attendance.status = data['status']
            
        if 'comment' in data:
            attendance.comments = data['comment']
            
        # Update timestamp
        attendance.updated_at = datetime.now()
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Attendance record updated successfully'
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error updating attendance record: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@instructor_bp.route('/export-attendance', methods=['GET'])
@login_required
def export_instructor_attendance():
    """Export attendance records to CSV for an instructor"""
    try:
        # Check if user is instructor
        if not hasattr(current_user, 'role') or current_user.role.lower() != 'instructor':
            flash('Unauthorized access', 'error')
            return redirect(url_for('auth.login'))
            
        # Get instructor ID
        instructor_id = current_user.id
        
        # Get filter parameters
        class_id = request.args.get('class_id', '')
        student_name = request.args.get('student_name', '')
        date_start = request.args.get('date_start', '')
        date_end = request.args.get('date_end', '')
        export_format = request.args.get('format', 'csv').lower()
        
        # Build query
        query = db.session.query(
            Attendance, User, Class
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        ).filter(
            Class.instructor_id == instructor_id,
            User.role == 'Student',
            Attendance.is_archived == False
        )
        
        # Apply filters
        if class_id:
            query = query.filter(Class.id == class_id)
        
        if student_name:
            query = query.filter(
                (User.first_name.ilike(f'%{student_name}%')) |
                (User.last_name.ilike(f'%{student_name}%'))
            )
        
        if date_start:
            try:
                start_date = datetime.strptime(date_start, '%Y-%m-%d').date()
                query = query.filter(Attendance.date >= start_date)
            except ValueError:
                pass
                
        if date_end:
            try:
                end_date = datetime.strptime(date_end, '%Y-%m-%d').date()
                query = query.filter(Attendance.date <= end_date)
            except ValueError:
                pass
        
        # Sort by date (most recent first) then by class name
        query = query.order_by(Attendance.date.desc(), Class.name)
        
        # Execute query
        results = query.all()
        
        if export_format == 'csv':
            # Create CSV in memory
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow(['Date', 'Student Name', 'Student Email', 'Class', 'Status', 'Comment'])
            
            # Write data
            for attendance, student, class_obj in results:
                writer.writerow([
                    attendance.date.strftime('%Y-%m-%d'),
                    f"{student.first_name} {student.last_name}",
                    student.email,
                    class_obj.name,
                    attendance.status,
                    attendance.comments or ''
                ])
            
            # Prepare response
            output.seek(0)
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename=attendance_export_{timestamp}.csv'
                }
            )
        else:
            flash('Unsupported export format', 'error')
            return redirect(url_for('instructor.view_attendance'))
    except Exception as e:
        print(f"Error exporting attendance: {str(e)}")
        traceback.print_exc()
        flash(f'Error exporting attendance: {str(e)}', 'error')
        return redirect(url_for('instructor.view_attendance'))