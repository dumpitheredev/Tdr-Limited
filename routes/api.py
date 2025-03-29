from flask import Blueprint, jsonify, request, make_response
from flask_login import login_required
from models import db, User, Class, Enrollment, Company, Attendance
from datetime import datetime
import csv
from io import StringIO
from sqlalchemy import text

# Create API blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/users', methods=['GET'])
@login_required
def get_users():
    """API endpoint to get all users with optional filtering"""
    # Get filter parameters
    role_filter = request.args.get('role', '')
    status_filter = request.args.get('status', '')
    search = request.args.get('search', '')
    
    # Build query
    query = User.query
    
    if role_filter:
        query = query.filter(User.role == role_filter)
    
    if status_filter:
        is_active = status_filter.lower() == 'active'
        query = query.filter(User.is_active == is_active)
    
    if search:
        query = query.filter(
            (User.first_name.like(f'%{search}%')) |
            (User.last_name.like(f'%{search}%')) |
            (User.email.like(f'%{search}%'))
        )
    
    users = query.all()
    
    # Format response
    result = []
    for user in users:
        result.append({
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'role': user.role,
            'is_active': user.is_active,
            'profile_img': user.profile_img
        })
    
    return jsonify(result)

@api_bp.route('/users/<string:user_id>', methods=['GET'])
@login_required
def get_user(user_id):
    """API endpoint to get a specific user by ID"""
    user = User.query.get_or_404(user_id)
    
    result = {
        'id': user.id,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'role': user.role,
        'is_active': user.is_active,
        'profile_img': user.profile_img
    }
    
    # If user is a student, include additional information
    if user.role == 'Student':
        # Get company info
        company_name = "Not Assigned"
        if user.company_id:
            company = Company.query.get(user.company_id)
            if company:
                company_name = company.name
        
        result['student_info'] = {
            'company': company_name,
            'company_id': user.company_id,
            'enrolled_classes': []
        }
        
        # Get enrolled classes
        enrollments = Enrollment.query.filter_by(student_id=user.id).all()
        for enrollment in enrollments:
            class_obj = Class.query.get(enrollment.class_id)
            if class_obj:
                result['student_info']['enrolled_classes'].append({
                    'class_id': class_obj.id,
                    'name': class_obj.name,
                    'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}"
                })
    
    return jsonify(result)

@api_bp.route('/students', methods=['GET'])
@login_required
def get_students():
    """API endpoint to get all students with optional filtering"""
    # Get filter parameters
    status_filter = request.args.get('status', '')
    search = request.args.get('search', '')
    
    # Build query
    students = User.query.filter_by(role='Student')
    
    if status_filter:
        is_active = status_filter.lower() == 'active'
        students = students.filter(User.is_active == is_active)
    
    if search:
        students = students.filter(
            (User.first_name.like(f'%{search}%')) |
            (User.last_name.like(f'%{search}%')) |
            (User.email.like(f'%{search}%')) |
            (User.id.like(f'%{search}%'))
        )
    
    students = students.all()
    
    # Format response
    result = []
    for student in students:
        # Get company info if available
        company_name = "Not Assigned"
        if student.company_id:
            company = Company.query.get(student.company_id)
            if company:
                company_name = company.name
        
        # Get enrolled classes
        enrolled_classes = []
        enrollments = Enrollment.query.filter_by(student_id=student.id).all()
        for enrollment in enrollments:
            class_obj = Class.query.get(enrollment.class_id)
            if class_obj:
                enrolled_classes.append({
                    'class_id': class_obj.id,
                    'name': class_obj.name,
                    'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}"
                })
        
        result.append({
            'id': student.id,
            'user_id': student.id,
            'name': f"{student.first_name} {student.last_name}",
            'email': student.email,
            'status': 'Active' if student.is_active else 'Inactive',
            'company': company_name,
            'enrolled_classes': enrolled_classes,
            'profile_img': student.profile_img
        })
    
    return jsonify(result)

@api_bp.route('/students/unenrolled', methods=['GET'])
@login_required
def get_unenrolled_students():
    """API endpoint to get students who aren't enrolled in any classes"""
    # Get all students
    students = User.query.filter_by(role='Student').all()
    
    # Filter out those who are already enrolled
    unenrolled = []
    for student in students:
        # Check if this student has any enrollments
        enrollments = Enrollment.query.filter_by(student_id=student.id).count()
        if enrollments == 0:
            unenrolled.append({
                'user_id': student.id,
                'name': f"{student.first_name} {student.last_name}",
                'email': student.email
            })
    
    return jsonify(unenrolled)

