from flask import Blueprint, jsonify, request, make_response, render_template, current_app, Response
from flask_login import login_required, current_user
from models import db, User, Class, Enrollment, Company, Attendance
from datetime import datetime, date, timedelta
import csv
from io import StringIO
from sqlalchemy import text, or_, func, and_
from sqlalchemy.orm import aliased
import traceback
import json
import uuid
import math
import os
import re
import string
import random
from functools import wraps

# Create API blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Role-based access control decorators
def admin_required(f):
    """Decorator to check if user is an admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role.lower() != 'admin':
            return jsonify({'error': 'Administrator access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def admin_or_instructor_required(f):
    """Decorator to check if user is an admin or instructor"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role.lower() not in ['admin', 'instructor']:
            return jsonify({'error': 'Administrator or instructor access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Helper function to safely map company attributes
def map_company_to_dict(company):
    """Map company model to dictionary, handling attribute access safely"""
    result = {
        'name': getattr(company, 'name', ''),
        'contact': getattr(company, 'contact', ''),
        'email': getattr(company, 'email', ''),
        'status': getattr(company, 'status', 'Active')
    }
    
    # Handle ID field which might be 'id' or 'company_id'
    if hasattr(company, 'id'):
        result['company_id'] = company.id
    elif hasattr(company, 'company_id'):
        result['company_id'] = company.company_id
    else:
        # Fallback to using the primary key
        result['company_id'] = str(company.get_id()) if hasattr(company, 'get_id') else 'unknown'
    
    return result

@api_bp.route('/users', methods=['GET'])
@login_required
def get_users():
    """API endpoint to get all users with optional filtering"""
    # Get filter parameters
    role_filter = request.args.get('role', '')
    status_filter = request.args.get('status', '')
    search = request.args.get('search', '')
    
    # Build query
    query = User.query.filter_by(is_archived=False)  # Exclude archived users
    
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
    try:
        # Get the user with basic info
        user = User.query.get_or_404(user_id)
        
        # Build base result with common fields
        result = {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'role': user.role,
            'is_active': user.is_active,
            'status': 'Active' if user.is_active else 'Inactive',
            'profile_img': user.profile_img
        }
        
        # Add role-specific data based on user type
        if user.role and user.role.lower() == 'student':
            # Get student enrollments and related data
            result.update(get_student_data(user))
        elif user.role and user.role.lower() == 'instructor':
            result.update(get_instructor_data(user))
        elif user.role and ('admin' in user.role.lower() or 'administrator' in user.role.lower()):
            result.update(get_admin_data(user))
        
        return jsonify(result)
    except Exception as e:
        import traceback
        print(f"Error in get_user: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

def get_student_data(user):
    """Get student-specific data for the student view modal"""
    # Get company info
    company_name = "Not Assigned"
    company_data = None
    if hasattr(user, 'company_id') and user.company_id:
        company = Company.query.get(user.company_id)
        if company:
            company_name = company.name
            company_data = {
                'id': company.id,
                'name': company.name,
                'contact': company.contact,
                'email': company.email
            }

    # Get enrollments
    enrollments = []
    active_enrollments = []
    enrollment_count = 0

    try:
        enrollment_records = Enrollment.query.filter_by(student_id=user.id).all()
        enrollment_count = len(enrollment_records)

        for enrollment in enrollment_records:
            class_obj = Class.query.get(enrollment.class_id)
            if not class_obj:
                continue

            # Get instructor name for class
            instructor_name = "Not Assigned"
            if hasattr(class_obj, 'instructor_id') and class_obj.instructor_id:
                instructor = User.query.get(class_obj.instructor_id)
                if instructor:
                    instructor_name = f"{instructor.first_name} {instructor.last_name}"

            enrollment_data = {
                'id': enrollment.id,
                'class_id': class_obj.id,
                'class_name': class_obj.name,
                'status': enrollment.status,
                'enrollment_date': enrollment.enrollment_date.strftime('%Y-%m-%d') if enrollment.enrollment_date else None,
                'instructor': instructor_name,
                'day': class_obj.day_of_week,
                'time': f"{class_obj.start_time.strftime('%H:%M') if class_obj.start_time else ''} - {class_obj.end_time.strftime('%H:%M') if class_obj.end_time else ''}"
            }

            enrollments.append(enrollment_data)
            if enrollment.status == 'Active':
                active_enrollments.append(enrollment_data)
    except Exception as e:
        print(f"Error getting student enrollments: {str(e)}")

    return {
        'company': company_name,
        'company_data': company_data,
        'enrollments': enrollments,
        'active_enrollments': active_enrollments,
        'enrollment_count': enrollment_count
    }

def get_instructor_data(user):
    """Get instructor-specific data for the instructor view modal"""
    # Get instructor department
    department = user.department if hasattr(user, 'department') else 'N/A'
    
    # Get all classes taught by this instructor
    classes_taught = []
    class_records = Class.query.filter_by(instructor_id=user.id).all()
    
    for class_obj in class_records:
        try:
            # Count enrolled students
            enrolled_count = Enrollment.query.filter_by(class_id=class_obj.id).count()
            
            # Class location not in schema
            class_location = "Not specified"
            
            classes_taught.append({
                'id': class_obj.id,
                    'name': class_obj.name,
                'day_of_week': class_obj.day_of_week,
                'day': class_obj.day_of_week,
                'start_time': class_obj.start_time.strftime('%H:%M') if class_obj.start_time else None,
                'end_time': class_obj.end_time.strftime('%H:%M') if class_obj.end_time else None,
                'time': f"{class_obj.start_time.strftime('%H:%M') if class_obj.start_time else ''} - {class_obj.end_time.strftime('%H:%M') if class_obj.end_time else ''}",
                'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M') if class_obj.start_time else ''} - {class_obj.end_time.strftime('%H:%M') if class_obj.end_time else ''}",
                'location': class_location,
                'enrolled_count': enrolled_count,
                'student_count': enrolled_count,
                'is_active': class_obj.is_active
            })
        except Exception as e:
            print(f"Error processing class {class_obj.id}: {str(e)}")
            continue
    
    return {
        'department': department,
        'classes_taught': classes_taught,
        'classes': classes_taught,  # Alias for compatibility
        'total_classes': len(classes_taught)
    }

def get_admin_data(user):
    """Get admin-specific data for the admin view modal"""
    # Define standard permissions for an admin
    permissions = [
        {'name': 'user_management', 'description': 'Can view, add, edit, and delete user accounts'},
        {'name': 'class_management', 'description': 'Can create, edit, and manage class schedules'},
        {'name': 'enrollment_management', 'description': 'Can manage student enrollments in classes'},
        {'name': 'attendance_tracking', 'description': 'Can record and edit attendance records'},
        {'name': 'report_generation', 'description': 'Can generate and view system reports'},
        {'name': 'system_settings', 'description': 'Can configure system-wide settings'}
    ]
    
    return {
        'admin_role': 'admin',
        'permissions': permissions,
        'access_roles': permissions  # Alias for compatibility
    }

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
    """API endpoint to get all students for enrollment"""
    try:
        # Get all users without any role or active filters initially
        query = User.query
        
        # Debug to check total users first
        all_users = query.all()
        print(f"DEBUG: Total users (all roles): {len(all_users)}")
        for user in all_users:
            print(f"DEBUG: User: {user.id} - {user.first_name} {user.last_name} - Role: {user.role} - Active: {user.is_active}")
        
        # Case-insensitive role matching is needed - use upper case for consistent comparison
        # Get students with case-insensitive role matching
        students = []
        for user in all_users:
            if user.role and user.role.upper() == 'STUDENT':
                students.append(user)
                
        print(f"DEBUG: Students with proper role matching: {len(students)}")
        
        for student in students:
            print(f"DEBUG: Student found: {student.id} - {student.first_name} {student.last_name}")
        
        # Format the response with proper role capitalization
        result = []
        for student in students:
            result.append({
                'id': student.id,
                'name': f"{student.first_name} {student.last_name}",
                'role': 'Student',  # Use proper capitalization for client-side
                'is_active': student.is_active,
                'email': student.email
            })
    
        print(f"DEBUG: Returning {len(result)} students for enrollment")
        return jsonify({'students': result})
    except Exception as e:
        import traceback
        print(f"Error in get_unenrolled_students: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e), 'students': []}), 500

@api_bp.route('/enrollments', methods=['POST'])
@login_required
def create_enrollments():
    """API endpoint to create or reactivate enrollment records"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Validate required fields
    required_fields = ['student_ids', 'class_ids']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Extract data from request
    student_ids = data['student_ids']
    class_ids = data['class_ids']
    status = data.get('status', 'Pending')
    
    # Parse enrollment date
    if 'start_date' in data and data['start_date']:
        try:
            enrollment_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Expected format: YYYY-MM-DD'}), 400
    else:
        enrollment_date = datetime.now().date()
    
    success_count = 0
    updated_count = 0
    skipped_count = 0
    error_details = []
    
    try:
        # Process each student and class combination
        for student_id in student_ids:
            for class_id in class_ids:
                try:
                    # Verify student and class exist
                    student = User.query.get(student_id)
                    if not student:
                        error_details.append(f"Student {student_id} not found")
                        continue
                    
                    class_obj = Class.query.get(class_id)
                    if not class_obj:
                        error_details.append(f"Class {class_id} not found")
                        continue
                    
                    # Check if an active enrollment already exists
                    existing_enrollment = Enrollment.query.filter(
                        Enrollment.student_id == student_id,
                        Enrollment.class_id == class_id,
                        Enrollment.unenrollment_date.is_(None)
                    ).first()
                    
                    if existing_enrollment:
                        skipped_count += 1
                        continue
                    
                    # Check for previous enrollment that was unenrolled
                    previous_enrollment = Enrollment.query.filter(
                        Enrollment.student_id == student_id,
                        Enrollment.class_id == class_id,
                        Enrollment.unenrollment_date.isnot(None)
                    ).first()
                    
                    if previous_enrollment:
                        # Re-activate the enrollment by updating the existing record
                        previous_enrollment.unenrollment_date = None
                        previous_enrollment.status = status
                        previous_enrollment.enrollment_date = enrollment_date
                        updated_count += 1
                    else:
                        # Create new enrollment
                        new_enrollment = Enrollment(
                            student_id=student_id,
                            class_id=class_id,
                            enrollment_date=enrollment_date,
                            status=status
                        )
                        
                        db.session.add(new_enrollment)
                        success_count += 1
                    
                except Exception as e:
                    db.session.rollback()
                    error_details.append(f"Error processing enrollment for student {student_id} in class {class_id}: {str(e)}")
        
        # Commit changes if any were successful
        if success_count > 0 or updated_count > 0:
            db.session.commit()
            
        return jsonify({
            'success': True,
            'message': f"Created {success_count} enrollments, reactivated {updated_count} enrollments",
            'count': success_count + updated_count,
            'created': success_count,
            'updated': updated_count,
            'skipped': skipped_count,
            'errors': error_details if error_details else None
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

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
        result.append(map_company_to_dict(company))
    
    return jsonify(result)

@api_bp.route('/companies/<string:company_id>', methods=['GET'])
@login_required
def get_company(company_id):
    """API endpoint to get a specific company by ID"""
    company = Company.query.get_or_404(company_id)
    
    # Get students associated with this company
    students = User.query.filter_by(company_id=company_id, role='Student').all()
    student_list = []
    
    for student in students:
        student_list.append({
            'id': student.id,
            'name': f"{student.first_name} {student.last_name}",
            'email': student.email,
            'status': 'Active' if student.is_active else 'Inactive'
        })
    
    # Map company to dictionary and add students
    result = map_company_to_dict(company)
    result['students'] = student_list
    
    return jsonify(result)

@api_bp.route('/companies/<string:company_id>', methods=['PUT'])
@login_required
def update_company(company_id):
    """API endpoint to update a specific company"""
    company = Company.query.get_or_404(company_id)
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        # Update company fields
        if 'name' in data:
            company.name = data['name']
        if 'contact' in data:
            company.contact = data['contact']
        if 'email' in data:
            company.email = data['email']
        if 'status' in data:
            company.status = data['status']
        
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Company updated successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update company: {str(e)}'}), 500

@api_bp.route('/companies', methods=['POST'])
@login_required
def create_company():
    """API endpoint to create a new company"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Validate required fields
    required_fields = ['name', 'contact', 'email', 'company_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    try:
        # Check if company ID already exists
        if Company.query.get(data['company_id']):
            return jsonify({'error': 'Company ID already exists'}), 400
        
        # Create new company
        new_company = Company(
            company_id=data['company_id'],
            name=data['name'],
            contact=data['contact'],
            email=data['email'],
            status='Active'
        )
        
        # Add to database
        db.session.add(new_company)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Company created successfully',
            'company_id': data['company_id']
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create company: {str(e)}'}), 500

@api_bp.route('/companies-direct', methods=['GET'])
@login_required
def get_companies_direct():
    """API endpoint to get all companies using direct SQL to avoid ORM mapping issues"""
    try:
        # Use raw SQL to query the companies table
        result = db.session.execute(text("SELECT id, name, contact, email, status, created_at, updated_at FROM company"))
        companies = []
        
        # Map the results to dictionaries
        for row in result:
            companies.append({
                'company_id': row.id,
                'name': row.name,
                'contact': row.contact,
                'email': row.email,
                'status': row.status,
                'created_at': row.created_at.isoformat() if row.created_at else None,
                'updated_at': row.updated_at.isoformat() if row.updated_at else None
            })
        
        return jsonify(companies)
    except Exception as e:
        print(f"Error fetching companies: {str(e)}")
        return jsonify([]), 500

@api_bp.route('/companies-direct/<string:company_id>', methods=['GET'])
@login_required
def get_company_direct(company_id):
    """API endpoint to get a specific company by ID using direct SQL to avoid ORM mapping issues"""
    try:
        # Use raw SQL to query the company
        result = db.session.execute(
            text("SELECT id, name, contact, email, status, created_at, updated_at FROM company WHERE id = :company_id"),
            {"company_id": company_id}
        ).fetchone()
        
        if not result:
            return jsonify({"error": "Company not found"}), 404
        
        # Get students associated with this company
        students = User.query.filter_by(company_id=company_id, role='Student').all()
        student_list = []
        
        for student in students:
            student_list.append({
                'id': student.id,
                'name': f"{student.first_name} {student.last_name}",
                'email': student.email,
                'status': 'Active' if student.is_active else 'Inactive'
            })
        
        # Map the result to a dictionary
        company = {
            'company_id': result.id,
            'name': result.name,
            'contact': result.contact,
            'email': result.email,
            'status': result.status,
            'created_at': result.created_at.isoformat() if result.created_at else None,
            'updated_at': result.updated_at.isoformat() if result.updated_at else None,
            'students': student_list
        }
        
        return jsonify(company)
    except Exception as e:
        print(f"Error fetching company: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/companies-direct/<string:company_id>', methods=['PUT'])
@login_required
def update_company_direct(company_id):
    """API endpoint to update a specific company using direct SQL to avoid ORM mapping issues"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Get the company first to check current status
        company = Company.query.get(company_id)
        if not company:
            return jsonify({'error': 'Company not found'}), 404
            
        # Check if we're archiving the company (changing status to Inactive)
        is_archiving = 'status' in data and data['status'] == 'Inactive' and company.status != 'Inactive'
        
        # Prepare update fields
        update_fields = []
        params = {"company_id": company_id}
        
        if 'name' in data:
            update_fields.append("name = :name")
            params["name"] = data['name']
        
        if 'contact' in data:
            update_fields.append("contact = :contact")
            params["contact"] = data['contact']
        
        if 'email' in data:
            update_fields.append("email = :email")
            params["email"] = data['email']
        
        if 'status' in data:
            update_fields.append("status = :status")
            params["status"] = data['status']
        
        # Add updated_at timestamp
        update_fields.append("updated_at = NOW()")
        
        # If archiving, add archive information
        if is_archiving and 'archiveNote' in data and data['archiveNote']:
            # Format archive note with consistent pattern
            archive_timestamp = datetime.now().strftime('%Y-%m-%d')
            reason = data['archiveNote']
            admin_name = f"{current_user.first_name} {current_user.last_name}"
            
            # The main reason that will be shown
            archive_note = f"ARCHIVE NOTE ({archive_timestamp}): {reason}"
            
            # Add admin name in a standardized format that the UI can parse
            archive_note += f"\nArchived by: {admin_name}"
            
            # Update notes field with the archive note
            if hasattr(company, 'notes') and company.notes:
                company.notes += f"\n\n{archive_note}"
            else:
                company.notes = archive_note
                
            # Set archive date if the field exists
            try:
                if hasattr(company, 'archive_date'):
                    company.archive_date = datetime.now().date()
            except Exception as e:
                print(f"Warning: Could not set archive_date: {str(e)}")
        
        # Build and execute update query
        if update_fields:
            query = f"UPDATE company SET {', '.join(update_fields)} WHERE id = :company_id"
            db.session.execute(text(query), params)
            
            # If we're also updating notes for archiving, commit all changes
            db.session.commit()
            
            # Add a success message
            message = 'Company updated successfully'
            if is_archiving:
                message = 'Company archived successfully'
            
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No fields to update'
            }), 400
            
    except Exception as e:
        db.session.rollback()
        print(f"Error updating company: {str(e)}")
        return jsonify({'error': f'Failed to update company: {str(e)}'}), 500

@api_bp.route('/classes', methods=['GET'])
@login_required
def get_classes():
    """
    Get a list of all classes
    """
    try:
        # Get query parameters
        is_active = request.args.get('is_active')
        instructor_id = request.args.get('instructor_id')
        
        # Start the query
        query = db.session.query(Class)
        
        # Apply filters
        if is_active is not None:
            is_active_bool = is_active.lower() == 'true'
            query = query.filter(Class.is_active == is_active_bool)
        
        if instructor_id:
            query = query.filter(Class.instructor_id == instructor_id)
        
        # Restrict instructors to only see their classes
        if current_user.role == 'Instructor':
            query = query.filter(Class.instructor_id == current_user.id)
        
        # Execute query
        classes = query.order_by(Class.name).all()
        
        # Format results
        class_list = []
        for cls in classes:
            instructor = User.query.get(cls.instructor_id) if cls.instructor_id else None
            
            class_list.append({
                'id': cls.id,
                'name': cls.name,
                'description': cls.description,
                'term': cls.term,
                'instructorId': cls.instructor_id,
                'instructorName': f"{instructor.first_name} {instructor.last_name}" if instructor else "Not Assigned",
                'dayOfWeek': cls.day_of_week,
                'startTime': cls.start_time.strftime('%H:%M') if cls.start_time else None,
                'endTime': cls.end_time.strftime('%H:%M') if cls.end_time else None,
                'isActive': cls.is_active
            })
        
        return jsonify({
            'classes': class_list,
            'total': len(class_list)
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'Failed to fetch classes: {str(e)}',
            'classes': []
        }), 500

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

@api_bp.route('/attendance/<int:record_id>', methods=['GET'])
@login_required
def get_attendance_record(record_id):
    """API endpoint to get a specific attendance record by ID"""
    try:
        # Get the attendance record with student and class information
        result = db.session.query(
            Attendance, User, Class
        ).outerjoin(
            User, User.id == Attendance.student_id
        ).outerjoin(
            Class, Class.id == Attendance.class_id
        ).filter(
            Attendance.id == record_id
        ).first()
        
        if not result:
            return jsonify({'error': 'Attendance record not found'}), 404
            
        attendance, student, class_obj = result
        
        # Get instructor information if available
        instructor_name = "Unknown"
        instructor_id = None
        
        if class_obj and class_obj.instructor_id:
            instructor = User.query.get(class_obj.instructor_id)
            if instructor:
                instructor_name = f"{instructor.first_name} {instructor.last_name}"
                instructor_id = instructor.id
        
        # Format the record
        record = {
            'id': attendance.id,
            'date': attendance.date.strftime('%Y-%m-%d') if attendance.date else '',
            'status': attendance.status or 'Unknown',
            'comment': attendance.comments,
            'student_name': f"{student.first_name} {student.last_name}" if student else "Unknown",
            'student_id': student.id if student else None,
            'student_profile_img': student.profile_img if student and student.profile_img else 'profile.png',
            'class_name': class_obj.name if class_obj else "Unknown",
            'class_id': class_obj.id if class_obj else None,
            'instructor_name': instructor_name,
            'instructor_id': instructor_id
        }
        
        return jsonify({'success': True, 'record': record})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

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
            
        # Update comment if provided (check both comment and comments field names)
        if 'comment' in data:
            attendance.comments = data['comment']
        elif 'comments' in data:
            attendance.comments = data['comments']
            
        # Update timestamp
        attendance.updated_at = datetime.utcnow()
        
        # Save changes
        db.session.commit()
        
        # Return updated record
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
            # Format archive note with consistent pattern
            archive_timestamp = datetime.now().strftime('%Y-%m-%d')
            reason = data['archiveNote']
            admin_name = f"{current_user.first_name} {current_user.last_name}"
            
            # The main reason that will be shown
            archive_note = f"ARCHIVE NOTE ({archive_timestamp}): {reason}"
            
            # Add admin name in a standardized format that the UI can parse
            archive_note += f"\nArchived by: {admin_name}"
            
            # Add to the description field
            if class_obj.description:
                class_obj.description += f"\n\n{archive_note}"
            else:
                class_obj.description = archive_note
                
            # Mark as archived
            class_obj.is_archived = True
            
            # Set archive date if the field exists
            try:
                if hasattr(class_obj, 'archive_date'):
                    class_obj.archive_date = datetime.now().date()
            except Exception as e:
                print(f"Warning: Could not set archive_date: {str(e)}")
            
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
    """Get archives based on folder"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 5))
        search = request.args.get('search', '')
        
        # For pagination
        start = (page - 1) * per_page
        end = start + per_page
        
        result = {'records': [], 'total': 0, 'counts': {}}
        
        if folder == 'user':
            role = request.args.get('role', 'all')
            
            # Build the base query
            query = User.query.filter_by(is_archived=True)
            
            # Apply role filter if specified
            if role != 'all':
                query = query.filter(User.role.ilike(f'%{role}%'))
            
            # Apply search filter if provided
            if search:
                query = query.filter(or_(
                    User.first_name.ilike(f'%{search}%'),
                    User.last_name.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                    User.id.ilike(f'%{search}%')
                ))
            
            # Get total count for pagination
            total = query.count()
            
            # Get paginated results
            archives = query.order_by(User.id).all()
            
            # Format the response
            formatted_archives = []
            for archive in archives:
                archive_date = None
                try:
                    if hasattr(archive, 'archive_date') and archive.archive_date:
                        archive_date = archive.archive_date.strftime('%Y-%m-%d')
                except Exception:
                    pass
                
                formatted_archives.append({
                    'id': archive.id,
                    'first_name': archive.first_name,
                    'last_name': archive.last_name,
                    'email': archive.email,
                    'role': archive.role,
                    'archive_date': archive_date or 'N/A',
                    'name': f"{archive.first_name} {archive.last_name}",
                    'status': 'Archived'
                })
            
            # Apply pagination
            result['records'] = formatted_archives[start:end]
            result['total'] = total
            
            # Count by roles for the UI stats
            try:
                result['counts'] = {
                    'student': User.query.filter(User.is_archived==True, User.role.ilike('%student%')).count(),
                    'instructor': User.query.filter(User.is_archived==True, User.role.ilike('%instructor%')).count(),
                    'admin': User.query.filter(User.is_archived==True, User.role.ilike('%admin%')).count()
                }
            except Exception as e:
                print(f"Error counting by roles: {str(e)}")
                result['counts'] = {'student': 0, 'instructor': 0, 'admin': 0}
                
        elif folder == 'instructor':
            # Build the query for instructors specifically
            query = User.query.filter(
                User.is_archived == True,
                User.role.ilike('%instructor%')
            )
            
            # Apply search if provided
            if search:
                query = query.filter(or_(
                    User.first_name.ilike(f'%{search}%'),
                    User.last_name.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                    User.id.ilike(f'%{search}%')
                ))
                
            # Count total for pagination
            total = query.count()
            
            # Get paginated results
            instructors = query.order_by(User.id).all()
            
            # Format for response
            instructor_records = []
            for instructor in instructors:
                # Format date if available
                archive_date = "Unknown"
                try:
                    if hasattr(instructor, 'archive_date') and instructor.archive_date:
                        archive_date = instructor.archive_date.strftime('%Y-%m-%d')
                except Exception:
                    pass
                    
                # Extract archive reason if available
                archive_reason = 'Archived'
                if hasattr(instructor, 'notes') and instructor.notes and 'ARCHIVE NOTE' in instructor.notes:
                    match = re.search(r'ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(?:\n|$)', instructor.notes)
                    if match and match.group(1):
                        archive_reason = match.group(1).strip()
                    
                # Add to results
                instructor_records.append({
                    'id': instructor.id,
                    'first_name': instructor.first_name,
                    'last_name': instructor.last_name,
                    'name': f"{instructor.first_name} {instructor.last_name}",
                    'email': instructor.email,
                    'role': instructor.role,
                    'archive_date': archive_date,
                    'status': 'Archived',
                    'notes': instructor.notes if hasattr(instructor, 'notes') else None,
                    'description': instructor.description if hasattr(instructor, 'description') else None,
                    'archive_reason': archive_reason
                })
                
            # Apply pagination
            result['records'] = instructor_records[start:end]
            result['total'] = total
            
        elif folder == 'student':
            # Build the query for students specifically
            query = User.query.filter(
                User.is_archived == True,
                User.role.ilike('%student%')
            )
            
            # Apply search if provided
            if search:
                query = query.filter(or_(
                    User.first_name.ilike(f'%{search}%'),
                    User.last_name.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                    User.id.ilike(f'%{search}%')
                ))
                
            # Count total for pagination
            total = query.count()
            
            # Get paginated results
            students = query.order_by(User.id).all()
            
            # Format for response
            student_records = []
            for student in students:
                # Format date if available
                archive_date = "Unknown"
                try:
                    if hasattr(student, 'archive_date') and student.archive_date:
                        archive_date = student.archive_date.strftime('%Y-%m-%d')
                except Exception:
                    pass
                
                # Extract archive reason if available
                archive_reason = 'Archived'
                if hasattr(student, 'notes') and student.notes and 'ARCHIVE NOTE' in student.notes:
                    match = re.search(r'ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(?:\n|$)', student.notes)
                    if match and match.group(1):
                        archive_reason = match.group(1).strip()
                    
                # Add to results
                student_records.append({
                    'id': student.id,
                    'first_name': student.first_name,
                    'last_name': student.last_name,
                    'name': f"{student.first_name} {student.last_name}",
                    'email': student.email,
                    'role': student.role,
                    'archive_date': archive_date,
                    'status': 'Archived',
                    'company': get_company_name(student.company_id) if hasattr(student, 'company_id') else 'Not Assigned',
                    'notes': student.notes if hasattr(student, 'notes') else None,
                    'description': student.description if hasattr(student, 'description') else None,
                    'archive_reason': archive_reason
                })
                
            # Apply pagination
            result['records'] = student_records[start:end]
            result['total'] = total
            
        elif folder == 'admin':
            # Build the query for admins specifically
            query = User.query.filter(
                User.is_archived == True,
                or_(
                    User.role.ilike('%admin%'),
                    User.role.ilike('%administrator%')
                )
            )
            
            # Apply search if provided
            if search:
                query = query.filter(or_(
                    User.first_name.ilike(f'%{search}%'),
                    User.last_name.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                    User.id.ilike(f'%{search}%')
                ))
                
            # Count total for pagination
            total = query.count()
            
            # Get paginated results
            admins = query.order_by(User.id).all()
            
            # Format for response
            admin_records = []
            for admin in admins:
                # Format date if available
                archive_date = "Unknown"
                try:
                    if hasattr(admin, 'archive_date') and admin.archive_date:
                        archive_date = admin.archive_date.strftime('%Y-%m-%d')
                except Exception:
                    pass
                
                # Extract archive reason if available
                archive_reason = 'Archived'
                if hasattr(admin, 'notes') and admin.notes and 'ARCHIVE NOTE' in admin.notes:
                    match = re.search(r'ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(?:\n|$)', admin.notes)
                    if match and match.group(1):
                        archive_reason = match.group(1).strip()
                    
                # Add to results
                admin_records.append({
                    'id': admin.id,
                    'first_name': admin.first_name,
                    'last_name': admin.last_name,
                    'name': f"{admin.first_name} {admin.last_name}",
                    'email': admin.email,
                    'role': admin.role,
                    'archive_date': archive_date,
                    'status': 'Administrator',
                    'notes': admin.notes if hasattr(admin, 'notes') else '',
                    'archive_reason': archive_reason
                })
                
            # Apply pagination
            result['records'] = admin_records[start:end]
            result['total'] = total
        
        # Return final results
        return jsonify(result)
        
    except Exception as e:
        print(f"Error retrieving archives: {str(e)}")
        return jsonify({'records': [], 'total': 0, 'counts': {}}), 200  # Return empty array with 200 status

@api_bp.route('/archives/restore/<string:folder>/<string:record_id>', methods=['POST'])
@login_required
@admin_required
def restore_archive(folder, record_id):
    """Unified API endpoint to restore an archived record by ID"""
    try:
        if folder == 'class':
            # Get the class record
            class_obj = Class.query.get_or_404(record_id)
            
            # Set it as active and not archived
            class_obj.is_active = True
            class_obj.is_archived = False
            
            # Remove the ARCHIVE NOTE completely from the description
            if class_obj.description and "ARCHIVE NOTE" in class_obj.description:
                # Split by ARCHIVE NOTE and keep only the part before it
                parts = class_obj.description.split("ARCHIVE NOTE")
                class_obj.description = parts[0].strip()
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Class {record_id} has been successfully restored',
                'id': record_id,
                'name': class_obj.name
            })
            
        elif folder == 'user':
            # Get the user record
            user = User.query.get_or_404(record_id)
            
            # Mark as active and not archived
            user.is_active = True
            user.is_archived = False
            
            # Clear archive date if it exists
            if hasattr(user, 'archive_date'):
                user.archive_date = None
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'User {record_id} has been successfully restored',
                'id': record_id,
                'name': f"{user.first_name} {user.last_name}"
            })
        
        elif folder == 'student':
            # Find the student
            student = User.query.get(record_id)
            if not student:
                return jsonify({'error': f'Student with ID {record_id} not found'}), 404
            
            # Mark the student as active and not archived
            student.is_active = True
            student.is_archived = False
            
            # Clear archive date if it exists
            if hasattr(student, 'archive_date'):
                student.archive_date = None
            
            # Remove the archive note
            if hasattr(student, 'notes') and student.notes and "ARCHIVE NOTE" in student.notes:
                parts = student.notes.split("ARCHIVE NOTE")
                student.notes = parts[0].strip() if parts[0].strip() else ""
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Student restored successfully',
                'student_id': record_id
            })
        
        elif folder == 'company':
            # Find the company
            company = Company.query.get(record_id)
            if not company:
                return jsonify({'error': f'Company with ID {record_id} not found'}), 404
            
            # Mark the company as active and not archived
            company.is_active = True
            company.is_archived = False
            
            # Remove the archive note
            if hasattr(company, 'notes') and company.notes and "ARCHIVE NOTE" in company.notes:
                parts = company.notes.split("ARCHIVE NOTE")
                company.notes = parts[0].strip() if parts[0].strip() else ""
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Company restored successfully',
                'company_id': record_id
            })
        
        elif folder == 'instructor':
            # Find the instructor
            instructor = User.query.get(record_id)
            if not instructor:
                return jsonify({'error': f'Instructor with ID {record_id} not found'}), 404
            
            # Mark the instructor as active and not archived
            instructor.is_active = True
            instructor.is_archived = False
            
            # Clear archive date if it exists
            if hasattr(instructor, 'archive_date'):
                instructor.archive_date = None
            
            # Remove the archive note
            if hasattr(instructor, 'notes') and instructor.notes and "ARCHIVE NOTE" in instructor.notes:
                parts = instructor.notes.split("ARCHIVE NOTE")
                instructor.notes = parts[0].strip() if parts[0].strip() else ""
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Instructor restored successfully',
                'instructor_id': record_id
            })
        
        elif folder == 'admin':
            # Find the admin
            admin = User.query.get(record_id)
            if not admin:
                return jsonify({'error': f'Administrator with ID {record_id} not found'}), 404
            
            # Mark the admin as active and not archived
            admin.is_active = True
            admin.is_archived = False
            
            # Clear archive date if it exists
            if hasattr(admin, 'archive_date'):
                admin.archive_date = None
            
            # Remove the archive note
            if hasattr(admin, 'notes') and admin.notes and "ARCHIVE NOTE" in admin.notes:
                parts = admin.notes.split("ARCHIVE NOTE")
                admin.notes = parts[0].strip() if parts[0].strip() else ""
            
            # Save changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Administrator restored successfully',
                'admin_id': record_id
            })
        
        elif folder == 'attendance':
            # Handle attendance records
            try:
                # Get the attendance record
                attendance = Attendance.query.get_or_404(int(record_id))
                
                # Check if it's actually archived
                if not attendance.is_archived:
                    return jsonify({
                        'success': False,
                        'message': 'Record is not archived'
                    }), 400
                
                # Restore the record
                attendance.is_archived = False
                attendance.archive_date = None
                
                # Update comments to indicate restoration
                if attendance.comments:
                    attendance.comments += f"\n\nRESTORED ({datetime.now().strftime('%Y-%m-%d')})"
                else:
                    attendance.comments = f"RESTORED ({datetime.now().strftime('%Y-%m-%d')})"
                
                # Save changes
                db.session.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Attendance record restored successfully'
                })
            except ValueError:
                return jsonify({'error': 'Invalid attendance record ID'}), 400
        
        else:
            return jsonify({'error': f'Unsupported record type: {folder}'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to restore record: {str(e)}'}), 500

# Add deprecation notice to old endpoints that should be removed in future versions
@api_bp.route('/restore-archived/<record_type>/<record_id>', methods=['POST'])
@login_required
@admin_required
def restore_archived_record(record_type, record_id):
    """DEPRECATED: Use /api/archives/restore/<folder>/<record_id> instead"""
    return restore_archive(record_type, record_id)

@api_bp.route('/restore-archived/attendance/<int:record_id>', methods=['POST'])
@login_required
def restore_archived_attendance(record_id):
    """DEPRECATED: Use /api/archives/restore/attendance/<record_id> instead"""
    return restore_archive('attendance', str(record_id))

@api_bp.route('/archives/delete/<string:folder>/<string:record_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_archived_record(folder, record_id):
    """API endpoint to permanently delete an archived record"""
    try:
        if folder == 'class':
            # Find the class
            class_obj = Class.query.get(record_id)
            if not class_obj:
                return jsonify({'error': f'Class with ID {record_id} not found'}), 404
            
            # Check if there are still students enrolled
            enrollments = Enrollment.query.filter_by(class_id=record_id).count()
            if enrollments > 0:
                return jsonify({
                    'error': f'Class has {enrollments} enrollments', 
                    'details': 'Unenroll all students from class before deleting'
                }), 400
                
            # Delete the class
            db.session.delete(class_obj)
            db.session.commit()
            
            return jsonify({
                'success': True, 
                'message': f'Class {record_id} has been permanently deleted'
            })
            
        elif folder == 'student':
            # Find the student
            student = User.query.get(record_id)
            if not student:
                return jsonify({'error': f'Student with ID {record_id} not found'}), 404
            
            # Check if student has enrollments
            student_enrollments = Enrollment.query.filter_by(student_id=record_id).count()
            if student_enrollments > 0:
                return jsonify({
                    'error': f'Student has {student_enrollments} enrollments',
                    'details': 'Unenroll from all classes first'
                }), 400
                
            # Delete the student
            db.session.delete(student)
            db.session.commit()
            
            return jsonify({
                'success': True, 
                'message': f'Student with ID {record_id} permanently deleted'
            })
        
        elif folder == 'admin':
            # Find the admin
            admin = User.query.get(record_id)
            if not admin:
                return jsonify({'error': f'Administrator with ID {record_id} not found'}), 404
            
            # Can only delete archived admins for safety
            if not admin.is_archived:
                return jsonify({'error': 'Cannot delete a non-archived administrator'}), 400
                
            # Delete the admin
            db.session.delete(admin)
            db.session.commit()
                
            return jsonify({
                'success': True, 
                'message': f'Administrator with ID {record_id} permanently deleted'
            })
        
        elif folder == 'attendance':
            # Handle attendance records
            try:
                # Get the attendance record
                attendance = Attendance.query.get_or_404(int(record_id))
                
                # Check if it's archived
                if not attendance.is_archived:
                    return jsonify({
                        'success': False,
                        'message': 'Cannot delete non-archived records'
                    }), 400
                
                # Delete the record
                db.session.delete(attendance)
                db.session.commit()
                
                return jsonify({
                    'success': True,
                    'message': 'Attendance record deleted permanently'
                })
            except ValueError:
                return jsonify({'error': 'Invalid attendance record ID'}), 400
    
        else:
            return jsonify({'error': f'Invalid archive type: {folder}'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete archived record: {str(e)}'}), 500

# Add deprecation notice for old endpoint that should be removed in future
@api_bp.route('/archives/delete/attendance/<int:record_id>', methods=['DELETE'])
@login_required
def delete_archived_attendance(record_id):
    """DEPRECATED: Use /api/archives/delete/attendance/<record_id> instead"""
    return delete_archived_record('attendance', str(record_id))

@api_bp.route('/archives/export/<string:folder>', methods=['GET'])
@login_required
def export_archives_csv(folder):
    """API endpoint to export archived records to CSV"""
    try:
        # Get search parameter
        search_term = request.args.get('search', '')
        
        # Create CSV output in memory
        output = StringIO()
        writer = csv.writer(output)
        
        if folder == 'class':
            # Get archived classes
            query = Class.query.filter(
                Class.is_active == False,
                Class.is_archived == True
            )
            
            if search_term:
                query = query.filter(Class.name.ilike(f'%{search_term}%'))
                
            archived_classes = query.all()
            
            # Create CSV string
            writer.writerow(['Class ID', 'Name', 'Day', 'Time', 'Instructor', 'Archive Date', 'Archive Reason'])
            
            for cls in archived_classes:
                # Extract archive reason if available
                archive_reason = 'Archived'
                if cls.description and 'ARCHIVE NOTE' in cls.description:
                    match = re.search(r'ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(?:\n|$)', cls.description)
                    if match and match.group(1):
                        archive_reason = match.group(1).strip()
                
                # Get instructor name if available
                instructor_name = 'Not Assigned'
                if hasattr(cls, 'instructor_id') and cls.instructor_id:
                    instructor = User.query.get(cls.instructor_id)
                    if instructor:
                        instructor_name = f"{instructor.first_name} {instructor.last_name}"
                
                # Format archive date
                archive_date = 'Unknown'
                if hasattr(cls, 'archive_date') and cls.archive_date:
                    try:
                        archive_date = cls.archive_date.strftime('%Y-%m-%d')
                    except:
                        pass
                
                writer.writerow([
                    cls.id,
                    cls.name,
                    cls.day_of_week or 'Not specified',
                    f"{cls.start_time.strftime('%H:%M') if cls.start_time else 'N/A'} - {cls.end_time.strftime('%H:%M') if cls.end_time else 'N/A'}",
                    instructor_name,
                    archive_date,
                    archive_reason
                ])
            
        elif folder == 'student' or folder == 'instructor' or folder == 'admin':
            # Filter by role
            role_filter = folder.capitalize()  # Convert 'student' to 'Student', etc.
            
            query = User.query.filter_by(is_archived=True)
            
            if folder == 'admin':
                query = query.filter(
                    or_(User.role.ilike('%admin%'), User.role.ilike('%administrator%'))
                )
            else:
                query = query.filter(User.role.ilike(f'%{role_filter}%'))
            
            if search_term:
                query = query.filter(
                    or_(
                        User.first_name.ilike(f'%{search_term}%'),
                        User.last_name.ilike(f'%{search_term}%'),
                        User.email.ilike(f'%{search_term}%')
                    )
                )
            
            archived_users = query.all()
            
            # Create CSV string
            # Write headers - slightly different for different user types
            if folder == 'student':
                writer.writerow(['Student ID', 'First Name', 'Last Name', 'Email', 'Company', 'Archive Date', 'Archive Reason'])
            elif folder == 'instructor':
                writer.writerow(['Instructor ID', 'First Name', 'Last Name', 'Email', 'Department', 'Archive Date', 'Archive Reason'])
            elif folder == 'admin':
                writer.writerow(['Admin ID', 'First Name', 'Last Name', 'Email', 'Role', 'Archive Date', 'Archive Reason'])
                
            # Write data rows
            for user in archived_users:
                # Extract archive reason if available
                archive_reason = 'Archived'
                if hasattr(user, 'notes') and user.notes and 'ARCHIVE NOTE' in user.notes:
                    match = re.search(r'ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(?:\n|$)', user.notes)
                    if match and match.group(1):
                        archive_reason = match.group(1).strip()
                
                # Format archive date
                archive_date = 'Unknown'
                if hasattr(user, 'archive_date') and user.archive_date:
                    try:
                        archive_date = user.archive_date.strftime('%Y-%m-%d')
                    except:
                        pass
                
                # Get company name for students / department for instructors
                company_or_dept = 'Not Available'
                if folder == 'student' and hasattr(user, 'company_id') and user.company_id:
                    try:
                        company = db.session.get(Company, user.company_id)
                        if company:
                            company_or_dept = company.name
                    except:
                        pass
                elif folder == 'instructor' and hasattr(user, 'department'):
                    company_or_dept = user.department or 'Not Assigned'
                elif folder == 'admin':
                    company_or_dept = user.role  # Use role for admin
                
                writer.writerow([
                    user.id,
                    user.first_name,
                    user.last_name, 
                    user.email,
                    company_or_dept,
                    archive_date,
                    archive_reason
                ])
            
        # Prepare response
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename=archived_{folder}_{datetime.now().strftime("%Y%m%d")}.csv'
            }
        )
        
    except Exception as e:
        print(f"Error exporting archives: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
        
        # Count students - using is_archived flag
        try:
            result['counts']['student'] = User.query.filter(
                User.is_archived == True,
                User.role.ilike('%student%')
            ).count()
            print(f"Student archive count: {result['counts']['student']}")
        except Exception as e:
            print(f"Error counting students: {str(e)}")
            result['counts']['student'] = 0
            
        # Count classes - both conditions must be met
        try:
            result['counts']['class'] = Class.query.filter(
                Class.is_active == False,
                Class.is_archived == True
            ).count()
            print(f"Class archive count: {result['counts']['class']}")
        except Exception as e:
            print(f"Error counting classes: {str(e)}")
            result['counts']['class'] = 0
            
        # Count companies - checking both inactive status and is_archived flag if available
        try:
            # Use ORM query with status field instead of is_archived
            result['counts']['company'] = Company.query.filter(
                Company.status == 'Inactive'
            ).count()
            print(f"Company archive count: {result['counts']['company']}")
        except Exception as e:
            print(f"Error counting companies: {str(e)}")
            result['counts']['company'] = 0
            
        # Count instructors - using is_archived flag
        try:
            result['counts']['instructor'] = User.query.filter(
                User.is_archived == True,
                User.role.ilike('%instructor%')
            ).count()
            print(f"Instructor archive count: {result['counts']['instructor']}")
        except Exception as e:
            print(f"Error counting instructors: {str(e)}")
            result['counts']['instructor'] = 0
            
        # Count admins - using is_archived flag
        try:
            result['counts']['admin'] = User.query.filter(
                User.is_archived == True,
                or_(
                    User.role.ilike('%admin%'), 
                    User.role.ilike('%administrator%')
                )
            ).count()
            print(f"Admin archive count: {result['counts']['admin']}")
        except Exception as e:
            print(f"Error counting admins: {str(e)}")
            result['counts']['admin'] = 0
            
        # Count attendance records - using is_archived flag
        try:
            result['counts']['attendance'] = Attendance.query.filter_by(is_archived=True).count()
            print(f"Attendance archive count: {result['counts']['attendance']}")
        except Exception as e:
            print(f"Error counting attendance: {str(e)}")
            result['counts']['attendance'] = 0
        
        print(f"Archive counts: {result['counts']}")
        return jsonify(result)
        
    except Exception as e:
        print(f"Error retrieving archive counts: {str(e)}")
        return jsonify({'counts': {
            'student': 0,
            'class': 0,
            'company': 0,
            'instructor': 0,
            'admin': 0,
            'attendance': 0
        }}), 200  # Return zeros with 200 status to prevent breaking the UI 

@api_bp.route('/students/<string:student_id>/enrollment', methods=['GET'])
@login_required
def get_student_enrollment(student_id):
    """Get enrollment details for a student"""
    try:
        # Get the student
        student = User.query.filter_by(id=student_id).first_or_404()
        
        # Get company info
        company = {"name": "Not Assigned", "company_id": None}
        if hasattr(student, 'company_id') and student.company_id:
            company_obj = Company.query.get(student.company_id)
            if company_obj:
                company = {
                    "name": company_obj.name,
                    "company_id": company_obj.id
                }
        
        # Get all enrollments for this student
        enrollment_records = Enrollment.query.filter_by(student_id=student_id).all()
        
        active_enrollments = []
        historical_enrollments = []
        all_enrollments = []
        
        for enrollment in enrollment_records:
            try:
                class_obj = Class.query.get(enrollment.class_id)
                if not class_obj:
                    continue
                
                # Get instructor info if available
                instructor_name = "Not Assigned"
                instructor_id = None
                if hasattr(class_obj, 'instructor_id') and class_obj.instructor_id:
                    instructor = User.query.get(class_obj.instructor_id)
                    if instructor:
                        instructor_name = f"{instructor.first_name} {instructor.last_name}"
                        instructor_id = instructor.id
                
                # Create enrollment data with proper structure
                enrollment_data = {
                    'id': enrollment.id,
                    'enrollment_id': enrollment.id,
                    'student_id': student_id,
                    'class_id': class_obj.id,
                    'status': enrollment.status,
                    'enrollment_status': enrollment.status,
                    'enrollment_date': enrollment.enrollment_date.strftime('%Y-%m-%d') if enrollment.enrollment_date else None,
                    'unenrollment_date': enrollment.unenrollment_date.strftime('%Y-%m-%d') if hasattr(enrollment, 'unenrollment_date') and enrollment.unenrollment_date else None,
                    'name': class_obj.name,
                    'class_name': class_obj.name,
                    'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M') if class_obj.start_time else ''} - {class_obj.end_time.strftime('%H:%M') if class_obj.end_time else ''}",
                    'instructor': instructor_name,
                    'instructor_name': instructor_name,
                    'instructor_id': instructor_id,
                    'day_of_week': class_obj.day_of_week,
                    'day': class_obj.day_of_week,
                    'start_time': class_obj.start_time.strftime('%H:%M') if class_obj.start_time else None,
                    'end_time': class_obj.end_time.strftime('%H:%M') if class_obj.end_time else None,
                    'time': f"{class_obj.start_time.strftime('%H:%M') if class_obj.start_time else ''} - {class_obj.end_time.strftime('%H:%M') if class_obj.end_time else ''}",
                    'is_active': enrollment.status.lower() == 'active' and (not hasattr(enrollment, 'unenrollment_date') or not enrollment.unenrollment_date)
                }
                
                # Add to the appropriate list based on enrollment status
                if not hasattr(enrollment, 'unenrollment_date') or not enrollment.unenrollment_date:
                    # This is an active enrollment
                    active_enrollments.append(enrollment_data)
                else:
                    # This is a historical enrollment
                    historical_enrollments.append(enrollment_data)
                
                # Also add to the main list
                all_enrollments.append(enrollment_data)
            except Exception as e:
                print(f"Error processing enrollment {enrollment.id if hasattr(enrollment, 'id') else 'unknown'}: {str(e)}")
                continue
        
        print(f"Found {len(active_enrollments)} active enrollments for student {student_id}")
        print(f"Found {len(historical_enrollments)} historical enrollments for student {student_id}")
        
        # Format the student info
        student_info = {
            "user_id": student.id,
            "name": f"{student.first_name} {student.last_name}",
            "email": student.email,
            "role": student.role,
            "status": "Active" if student.is_active else "Inactive",
            "profile_img": student.profile_img
        }
        
        # Return formatted response
        return jsonify({
            "student": student_info,
            "company": company,
            "classes": all_enrollments,
            "active_enrollments": active_enrollments,
            "historical_enrollments": historical_enrollments,
            "enrollments_count": len(all_enrollments),
            "active_count": len(active_enrollments)
        })
        
    except Exception as e:
        print(f"Error in get_student_enrollment: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/enrollments/approve', methods=['POST'])
@login_required
def approve_student_enrollment():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        if 'student_id' not in data or 'class_id' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        student_id = data['student_id']
        class_id = data['class_id']
        
        # Get the requested status (default to 'Active' for backward compatibility)
        requested_status = data.get('status', 'Active')
        
        # Validate that status is either Active or Pending
        if requested_status not in ['Active', 'Pending']:
            return jsonify({'error': f'Invalid status: {requested_status}. Must be Active or Pending'}), 400
        
        print(f"Updating enrollment status to {requested_status} for student {student_id} in class {class_id}")
        
        # Find the enrollment
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, 
            class_id=class_id,
            unenrollment_date=None  # Make sure we're updating an active enrollment
        ).first()
        
        if not enrollment:
            return jsonify({'error': 'Active enrollment not found'}), 404
        
        # Update status to requested value
        enrollment.status = requested_status
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Enrollment status updated to {requested_status} successfully'
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error updating enrollment status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/enrollments/unenroll', methods=['POST'])
@login_required
def unenroll_student():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        if 'student_id' not in data or 'class_id' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        student_id = data['student_id']
        class_id = data['class_id']
        
        print(f"DEBUG: Attempting to unenroll student {student_id} from class {class_id}")
        
        # Get unenrollment date from request or use current date
        unenrollment_date = datetime.now().date()
        if 'unenrollment_date' in data:
            try:
                unenrollment_date = datetime.strptime(data['unenrollment_date'], '%Y-%m-%d').date()
                print(f"DEBUG: Using provided unenrollment_date: {unenrollment_date}")
            except (ValueError, TypeError):
                print(f"WARNING: Invalid unenrollment_date format. Using current date instead.")
        
        # First check if the enrollment exists using raw SQL to avoid ORM issues
        check_sql = text("""
            SELECT id FROM enrollment 
            WHERE student_id = :student_id AND class_id = :class_id
            LIMIT 1
        """)
        
        print(f"DEBUG: Looking for enrollment with student_id={student_id}, class_id={class_id}")
        result = db.session.execute(check_sql, {
            "student_id": student_id, 
            "class_id": class_id
        }).fetchone()
        
        if not result:
            print(f"DEBUG: Enrollment not found for student {student_id}, class {class_id}")
            return jsonify({'error': 'Enrollment not found'}), 404
        
        enrollment_id = result[0]
        print(f"DEBUG: Found enrollment id: {enrollment_id}")
        
        # Instead of deleting, update the enrollment to set unenrollment_date
        update_sql = text("""
            UPDATE enrollment
            SET unenrollment_date = :unenrollment_date,
                status = 'Pending'
            WHERE id = :enrollment_id
        """)
        
        # Execute the update statement
        db.session.execute(update_sql, {
            "enrollment_id": enrollment_id,
            "unenrollment_date": unenrollment_date
        })
        
        # Commit the changes
        db.session.commit()
        
        print(f"DEBUG: Successfully unenrolled student {student_id} from class {class_id} with unenrollment date {unenrollment_date}")
        
        return jsonify({
            'success': True,
            'message': 'Student unenrolled successfully',
            'unenrollment_date': unenrollment_date.isoformat()
        })
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error deleting enrollment: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@api_bp.route('/enrollments/revert-to-pending', methods=['POST'])
@login_required
def revert_enrollment_to_pending():
    """API endpoint to change an enrollment status from Active to Pending"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        if 'student_id' not in data or 'class_id' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        student_id = data['student_id']
        class_id = data['class_id']
        
        print(f"DEBUG: Attempting to revert enrollment status to Pending for student {student_id} in class {class_id}")
        
        # Check if the enrollment exists using raw SQL to avoid ORM issues
        check_sql = text("""
            SELECT id, status FROM enrollment 
            WHERE student_id = :student_id AND class_id = :class_id
            LIMIT 1
        """)
        
        result = db.session.execute(check_sql, {
            "student_id": student_id, 
            "class_id": class_id
        }).fetchone()
        
        if not result:
            return jsonify({'error': 'Enrollment not found'}), 404
        
        enrollment_id = result[0]
        current_status = result[1]
        
        # Only proceed if status is currently Active
        if current_status.upper() != 'ACTIVE':
            return jsonify({'error': f'Cannot revert: Enrollment is not Active (current status: {current_status})'}), 400
        
        # Update enrollment status to Pending
        update_sql = text("""
            UPDATE enrollment
            SET status = 'Pending'
            WHERE id = :enrollment_id
        """)
        
        # Execute the update statement
        db.session.execute(update_sql, {
            "enrollment_id": enrollment_id
        })
        
        # Commit the update
        db.session.commit()
        
        print(f"DEBUG: Successfully reverted enrollment status to Pending for record {enrollment_id}")
        
        return jsonify({
            'success': True,
            'message': 'Enrollment status reverted to Pending successfully'
        })
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error reverting enrollment status: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@api_bp.route('/enrollments/<string:student_id>/<string:class_id>', methods=['DELETE'])
@login_required
def delete_enrollment(student_id, class_id):
    """Delete/unenroll a student from a class by setting unenrollment_date"""
    try:
        print(f"Processing unenrollment for student {student_id} from class {class_id}")
        
        # Check if enrollment exists without filtering by unenrollment_date
        check_sql = text("""
            SELECT id, enrollment_date, status, unenrollment_date
            FROM enrollment 
            WHERE student_id = :student_id 
            AND class_id = :class_id
            AND unenrollment_date IS NULL
            ORDER BY id DESC
            LIMIT 1
        """)
        enrollment = db.session.execute(check_sql, {"student_id": student_id, "class_id": class_id}).fetchone()
        
        if not enrollment:
            print(f"Active enrollment not found for student {student_id} and class {class_id}")
            return jsonify({"error": "Active enrollment not found"}), 404
        
        enrollment_id = enrollment[0]
        current_unenrollment_date = enrollment[3] if len(enrollment) > 3 else None
        
        print(f"Found active enrollment ID {enrollment_id}, current unenrollment_date: {current_unenrollment_date}")
        
        # Use current date for unenrollment - don't rely on request.json
        unenrollment_date = datetime.now().strftime('%Y-%m-%d')
        
        # Set the unenrollment_date for this specific enrollment record
        update_sql = text("""
            UPDATE enrollment 
            SET unenrollment_date = :unenrollment_date, 
                status = 'Pending' 
            WHERE id = :enrollment_id
        """)
        
        db.session.execute(update_sql, {
            "unenrollment_date": unenrollment_date,
            "enrollment_id": enrollment_id
        })
        db.session.commit()
        
        print(f"Successfully unenrolled student {student_id} from class {class_id} with unenrollment date {unenrollment_date}")
        return jsonify({
            "success": True, 
            "message": "Enrollment successfully updated with unenrollment date",
            "unenrollment_date": unenrollment_date
        }), 200
            
    except Exception as e:
        db.session.rollback()
        print(f"Error in delete_enrollment: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@api_bp.route('/enrollments/export-csv', methods=['GET'])
@login_required
def export_enrollments_csv():
    """Generate CSV export of enrollments with filtering options"""
    try:
        # Get filter parameters from the request
        status_filter = request.args.get('status', '')
        search_term = request.args.get('search', '')
        
        # Get all enrollments from database
        enrollments_query = db.session.execute(text("""
            SELECT id, student_id, class_id, enrollment_date, status, unenrollment_date
            FROM enrollment
            ORDER BY enrollment_date DESC
        """)).fetchall()
        
        # Get all student data
        students_data = {}
        for student in User.query.filter_by(role='Student').all():
            students_data[student.id] = {
                'id': student.id,
                'name': f"{student.first_name} {student.last_name}",
                'email': student.email,
                'company_id': student.company_id,
                'is_active': student.is_active
            }
        
        # Get all class data
        classes_data = {}
        for class_obj in Class.query.all():
            classes_data[class_obj.id] = {
                'id': class_obj.id,
                'name': class_obj.name
            }
        
        # Get all company data
        companies_data = {}
        for company in Company.query.all():
            companies_data[company.id] = {
                'id': company.id,
                'name': company.name
            }
        
        # Process and filter enrollments
        processed_enrollments = []
        
        for enrollment in enrollments_query:
            enrollment_id = enrollment[0]
            student_id = enrollment[1]
            class_id = enrollment[2]
            enrollment_date = enrollment[3]
            status = enrollment[4]
            unenrollment_date = enrollment[5]
            
            # Skip if student doesn't exist in our data
            if student_id not in students_data:
                continue
            
            # Get student data
            student_data = students_data.get(student_id, {})
            student_name = student_data.get('name', 'Unknown')
            
            # Get class data
            class_data = classes_data.get(class_id, {})
            class_name = class_data.get('name', 'Unknown Class')
            
            # Apply search filter if specified
            if search_term and not (
                search_term.lower() in student_name.lower() or 
                search_term.lower() in str(student_id).lower()
            ):
                continue
            
            # Apply status filter if specified
            if status_filter and status != status_filter:
                continue
            
            # Get company data
            company_id = student_data.get('company_id')
            company_name = "Not Assigned"
            if company_id and company_id in companies_data:
                company_name = companies_data[company_id].get('name', 'Unknown Company')
            
            # Create record for CSV
            processed_enrollments.append({
                'student_id': student_id,
                'student_name': student_name,
                'student_status': 'Active' if student_data.get('is_active', False) else 'Inactive',
                'company_name': company_name,
                'class_id': class_id,
                'class_name': class_name,
                'enrollment_date': enrollment_date.strftime('%Y-%m-%d') if hasattr(enrollment_date, 'strftime') else str(enrollment_date),
                'enrollment_status': status,
                'unenrollment_date': unenrollment_date.strftime('%Y-%m-%d') if unenrollment_date and hasattr(unenrollment_date, 'strftime') else ''
            })
        
        # Generate CSV
        output = StringIO()
        fieldnames = [
            'student_id', 'student_name', 'student_status', 'company_name',
            'class_id', 'class_name', 'enrollment_date', 'enrollment_status', 'unenrollment_date'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(processed_enrollments)
        
        # Create response with CSV data
        response = make_response(output.getvalue())
        response.headers["Content-Disposition"] = f"attachment; filename=enrollments-{datetime.now().strftime('%Y%m%d')}.csv"
        response.headers["Content-Type"] = "text/csv"
        
        return response
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/attendance', methods=['GET'])
@login_required
@admin_or_instructor_required
def get_attendance():
    """
    Get attendance records with filters
    Filters:
    - class_id: Filter by class
    - student_id: Filter by student
    - date_from: Filter from this date
    - date_to: Filter to this date
    - status: Filter by status (comma-separated)
    """
    try:
        # Get query parameters
        class_id = request.args.get('class_id')
        student_id = request.args.get('student_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        status = request.args.get('status')
        
        # Start the query
        query = db.session.query(
            Attendance,
            User.first_name,
            User.last_name,
            Class.name.label('class_name')
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        ).filter(
            Attendance.is_archived == False
        )
        
        # Apply filters
        if class_id:
            query = query.filter(Attendance.class_id == class_id)
        
        if student_id:
            query = query.filter(Attendance.student_id == student_id)
        
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                query = query.filter(Attendance.date >= from_date)
            except ValueError:
                return jsonify({'error': 'Invalid date_from format. Use YYYY-MM-DD.'}), 400
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
                query = query.filter(Attendance.date <= to_date)
            except ValueError:
                return jsonify({'error': 'Invalid date_to format. Use YYYY-MM-DD.'}), 400
        
        if status:
            status_list = status.split(',')
            query = query.filter(Attendance.status.in_(status_list))
        
        # Restrict instructors to only see their classes
        if current_user.role == 'Instructor':
            query = query.filter(Class.instructor_id == current_user.id)
        
        # Execute query
        results = query.order_by(Attendance.date.desc()).all()
        
        # Format results
        attendance_records = []
        for record in results:
            attendance, first_name, last_name, class_name = record
            
            attendance_records.append({
                'id': attendance.id,
                'studentId': attendance.student_id,
                'studentName': f"{first_name} {last_name}",
                'classId': attendance.class_id,
                'className': class_name,
                'date': attendance.date.strftime('%Y-%m-%d'),
                'status': attendance.status,
                'comments': attendance.comments
            })
        
        # Calculate stats
        stats = calculate_attendance_stats(attendance_records)
        
        # Calculate total count
        total_count = len(attendance_records)
        
        # Calculate total pages
        per_page = int(request.args.get('per_page', 10))  # Default to 10 per page
        total_pages = math.ceil(total_count / per_page) if total_count > 0 else 1
        
        return jsonify({
            'attendance': attendance_records,
            'stats': stats,
            'total': total_count
        })
    except Exception as e:
        print(f"Error retrieving attendance records: {str(e)}")
        return jsonify({'error': str(e)}), 500

def calculate_attendance_stats(attendance_records):
    """
    Calculate statistics from attendance records
    """
    # Count unique students
    unique_students = set(record['studentId'] for record in attendance_records)
    
    # Count unique classes
    unique_classes = set(record['classId'] for record in attendance_records)
    
    # Calculate attendance rate
    present_count = sum(1 for record in attendance_records if record['status'] == 'Present')
    total_count = len(attendance_records)
    attendance_rate = (present_count / total_count * 100) if total_count > 0 else 0
    
    # Get total enrollments count
    enrollments_count = len(attendance_records)
    
    return {
        'totalStudents': len(unique_students),
        'activeClasses': len(unique_classes),
        'attendanceRate': attendance_rate,
        'totalEnrollments': enrollments_count
    }

@api_bp.route('/attendance/<int:record_id>/archive', methods=['POST'])
@login_required
def archive_attendance_record(record_id):
    """Archive an attendance record"""
    try:
        data = request.json or {}
        
        # Get the attendance record
        attendance = Attendance.query.get_or_404(record_id)
        
        # Check if already archived
        if attendance.is_archived:
            return jsonify({
                'success': False,
                'message': 'This attendance record is already archived'
            }), 400
        
        # Mark as archived
        attendance.is_archived = True
        attendance.archive_date = datetime.utcnow().date()
        
        # Format archive note with consistent pattern
        archive_timestamp = datetime.now().strftime('%Y-%m-%d')
        reason = data.get('reason', 'User requested archive')
        comment = data.get('comment', '')
        admin_name = f"{current_user.first_name} {current_user.last_name}"
        
        # The main reason that will be shown
        archive_note = f"ARCHIVE NOTE ({archive_timestamp}): {reason}"
        if comment:
            archive_note += f" - {comment}"
        
        # Add admin name in a standardized format that the UI can parse
        archive_note += f"\nArchived by: {admin_name}"
        
        # Preserve original comment if it exists
        if attendance.comments:
            attendance.comments = f"{archive_note}\n\nOriginal comment: {attendance.comments}"
        else:
            attendance.comments = archive_note
        
        # Save changes
        db.session.commit()
        
        # Get updated stats
        try:
            attendance_count = Attendance.query.filter_by(is_archived=True).count()
            student_count = User.query.filter_by(is_archived=True, role='Student').count()
            instructor_count = User.query.filter_by(is_archived=True, role='Instructor').count()
            class_count = Class.query.filter_by(is_archived=True).count()
            company_count = Company.query.filter_by(status='Inactive').count()
        except:
            # Default values if count fails
            attendance_count = 0
            student_count = 0
            instructor_count = 0
            class_count = 0
            company_count = 0
        
        return jsonify({
            'success': True,
            'message': 'Attendance record archived successfully',
            'stats': {
                'attendance': attendance_count,
                'student': student_count,
                'instructor': instructor_count,
                'class': class_count,
                'company': company_count
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/archives/attendance', methods=['GET'])
def get_archived_attendance():
    """Get archived attendance records"""
    try:
        # Get query parameters
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 5))
        
        # Start with base query for archived attendance records
        query = db.session.query(
            Attendance, User, Class
        ).outerjoin(  # Change to outerjoin to handle null relationships
            User, Attendance.student_id == User.id
        ).outerjoin(  # Change to outerjoin to handle null relationships
            Class, Attendance.class_id == Class.id
        ).filter(
            Attendance.is_archived == True
        )
        
        # Apply search filter if provided
        if search:
            query = query.filter(
                or_(
                    User.first_name.ilike(f'%{search}%'),
                    User.last_name.ilike(f'%{search}%'),
                    Class.name.ilike(f'%{search}%')
                )
            )
        
        # Get total count
        total_records = query.count()
        
        # Apply pagination
        start_idx = (page - 1) * per_page
        records = query.order_by(Attendance.archive_date.desc()).offset(start_idx).limit(per_page).all()
        
        # Format records for response
        formatted_records = []
        for record in records:
            try:
                attendance = record[0] if record[0] else None
                student = record[1] if len(record) > 1 else None
                class_obj = record[2] if len(record) > 2 else None
                
                if not attendance:
                    continue  # Skip this record if attendance is None
                
                instructor_name = "Unknown"
                
                if class_obj and class_obj.instructor_id:
                    try:
                        instructor = User.query.get(class_obj.instructor_id)
                        if instructor:
                            instructor_name = f"{instructor.first_name} {instructor.last_name}"
                    except:
                        pass  # If instructor fetch fails, use the default "Unknown"
                
                # Extract archive reason if available
                archive_reason = "Archived"
                if attendance.comments and isinstance(attendance.comments, str) and "ARCHIVE NOTE" in attendance.comments:
                    try:
                        import re
                        match = re.search(r'ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(\n|$)', attendance.comments)
                        if match and match.group(1):
                            archive_reason = match.group(1).strip()
                    except:
                        pass  # If regex fails, use the default "Archived"
                
                # Create a safe record that handles null values
                student_name = "Unknown"
                if student:
                    first_name = getattr(student, 'first_name', '')
                    last_name = getattr(student, 'last_name', '')
                    student_name = f"{first_name} {last_name}".strip() or "Unknown"
                
                formatted_records.append({
                    'id': getattr(attendance, 'id', None),
                    'student_id': getattr(attendance, 'student_id', None),
                    'student_name': student_name,
                    'student_profile_img': getattr(student, 'profile_img', 'profile.png') if student else 'profile.png',
                    'class_id': getattr(attendance, 'class_id', None),
                    'class_name': getattr(class_obj, 'name', "Unknown") if class_obj else "Unknown",
                    'instructor_name': instructor_name,
                    'date': attendance.date.strftime('%Y-%m-%d') if hasattr(attendance, 'date') and attendance.date else 'Unknown',
                    'status': getattr(attendance, 'status', "Unknown"),
                    'archive_date': attendance.archive_date.strftime('%Y-%m-%d') if hasattr(attendance, 'archive_date') and attendance.archive_date else 'Unknown',
                    'archive_reason': archive_reason,
                    'comments': getattr(attendance, 'comments', ""),
                })
            except Exception as record_error:
                print(f"Error processing record: {record_error}")
                continue  # Skip this record and continue with others
        
        # Count all archive types for stats - with error handling
        try:
            student_count = User.query.filter_by(is_archived=True, role='Student').count()
        except:
            student_count = 0
            
        try:
            instructor_count = User.query.filter_by(is_archived=True, role='Instructor').count()
        except:
            instructor_count = 0
            
        try:
            class_count = Class.query.filter_by(is_archived=True).count()
        except:
            class_count = 0
            
        try:
            company_count = Company.query.filter_by(is_archived=True).count()
        except:
            company_count = 0
            
        try:
            attendance_count = Attendance.query.filter_by(is_archived=True).count()
        except:
            attendance_count = 0
        
        # Prepare response
        response = {
            'records': formatted_records,
            'total': total_records,
            'counts': {
                'student': student_count,
                'instructor': instructor_count,
                'class': class_count,
                'company': company_count,
                'attendance': attendance_count
            }
        }
        
        return jsonify(response)
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in get_archived_attendance: {str(e)}")
        return jsonify({
            'error': str(e),
            'records': [],
            'total': 0,
            'counts': {
                'student': 0,
                'instructor': 0,
                'class': 0,
                'company': 0,
                'attendance': 0
            }
        }), 500

@api_bp.route('/classes/instructor/<string:instructor_id>', methods=['GET'])
@login_required
def get_instructor_classes(instructor_id):
    """API endpoint to get classes taught by a specific instructor"""
    try:
        # Get the instructor
        instructor = User.query.filter_by(id=instructor_id, role='Instructor').first()
        if not instructor:
            return jsonify({'error': 'Instructor not found'}), 404
            
        # Get classes taught by this instructor
        classes = Class.query.filter_by(instructor_id=instructor_id).all()
        
        result = []
        for class_obj in classes:
            # Get enrolled student count
            student_count = Enrollment.query.filter_by(class_id=class_obj.id).count()
            
            result.append({
                'class_id': class_obj.id,
                'name': class_obj.name,
                'description': class_obj.description,
                'day_of_week': class_obj.day_of_week,
                'start_time': class_obj.start_time.strftime('%H:%M') if class_obj.start_time else None,
                'end_time': class_obj.end_time.strftime('%H:%M') if class_obj.end_time else None,
                'time': f"{class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}" if class_obj.start_time and class_obj.end_time else None,
                'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}" if class_obj.day_of_week and class_obj.start_time and class_obj.end_time else None,
                'is_active': class_obj.is_active,
                'term': class_obj.term,
                'students_count': student_count
            })
        
        return jsonify(result)
    except Exception as e:
        print(f"Error fetching instructor classes: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/users/<string:user_id>/archive', methods=['PUT'])
@login_required
def archive_user(user_id):
    """API endpoint to archive a user"""
    try:
        # Check if user exists
        user = User.query.get_or_404(user_id)
        
        # Check if current user has permission (must be admin)
        if current_user.role.lower() != 'admin':
            return jsonify({'error': 'You do not have permission to archive users'}), 403

        # Get archive reason from request data
        data = request.json or {}
        archive_reason = data.get('reason', 'User archived by administrator')
        
        # Archive the user by setting is_active = False and is_archived = True
        user.is_active = False
        user.is_archived = True
        
        # Add timestamp to track when archive happened - safely handle missing column
        try:
            if hasattr(user, 'archive_date'):
                user.archive_date = datetime.now().date()
        except Exception as e:
            pass
        
        # Format archive note with consistent pattern
        archive_timestamp = datetime.now().strftime('%Y-%m-%d')
        admin_name = f"{current_user.first_name} {current_user.last_name}"
        
        # The main reason that will be shown
        archive_note = f"ARCHIVE NOTE ({archive_timestamp}): {archive_reason}"
        # Add admin name in a standardized format that the UI can parse
        archive_note += f"\nArchived by: {admin_name}"
        
        # Update notes field if it exists
        try:
            if hasattr(user, 'notes'):
                if user.notes:
                    user.notes += f"\n\n{archive_note}"
                else:
                    user.notes = archive_note
        except Exception as e:
            pass
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'User {user.id} has been archived successfully',
            'role': user.role.lower()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/users/<string:user_id>/status', methods=['PUT'])
@login_required
def update_user_status(user_id):
    """API endpoint to update a user's active status"""
    try:
        # Check if user exists
        user = User.query.get_or_404(user_id)
        
        # Check if current user has permission (must be admin)
        if current_user.role.lower() != 'admin':
            return jsonify({'error': 'You do not have permission to update user status'}), 403
        
        # Get the is_active status from the request
        data = request.get_json()
        if 'is_active' not in data:
            return jsonify({'error': 'Missing is_active field in request'}), 400
            
        # Update the user status
        user.is_active = data['is_active']
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'User {user.id} status updated successfully',
            'is_active': user.is_active
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error updating user status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/classes/create', methods=['POST'])
@login_required
@admin_required
def create_class():
    """
    Create a new class
    """
    # Get JSON data from request
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Validate required fields
    required_fields = ['name', 'day', 'time', 'year']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
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

# Helper function to get company name by id
def get_company_name(company_id):
    """Get company name from company_id"""
    if not company_id:
        return "Not Assigned"
    
    try:
        company = Company.query.get(company_id)
        if company:
            return company.name
    except Exception as e:
        print(f"Error getting company name: {str(e)}")
    
    return "Unknown Company"