@api_bp.route('/instructors', methods=['GET'])
@login_required
def get_instructors():
    """API endpoint to get all instructors with optional filtering"""
    # Get filter parameters
    status_filter = request.args.get('status', '')
    search = request.args.get('search', '')
    
    # Get users with instructor role
    query = User.query.filter_by(role='Instructor')
    
    if status_filter:
        is_active = status_filter.lower() == 'active'
        query = query.filter(User.is_active == is_active)
    
    if search:
        query = query.filter(
            (User.first_name.like(f'%{search}%')) |
            (User.last_name.like(f'%{search}%')) |
            (User.email.like(f'%{search}%'))
        )
    
    instructors = query.all()
    
    # Format response
    result = []
    for instructor in instructors:
        # Get classes taught by this instructor
        classes_taught = Class.query.filter_by(instructor_id=instructor.id).all()
        
        class_list = []
        for class_obj in classes_taught:
            class_list.append({
                'class_id': class_obj.id,
                'name': class_obj.name,
                'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}"
            })
        
        result.append({
            'id': instructor.id,
            'user_id': instructor.id,
            'name': f"{instructor.first_name} {instructor.last_name}",
            'email': instructor.email,
            'status': 'Active' if instructor.is_active else 'Inactive',
            'classes': class_list,
            'profile_img': instructor.profile_img
        })
    
    return jsonify(result)

@api_bp.route('/companies', methods=['GET'])
@login_required
def get_companies():
    """API endpoint to get all companies"""
    companies = Company.query.all()
    
    result = []
    for company in companies:
        result.append({
            'company_id': company.company_id,
            'name': company.name,
            'contact': company.contact,
            'email': company.email,
            'status': company.status
        })
    
    return jsonify(result)

@api_bp.route('/classes', methods=['GET', 'POST'])
@login_required
def get_classes():
    """API endpoint to get all classes with optional filtering or create a new class"""
    # Handle POST request to create a new class
    if request.method == 'POST':
        # Get JSON data from request
        data = request.json
        
        # Debug: Log received data
        print("Received class creation data:", data)
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['name', 'day', 'time', 'year']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
                
        print("Instructor ID:", data.get('instructor_id'))
        
        try:
            # Generate a unique class ID
            import string
            import random
            class_id = 'kl' + ''.join(random.choices('0123456789', k=2)) + ''.join(random.choices(string.ascii_lowercase, k=2))
            
            # Check if the ID already exists, if so, generate a new one
            while Class.query.get(class_id) is not None:
                class_id = 'kl' + ''.join(random.choices('0123456789', k=2)) + ''.join(random.choices(string.ascii_lowercase, k=2))
            
            # Parse time format "HH:MM - HH:MM"
            time_parts = data['time'].split(' - ')
            if len(time_parts) != 2:
                return jsonify({'error': 'Invalid time format. Expected format: "HH:MM - HH:MM"'}), 400
            
            start_time = datetime.strptime(time_parts[0], '%H:%M').time()
            end_time = datetime.strptime(time_parts[1], '%H:%M').time()
            
            # Create new class
            new_class = Class(
                id=class_id,
                name=data['name'],
                description=data.get('description'),
                day_of_week=data['day'],
                term=data['year'],
                instructor_id=data.get('instructor_id') if data.get('instructor_id') else None,
                start_time=start_time,
                end_time=end_time,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            # Add to database
            db.session.add(new_class)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Class created successfully',
                'class_id': class_id
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to create class: {str(e)}'}), 500
    
    # Handle GET request
    # Get filter parameters
    status_filter = request.args.get('status', '')
    instructor_id = request.args.get('instructor_id', '')
    
    # Check if we're looking for a recently restored class
    restored_id = request.args.get('restored', '')
    if restored_id:
        print(f"Looking for recently restored class with ID: {restored_id}")
        # Check if this class exists and its status
        restored_class = Class.query.get(restored_id)
        if restored_class:
            print(f"Found restored class: {restored_class.name}, active: {restored_class.is_active}")
            print(f"Description: {restored_class.description}")
    
    # BUILD QUERY - IMPORTANT: Include all classes, whether active or not
    # Only exclude classes with valid ARCHIVE NOTEs that are inactive
    # This ensures properly archived classes don't show up, but restored ones do
    
    # Start with all classes
    query = Class.query
    
    # Only exclude inactive classes that have ARCHIVE NOTE (truly archived)
    # Active classes and inactive classes without ARCHIVE NOTE will be included
    query = query.filter(
        (Class.is_active == True) |  # Active classes should always be included
        (
            (Class.is_active == False) &  # Only filter inactive classes
            (
                (Class.description.is_(None)) |  # with no description
                (Class.description == '') |      # or empty description
                (~Class.description.like('%ARCHIVE NOTE%'))  # or without ARCHIVE NOTE
            )
        )
    )
    
    # If explicitly filtering by status, apply that filter instead
    if status_filter:
        is_active = status_filter == 'Active'
        query = query.filter(Class.is_active == is_active)
    
    if instructor_id:
        query = query.filter(Class.instructor_id == instructor_id)
    
    # Execute query and check count before processing
    classes = query.all()
    print(f"Found {len(classes)} classes in get_classes API")
    
    # Debug first 5 classes if any exist
    for i, class_obj in enumerate(classes[:5]):
        print(f"Class {i+1}: ID={class_obj.id}, Name={class_obj.name}, Active={class_obj.is_active}")
        if class_obj.description:
            print(f"  Description: {class_obj.description[:50]}...")
    
    result = []
    for class_obj in classes:
        # Get instructor info
        instructor_name = "Not Assigned"
        if class_obj.instructor_id:
            instructor = User.query.get(class_obj.instructor_id)
            if instructor:
                instructor_name = f"{instructor.first_name} {instructor.last_name}"
        
        result.append({
            'class_id': class_obj.id,
            'name': class_obj.name,
            'day': class_obj.day_of_week,
            'time': f"{class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}",
            'year': class_obj.term,
            'instructor': instructor_name,
            'status': 'Active' if class_obj.is_active else 'Inactive'
        })
    
    return jsonify(result)

@api_bp.route('/classes/<string:class_id>', methods=['GET'])
@login_required
def get_class(class_id):
    """API endpoint to get a specific class by ID"""
    class_obj = Class.query.get_or_404(class_id)
    
    # Get instructor info
    instructor_name = "Not Assigned"
    instructor_id = ""
    if class_obj.instructor_id:
        instructor = User.query.get(class_obj.instructor_id)
        if instructor:
            instructor_name = f"{instructor.first_name} {instructor.last_name}"
            instructor_id = instructor.id
    
    result = {
        'class_id': class_obj.id,
        'name': class_obj.name,
        'day': class_obj.day_of_week,
        'time': f"{class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}",
        'year': class_obj.term,
        'instructor': instructor_name,
        'instructor_id': instructor_id,
        'status': 'Active' if class_obj.is_active else 'Inactive',
        'description': class_obj.description
    }
    
    return jsonify(result)

@api_bp.route('/classes/<string:class_id>', methods=['PUT'])
@login_required
def update_class(class_id):
    """API endpoint to update a specific class"""
    class_obj = Class.query.get_or_404(class_id)
    
    # Get JSON data from request
    data = request.json
    
    # Update class fields if provided
    if 'name' in data:
        class_obj.name = data['name']
    if 'description' in data:
        class_obj.description = data['description']
    if 'day' in data:
        class_obj.day_of_week = data['day']
    if 'year' in data:
        class_obj.term = data['year']
    if 'instructor_id' in data:
        class_obj.instructor_id = data['instructor_id']
    if 'status' in data:
        class_obj.is_active = (data['status'] == 'Active')
    
    # Update time fields if provided
    if 'time' in data:
        try:
            time_parts = data['time'].split(' - ')
            if len(time_parts) == 2:
                start_time = datetime.strptime(time_parts[0], '%H:%M').time()
                end_time = datetime.strptime(time_parts[1], '%H:%M').time()
                class_obj.start_time = start_time
                class_obj.end_time = end_time
        except Exception as e:
            return jsonify({'error': f'Invalid time format: {e}'}), 400
    
    # Save changes to database
    try:
        db.session.commit()
        return jsonify({'success': True, 'message': 'Class updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update class: {e}'}), 500

@api_bp.route('/classes/<string:class_id>/attendance', methods=['GET'])
@login_required
def get_class_attendance(class_id):
    """API endpoint to get attendance records for a specific class"""
    try:
        # Verify the class exists
        class_obj = Class.query.get_or_404(class_id)
        
        # Get optional date range filters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Build query for attendance records
        query = db.session.query(
            Attendance.id,
            Attendance.student_id,
            Attendance.class_id,
            Attendance.date,
            Attendance.status,
            Attendance.created_at,
            User.id.label('user_id'),
            User.first_name,
            User.last_name
        ).join(
            User, Attendance.student_id == User.id
        ).filter(
            Attendance.class_id == class_id
        )
        
        # Apply date filters if provided
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                query = query.filter(Attendance.date >= start)
            except ValueError:
                pass
                
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                query = query.filter(Attendance.date <= end)
            except ValueError:
                pass
        
        # Execute the query directly
        attendance_records = query.all()
        
        # Format the response
        result = []
        for record in attendance_records:
            # Normalize status values to proper case
            status = record.status if record.status else "Unknown"
            
            # Always capitalize the first letter of the status to match enum values
            normalized_status = status.capitalize()
            
            # Make sure it matches one of our expected values
            if normalized_status not in ['Present', 'Absent', 'Late']:
                normalized_status = 'Present'  # Default to Present if unknown
            
            result.append({
                'id': record.id,
                'date': record.date.strftime('%Y-%m-%d'),
                'status': normalized_status,
                'student_id': record.student_id,
                'student_name': f"{record.first_name} {record.last_name}",
                'timestamp': record.created_at.isoformat() if record.created_at else None
            })
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in attendance API: {str(e)}")
        return jsonify([]), 200  # Return empty array with 200 status to prevent breaking the UI 

@api_bp.route('/attendance/save', methods=['POST'])
@login_required
def save_attendance():
    """API endpoint to save attendance records for multiple students"""
    try:
        # Get JSON data from request
        data = request.json
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        # Validate required fields
        if 'class_id' not in data or 'date' not in data or 'records' not in data:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
            
        # Parse date
        try:
            attendance_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid date format'}), 400
            
        # Verify the class exists
        class_obj = Class.query.get_or_404(data['class_id'])
        
        # Process each student record
        success_count = 0
        error_count = 0
        
        for record in data['records']:
            try:
                # Required fields in each record
                if 'student_id' not in record or 'status' not in record:
                    error_count += 1
                    continue
                    
                # Normalize status to match enum values (capitalize first letter)
                status = record['status'].capitalize()
                
                # Make sure it's one of our valid status values
                if status not in ['Present', 'Absent', 'Late']:
                    status = 'Present'  # Default to Present if unknown
                
                # Check if record already exists
                existing = Attendance.query.filter_by(
                    student_id=record['student_id'],
                    class_id=data['class_id'],
                    date=attendance_date
                ).first()
                
                if existing:
                    # Update existing record
                    existing.status = status
                    existing.comments = record.get('comment', '')
                    existing.updated_at = datetime.utcnow()
                else:
                    # Create new attendance record
                    new_attendance = Attendance(
                        student_id=record['student_id'],
                        class_id=data['class_id'],
                        date=attendance_date,
                        status=status,
                        comments=record.get('comment', ''),
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    db.session.add(new_attendance)
                
                success_count += 1
                
            except Exception as e:
                print(f"Error processing attendance record: {str(e)}")
                error_count += 1
                
        # Commit all changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Attendance saved successfully. {success_count} records processed, {error_count} errors.',
            'records_processed': success_count,
            'errors': error_count
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error saving attendance: {str(e)}")
        return jsonify({'success': False, 'message': f'Error saving attendance: {str(e)}'}), 500

@api_bp.route('/attendance/<int:record_id>', methods=['PUT'])
@login_required
def update_attendance(record_id):
    """API endpoint to update a specific attendance record"""
    try:
        # Get JSON data from request
        data = request.json
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        # Get the attendance record
        attendance = Attendance.query.get_or_404(record_id)
        
        # Update status if provided
        if 'status' in data:
            # Normalize status to match enum values (capitalize first letter)
            status = data['status'].capitalize()
            
            # Make sure it's one of our valid status values
            if status not in ['Present', 'Absent', 'Late']:
                status = 'Present'  # Default to Present if unknown
                
            attendance.status = status
            
        # Update comment if provided
        if 'comment' in data:
            attendance.comments = data['comment']
            
        # Update timestamp
        attendance.updated_at = datetime.utcnow()
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Attendance record updated successfully',
            'record': {
                'id': attendance.id,
                'date': attendance.date.strftime('%Y-%m-%d'),
                'status': attendance.status,
                'student_id': attendance.student_id,
                'comment': attendance.comments
            }
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating attendance: {str(e)}")
        return jsonify({'success': False, 'message': f'Error updating attendance: {str(e)}'}), 500 

@api_bp.route('/classes/export-csv', methods=['GET'])
@login_required
def export_classes_csv():
    """API endpoint to export classes to CSV"""
    # Get filter parameters
    status_filter = request.args.get('status', '')
    search_term = request.args.get('search', '')
    
    # Build query
    query = Class.query
    
    if status_filter:
        # Check if filter is 'Active' or 'Inactive' and convert to boolean
        is_active = status_filter == 'Active'
        query = query.filter(Class.is_active == is_active)
    
    if search_term:
        query = query.filter(
            (Class.name.like(f'%{search_term}%')) | 
            (Class.id.like(f'%{search_term}%'))
        )
    
    classes = query.all()
    
    # Create CSV string
    output = StringIO()
    writer = csv.writer(output)
    
    # Write headers
    writer.writerow(['Class ID', 'Name', 'Day', 'Time', 'Instructor', 'Academic Year', 'Status'])
    
    # Write data
    for class_obj in classes:
        # Get instructor name if available
        instructor_name = "Not Assigned"
        if class_obj.instructor_id:
            instructor = User.query.get(class_obj.instructor_id)
            if instructor:
                instructor_name = f"{instructor.first_name} {instructor.last_name}"
        
        # Format time
        time_str = f"{class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}"
        
        # Determine status text
        status = 'Active' if class_obj.is_active else 'Inactive'
        
        writer.writerow([
            class_obj.id,
            class_obj.name,
            class_obj.day_of_week,
            time_str,
            instructor_name,
            class_obj.term,  # Using term instead of academic_year
            status
        ])
    
    # Create the response
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename=classes_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    
    return response 

@api_bp.route('/classes/<string:class_id>/status', methods=['PUT'])
@login_required
def update_class_status(class_id):
    """API endpoint to update the status of a specific class"""
    try:
        class_obj = Class.query.get_or_404(class_id)
        
        # Get JSON data from request
        data = request.json
        
        if not data or 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
            
        # Update status
        new_status = data['status']
        class_obj.is_active = (new_status == 'Active')
        
        # If marking as inactive and archive note is provided, this is a true archive operation
        if new_status == 'Inactive' and 'archiveNote' in data and data['archiveNote']:
            # Add to the description field
            archive_timestamp = datetime.now().strftime('%Y-%m-%d')
            if class_obj.description:
                class_obj.description += f"\n\nARCHIVE NOTE ({archive_timestamp}): {data['archiveNote']}"
            else:
                class_obj.description = f"ARCHIVE NOTE ({archive_timestamp}): {data['archiveNote']}"
                
            # This is a proper archive, not just an inactive status change
            
        # Save changes to database
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Class status updated to {new_status}',
            'status': new_status
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating class status: {str(e)}")
        return jsonify({'error': f'Failed to update class status: {str(e)}'}), 500

@api_bp.route('/archives/<string:folder>', methods=['GET'])
@login_required
def get_archives(folder):
    """API endpoint to get archived records of a specific type (class, student, etc.)"""
    try:
        search_term = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        result = {'records': [], 'counts': {}}
        
        if folder == 'class':
            # Get inactive classes (archived) that have ARCHIVE NOTE
            query = Class.query.filter(
                Class.is_active == False,
                Class.description.like('%ARCHIVE NOTE%')
            )
            
            if search_term:
                query = query.filter(
                    (Class.name.like(f'%{search_term}%')) | 
                    (Class.id.like(f'%{search_term}%'))
                )
                
            archived_classes = query.all()
            properly_archived = []
            
            for class_obj in archived_classes:
                # Get instructor info
                instructor_name = "Not Assigned"
                if class_obj.instructor_id:
                    instructor = User.query.get(class_obj.instructor_id)
                    if instructor:
                        instructor_name = f"{instructor.first_name} {instructor.last_name}"
                
                # Parse archive date from description
                archive_date = "Unknown"
                try:
                    # Extract date from format: ARCHIVE NOTE (YYYY-MM-DD)
                    date_start = class_obj.description.find("ARCHIVE NOTE (") + 14
                    date_end = class_obj.description.find(")", date_start)
                    if date_start > 0 and date_end > 0:
                        archive_date = class_obj.description[date_start:date_end]
                except:
                    pass
                
                properly_archived.append({
                    'class_id': class_obj.id,
                    'name': class_obj.name,
                    'day': class_obj.day_of_week,
                    'time': f"{class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}",
                    'year': class_obj.term,
                    'instructor': instructor_name,
                    'archive_date': archive_date,
                    'description': class_obj.description
                })
            
            # Simple pagination for now
            start = (page - 1) * per_page
            end = start + per_page
            result['records'] = properly_archived[start:end]
            result['total'] = len(properly_archived)
        
        # Count all archived records for stats - use try/except for each count to prevent errors
        result['counts'] = {}
        
        # Count students
        try:
            result['counts']['student'] = User.query.filter_by(is_active=False, role='Student').count()
        except Exception as e:
            print(f"Error counting students: {str(e)}")
            result['counts']['student'] = 0
            
        # Count classes
        try:
            result['counts']['class'] = Class.query.filter(Class.is_active==False, Class.description.like('%ARCHIVE NOTE%')).count()
        except Exception as e:
            print(f"Error counting classes: {str(e)}")
            result['counts']['class'] = 0
            
        # Count companies
        try:
            # Use raw SQL to avoid model mapping issues
            company_count = db.session.execute(text("SELECT COUNT(*) FROM company WHERE status = 'Inactive'")).scalar()
            result['counts']['company'] = company_count
        except Exception as e:
            print(f"Error counting companies: {str(e)}")
            result['counts']['company'] = 0
            
        # Count instructors
        try:
            result['counts']['instructor'] = User.query.filter_by(is_active=False, role='Instructor').count()
        except Exception as e:
            print(f"Error counting instructors: {str(e)}")
            result['counts']['instructor'] = 0
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error retrieving archives: {str(e)}")
        return jsonify({'records': [], 'counts': {}}), 200  # Return empty array with 200 status to prevent breaking the UI

@api_bp.route('/restore-archived/<record_type>/<record_id>', methods=['POST'])
@login_required
def restore_archived_record(record_type, record_id):
    """Restore an archived record by ID"""
    try:
        print(f"Attempting to restore {record_type} with ID: {record_id}")
        
        if record_type == 'class':
            # Find the class
            class_obj = Class.query.get(record_id)
            if not class_obj:
                return jsonify({'error': f'Class with ID {record_id} not found'}), 404
            
            print(f"Found class: {class_obj.name}")
            print(f"Before restore - active status: {class_obj.is_active}, description: {class_obj.description}")
            
            # Mark the class as active
            class_obj.is_active = True
            
            # Remove the ARCHIVE NOTE completely from the description
            if class_obj.description and "ARCHIVE NOTE" in class_obj.description:
                # Split by ARCHIVE NOTE and keep only the part before it
                parts = class_obj.description.split("ARCHIVE NOTE")
                class_obj.description = parts[0].strip() if parts[0].strip() else ""
                print(f"Removed ARCHIVE NOTE. New description: {class_obj.description}")
            
            # Save changes
            db.session.commit()
            
            # Verify changes were saved
            db.session.refresh(class_obj)
            print(f"After commit - active status: {class_obj.is_active}, description: {class_obj.description}")
            
            # Query the database again to verify changes
            verified_class = Class.query.get(record_id)
            print(f"Verified from DB - active status: {verified_class.is_active}, description: {verified_class.description}")
            
            return jsonify({
                'success': True,
                'message': 'Class restored successfully',
                'class_id': record_id
            })
        
        elif record_type == 'student':
            # Find the student
            student = User.query.get(record_id)
            if not student:
                return jsonify({'error': f'Student with ID {record_id} not found'}), 404
            
            # Mark the student as active
            student.is_active = True
            
            # Remove the archive note
            if student.notes and "ARCHIVE NOTE" in student.notes:
                parts = student.notes.split("ARCHIVE NOTE")
                student.notes = parts[0].strip() if parts[0].strip() else ""
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Student restored successfully',
                'student_id': record_id
            })
        
        elif record_type == 'company':
            # Find the company
            company = Company.query.get(record_id)
            if not company:
                return jsonify({'error': f'Company with ID {record_id} not found'}), 404
            
            # Mark the company as active
            company.is_active = True
            
            # Remove the archive note
            if company.notes and "ARCHIVE NOTE" in company.notes:
                parts = company.notes.split("ARCHIVE NOTE")
                company.notes = parts[0].strip() if parts[0].strip() else ""
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Company restored successfully',
                'company_id': record_id
            })
        
        elif record_type == 'instructor':
            # Find the instructor
            instructor = User.query.get(record_id)
            if not instructor:
                return jsonify({'error': f'Instructor with ID {record_id} not found'}), 404
            
            # Mark the instructor as active
            instructor.is_active = True
            
            # Remove the archive note
            if instructor.notes and "ARCHIVE NOTE" in instructor.notes:
                parts = instructor.notes.split("ARCHIVE NOTE")
                instructor.notes = parts[0].strip() if parts[0].strip() else ""
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Instructor restored successfully',
                'instructor_id': record_id
            })
        
        else:
            return jsonify({'error': f'Unsupported record type: {record_type}'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to restore record: {str(e)}'}), 500

@api_bp.route('/archives/delete/<string:folder>/<string:record_id>', methods=['DELETE'])
@login_required
def delete_archived_record(folder, record_id):
    """API endpoint to permanently delete an archived record"""
    # Begin a new transaction for more control
    session = db.session()
    try:
        print(f"Attempting to delete {folder} record with ID: {record_id}")
        
        if folder == 'class':
            # Find the class
            class_obj = Class.query.get(record_id)
            if not class_obj:
                return jsonify({'error': f'Class with ID {record_id} not found'}), 404
            
            print(f"Found class: {class_obj.name}, attempting to delete it")
            
            # DIAGNOSTIC: Print all attributes of the class object to help debug
            print(f"Class details: ID={class_obj.id}, Name={class_obj.name}, Active={class_obj.is_active}")
            
            try:
                # First, check if there are any relationships that might prevent deletion
                # Find all tables that reference this class
                tables_to_check = {
                    'attendance': 'class_id',
                    'enrollment': 'class_id'
                }
                
                for table, field in tables_to_check.items():
                    try:
                        # Check if the table exists and if it has references to this class
                        count_query = f"SELECT COUNT(*) FROM {table} WHERE {field} = :id"
                        count = session.execute(text(count_query), {'id': record_id}).scalar()
                        print(f"Found {count} records in {table} referencing class {record_id}")
                        
                        if count > 0:
                            # Delete the references first
                            try:
                                delete_query = f"DELETE FROM {table} WHERE {field} = :id"
                                session.execute(text(delete_query), {'id': record_id})
                                print(f"Successfully deleted {count} records from {table}")
                            except Exception as table_error:
                                print(f"Error deleting records from {table}: {str(table_error)}")
                                # Continue even if this fails, we'll try the main delete anyway
                    except Exception as check_error:
                        print(f"Error checking {table}: {str(check_error)}")
                        # Continue to try other tables
                
                # Now try to delete the class itself
                try:
                    # Try direct SQL delete as a fallback
                    session.execute(text("DELETE FROM class WHERE id = :id"), {'id': record_id})
                    session.commit()
                    print(f"Successfully deleted class {record_id} using SQL")
                    return jsonify({'success': True, 'message': 'Class deleted permanently'})
                except Exception as sql_error:
                    print(f"Error deleting class with SQL: {str(sql_error)}")
                    # If SQL delete fails, try ORM delete
                    session.delete(class_obj)
                    session.commit()
                    print(f"Successfully deleted class {record_id} using ORM")
                    return jsonify({'success': True, 'message': 'Class deleted permanently'})
                    
            except Exception as inner_e:
                session.rollback()
                error_msg = str(inner_e)
                print(f"Error during class deletion: {error_msg}")
                
                if "foreign key constraint fails" in error_msg.lower():
                    print("Foreign key constraint detected. Trying alternative approach.")
                    
                    # Try to mark as archived instead of deleting
                    try:
                        class_obj.is_active = False
                        
                        # Make sure it has ARCHIVE NOTE
                        if not class_obj.description or "ARCHIVE NOTE" not in class_obj.description:
                            archive_timestamp = datetime.now().strftime('%Y-%m-%d')
                            reason = "Marked for deletion but couldn't be deleted due to constraints"
                            
                            if class_obj.description:
                                class_obj.description += f"\n\nARCHIVE NOTE ({archive_timestamp}): {reason}"
                            else:
                                class_obj.description = f"ARCHIVE NOTE ({archive_timestamp}): {reason}"
                                
                        session.commit()
                        print(f"Class {record_id} marked as archived instead of deleted due to constraints")
                        return jsonify({
                            'success': True, 
                            'message': 'Class could not be deleted due to relationships, but has been marked as archived.'
                        })
                    except Exception as archive_error:
                        session.rollback()
                        print(f"Error archiving class: {str(archive_error)}")
                
                return jsonify({
                    'error': 'This class cannot be deleted because it is referenced by other records. Try archiving it instead.'
                }), 500
            
        # Similar handling for other types...
        else:
            return jsonify({'error': f'Invalid archive type: {folder}'}), 400
            
    except Exception as e:
        session.rollback()
        error_message = str(e)
        print(f"Error deleting archived record: {error_message}")
        
        return jsonify({'error': f'Failed to delete record: {error_message}'}), 500

@api_bp.route('/archives/export/<string:folder>', methods=['GET'])
@login_required
def export_archives_csv(folder):
    """API endpoint to export archived records to CSV"""
    try:
        search_term = request.args.get('search', '')
        
        if folder == 'class':
            # Get inactive classes (archived)
            query = Class.query.filter_by(is_active=False)
            
            if search_term:
                query = query.filter(
                    (Class.name.like(f'%{search_term}%')) | 
                    (Class.id.like(f'%{search_term}%'))
                )
                
            archived_classes = query.all()
            
            # Create CSV string
            output = StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(['Class ID', 'Name', 'Day', 'Time', 'Instructor', 'Academic Year', 'Archive Date', 'Archive Reason'])
            
            # Write data
            for class_obj in archived_classes:
                # Get instructor name if available
                instructor_name = "Not Assigned"
                if class_obj.instructor_id:
                    instructor = User.query.get(class_obj.instructor_id)
                    if instructor:
                        instructor_name = f"{instructor.first_name} {instructor.last_name}"
                
                # Format time
                time_str = f"{class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}"
                
                # Parse archive date from description if possible
                archive_date = "Unknown"
                archive_reason = "Not specified"
                if class_obj.description and "ARCHIVE NOTE" in class_obj.description:
                    try:
                        # Extract date from format: ARCHIVE NOTE (YYYY-MM-DD)
                        date_start = class_obj.description.find("ARCHIVE NOTE (") + 14
                        date_end = class_obj.description.find(")", date_start)
                        if date_start > 0 and date_end > 0:
                            archive_date = class_obj.description[date_start:date_end]
                            
                            # Extract reason which comes after the closing parenthesis and colon
                            reason_start = class_obj.description.find(":", date_end) + 1
                            if reason_start > 0:
                                archive_reason = class_obj.description[reason_start:].strip()
                    except:
                        pass
                
                writer.writerow([
                    class_obj.id,
                    class_obj.name,
                    class_obj.day_of_week,
                    time_str,
                    instructor_name,
                    class_obj.term,
                    archive_date,
                    archive_reason
                ])
            
            # Create the response
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename=archived_classes_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            
            return response
        
        elif folder == 'student':
            # Get inactive students (archived)
            query = User.query.filter_by(role='Student', is_active=False)
            
            if search_term:
                query = query.filter(
                    (User.first_name.like(f'%{search_term}%')) | 
                    (User.last_name.like(f'%{search_term}%')) |
                    (User.email.like(f'%{search_term}%')) |
                    (User.id.like(f'%{search_term}%'))
                )
                
            archived_students = query.all()
            
            # Create CSV string
            output = StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(['Student ID', 'First Name', 'Last Name', 'Email', 'Company', 'Archive Date', 'Archive Reason'])
            
            # Write data
            for student in archived_students:
                # Get company name if available
                company_name = "Not Assigned"
                if student.company_id:
                    company = Company.query.get(student.company_id)
                    if company:
                        company_name = company.name
                
                # Parse archive date and reason from notes if possible
                archive_date = "Unknown"
                archive_reason = "Not specified"
                if student.notes and "ARCHIVE NOTE" in student.notes:
                    try:
                        # Extract date from format: ARCHIVE NOTE (YYYY-MM-DD)
                        date_start = student.notes.find("ARCHIVE NOTE (") + 14
                        date_end = student.notes.find(")", date_start)
                        if date_start > 0 and date_end > 0:
                            archive_date = student.notes[date_start:date_end]
                            
                            # Extract reason which comes after the closing parenthesis and colon
                            reason_start = student.notes.find(":", date_end) + 1
                            if reason_start > 0:
                                archive_reason = student.notes[reason_start:].strip()
                    except:
                        pass
                
                writer.writerow([
                    student.id,
                    student.first_name,
                    student.last_name,
                    student.email,
                    company_name,
                    archive_date,
                    archive_reason
                ])
            
            # Create the response
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename=archived_students_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            
            return response
        
        elif folder == 'instructor':
            # Get inactive instructors (archived)
            query = User.query.filter_by(role='Instructor', is_active=False)
            
            if search_term:
                query = query.filter(
                    (User.first_name.like(f'%{search_term}%')) | 
                    (User.last_name.like(f'%{search_term}%')) |
                    (User.email.like(f'%{search_term}%')) |
                    (User.id.like(f'%{search_term}%'))
                )
                
            archived_instructors = query.all()
            
            # Create CSV string
            output = StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(['Instructor ID', 'First Name', 'Last Name', 'Email', 'Department', 'Archive Date', 'Archive Reason'])
            
            # Write data
            for instructor in archived_instructors:
                # Parse archive date and reason from notes if possible
                archive_date = "Unknown"
                archive_reason = "Not specified"
                if instructor.notes and "ARCHIVE NOTE" in instructor.notes:
                    try:
                        # Extract date from format: ARCHIVE NOTE (YYYY-MM-DD)
                        date_start = instructor.notes.find("ARCHIVE NOTE (") + 14
                        date_end = instructor.notes.find(")", date_start)
                        if date_start > 0 and date_end > 0:
                            archive_date = instructor.notes[date_start:date_end]
                            
                            # Extract reason which comes after the closing parenthesis and colon
                            reason_start = instructor.notes.find(":", date_end) + 1
                            if reason_start > 0:
                                archive_reason = instructor.notes[reason_start:].strip()
                    except:
                        pass
                
                writer.writerow([
                    instructor.id,
                    instructor.first_name,
                    instructor.last_name,
                    instructor.email,
                    instructor.department or "Not Assigned",
                    archive_date,
                    archive_reason
                ])
            
            # Create the response
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename=archived_instructors_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            
            return response
        
        elif folder == 'company':
            # Get inactive companies (archived)
            query = Company.query.filter_by(is_active=False)
            
            if search_term:
                query = query.filter(
                    (Company.name.like(f'%{search_term}%')) | 
                    (Company.id.like(f'%{search_term}%')) |
                    (Company.contact_name.like(f'%{search_term}%')) |
                    (Company.email.like(f'%{search_term}%'))
                )
                
            archived_companies = query.all()
            
            # Create CSV string
            output = StringIO()
            writer = csv.writer(output)
            
            # Write headers
            writer.writerow(['Company ID', 'Name', 'Contact Person', 'Email', 'Phone', 'Archive Date', 'Archive Reason'])
            
            # Write data
            for company in archived_companies:
                # Parse archive date and reason from notes if possible
                archive_date = "Unknown"
                archive_reason = "Not specified"
                if company.notes and "ARCHIVE NOTE" in company.notes:
                    try:
                        # Extract date from format: ARCHIVE NOTE (YYYY-MM-DD)
                        date_start = company.notes.find("ARCHIVE NOTE (") + 14
                        date_end = company.notes.find(")", date_start)
                        if date_start > 0 and date_end > 0:
                            archive_date = company.notes[date_start:date_end]
                            
                            # Extract reason which comes after the closing parenthesis and colon
                            reason_start = company.notes.find(":", date_end) + 1
                            if reason_start > 0:
                                archive_reason = company.notes[reason_start:].strip()
                    except:
                        pass
                
                writer.writerow([
                    company.id,
                    company.name,
                    company.contact_name or "Not specified",
                    company.email or "Not specified",
                    company.phone or "Not specified",
                    archive_date,
                    archive_reason
                ])
            
            # Create the response
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename=archived_companies_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            
            return response
            
        return jsonify({'error': 'Invalid archive type'}), 400
        
    except Exception as e:
        print(f"Error exporting archives: {str(e)}")
        return jsonify({'error': f'Failed to export archives: {str(e)}'}), 500 

@api_bp.route('/archives/class/count', methods=['GET'])
@login_required
def get_archive_class_count():
    """API endpoint to get the count of properly archived classes"""
    try:
        # Count classes that are inactive AND have an ARCHIVE NOTE
        count = Class.query.filter(
            Class.is_active == False,
            Class.description.like('%ARCHIVE NOTE%')
        ).count()
        
        return jsonify({'count': count})
    except Exception as e:
        print(f"Error getting archive count: {str(e)}")
        return jsonify({'count': 0}), 200 

@api_bp.route('/archives/counts', methods=['GET'])
@login_required
def get_archive_counts():
    """API endpoint to get only the counts of archived records for stats"""
    try:
        result = {'counts': {}}
        
        # Count all archived records for stats - use try/except for each count to prevent errors
        result['counts'] = {}
        
        # Count students
        try:
            result['counts']['student'] = User.query.filter_by(is_active=False, role='Student').count()
        except Exception as e:
            print(f"Error counting students: {str(e)}")
            result['counts']['student'] = 0
            
        # Count classes
        try:
            result['counts']['class'] = Class.query.filter(Class.is_active==False, Class.description.like('%ARCHIVE NOTE%')).count()
        except Exception as e:
            print(f"Error counting classes: {str(e)}")
            result['counts']['class'] = 0
            
        # Count companies
        try:
            # Use raw SQL to avoid model mapping issues
            company_count = db.session.execute(text("SELECT COUNT(*) FROM company WHERE status = 'Inactive'")).scalar()
            result['counts']['company'] = company_count
        except Exception as e:
            print(f"Error counting companies: {str(e)}")
            result['counts']['company'] = 0
            
        # Count instructors
        try:
            result['counts']['instructor'] = User.query.filter_by(is_active=False, role='Instructor').count()
        except Exception as e:
            print(f"Error counting instructors: {str(e)}")
            result['counts']['instructor'] = 0
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error retrieving archive counts: {str(e)}")
        return jsonify({'counts': {
            'student': 0,
            'class': 0,
            'company': 0,
            'instructor': 0
        }}), 200  # Return zeros with 200 status to prevent breaking the UI 