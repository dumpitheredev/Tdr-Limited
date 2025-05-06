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
import sys
import os
import re
import string
import random
from functools import wraps
from sqlalchemy.exc import IntegrityError 

# Create API blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Role-based access control decorators
def admin_required(f):
    """Decorator to check if the user is an admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if user is authenticated and is an admin
        if not current_user.is_authenticated or 'admin' not in current_user.role.lower():
            return jsonify({'error': 'Unauthorized access'}), 403

        # For POST, PUT, DELETE methods (CRUD operations except Read), 
        # check if the user has limited access
        if request.method in ['POST', 'PUT', 'DELETE']:
            # If access_level is limited, restrict access
            if hasattr(current_user, 'access_level') and current_user.access_level == 'limited':
                return jsonify({'error': 'Limited access accounts cannot perform this operation'}), 403
                
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
        'status': getattr(company, 'is_active', 'Active')
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
            User.first_name.like(f'%{search}%') |
            User.last_name.like(f'%{search}%') |
            User.email.like(f'%{search}%')
        )
    
    users = query.all()
    
    # Format response
    result = [{
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'role': user.role,
            'is_active': user.is_active,
            'profile_img': user.profile_img
    } for user in users]
    
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
        print(f"Error in get_user: {str(e)}")
        traceback.print_exc()
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
    
    # Include access level in response
    access_level = 'full'
    if hasattr(user, 'access_level') and user.access_level:
        access_level = user.access_level
    
    return {
        'admin_role': 'admin',
        'permissions': permissions,
        'access_roles': permissions,  # Alias for compatibility
        'access_level': access_level  # Add access level to the response
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
    
    # LINE TO FILTER OUT ARCHIVED USERS
    query = query.filter(User.is_archived != True)
    
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
            'profile_img': instructor.profile_img,
            'department': instructor.department,
            'specialization': instructor.specialization
        })
    
    return jsonify(result)

@api_bp.route('/companies', methods=['GET'])
@login_required
def get_companies():
    """API endpoint to get all companies"""
    # Fetch all companies, removing the is_archived filter
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
            'user_id': student.id, # Change key to user_id
            'name': f"{student.first_name} {student.last_name}",
            'email': student.email,
            'status': 'Active' if student.is_active else 'Inactive',
            'profile_img': student.profile_img # Add profile_img
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
            # Validate the input status value
            if data['status'] in ['Active', 'Inactive']:
                company.is_active = data['status']
            else:
                # Handle invalid status value if necessary, e.g., return error or default
                print(f"Warning: Invalid status value '{data['status']}' received for company {company_id}. Defaulting to Active.")
                company.is_active = 'Active'
        
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
            return jsonify({'error': 'Company ID generation conflict, please try again'}), 400 # Changed message slightly

        # Check if email already exists
        existing_email_company = Company.query.filter(func.lower(Company.email) == func.lower(data['email'])).first()
        if existing_email_company:
             return jsonify({'error': 'Email address already exists in the system'}), 400

        # Create new company
        new_company = Company(
            company_id=data['company_id'],
            name=data['name'],
            contact=data['contact'],
            email=data['email'],
            is_active='Active'
        )
        
        # Add to database
        db.session.add(new_company)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Company created successfully',
            'company_id': data['company_id']
        }), 201
        
    except IntegrityError as ie:
        db.session.rollback()
        error_str = str(ie.orig).lower() # Check the original DB driver error message
        if 'duplicate entry' in error_str and 'company.email' in error_str:
            return jsonify({'error': 'Email address already exists'}), 400
        elif 'duplicate entry' in error_str and ('company.PRIMARY' in error_str or 'company.id' in error_str): # Check primary key too
             return jsonify({'error': 'Company ID conflict, please try again'}), 400
        else:
            return jsonify({'error': 'Database integrity error. Please check input.'}), 500
    except Exception as e:
        db.session.rollback()
        traceback.print_exc() # Keep traceback for unexpected errors
        return jsonify({'error': f'Failed to create company: An unexpected error occurred.'}), 500

@api_bp.route('/companies-direct', methods=['GET'])
@login_required
def get_companies_direct():
    """API endpoint to get companies, filtering by status and including archive status."""
    try:
        status_filter = request.args.get('status') # e.g., 'Active', 'Inactive', 'Archived', 'All'
        params = {}
        where_clauses = []

        if status_filter == 'Active':
            where_clauses.append("is_active = 'Active'")
            where_clauses.append("is_archived = false")
        elif status_filter == 'Inactive':
            where_clauses.append("is_active = 'Inactive'")
            where_clauses.append("is_archived = false")
        elif status_filter == 'Archived':
            where_clauses.append("is_archived = true")
        # No clause needed for 'All' or empty/None status_filter
        
        # Base query including is_archived
        query = "SELECT id, name, contact, email, is_active, is_archived, created_at, updated_at FROM company"
        
        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)
            
        query += " ORDER BY name" # Optional: Order results

        # Fetch companies using the constructed query
        result = db.session.execute(text(query), params)
        companies = []
        
        # Map the results to dictionaries, including is_archived
        for row in result:
            companies.append({
                'company_id': row.id,
                'name': row.name,
                'contact': row.contact,
                'email': row.email,
                'status': row.is_active, # Keep 'status' based on is_active for consistency with UI
                'is_archived': row.is_archived, # Include the archive status
                'created_at': row.created_at.isoformat() if row.created_at else None,
                'updated_at': row.updated_at.isoformat() if row.updated_at else None
            })
        
        return jsonify(companies)
    except Exception as e:
        print(f"Error fetching companies: {str(e)}")
        traceback.print_exc() # Print traceback for detailed error
        return jsonify([]), 500

@api_bp.route('/companies-direct/<string:company_id>', methods=['GET'])
@login_required
def get_company_direct(company_id):
    """API endpoint to get a specific company by ID using direct SQL to avoid ORM mapping issues"""
    try:
        # Use raw SQL to query the company, select is_active instead of status
        result = db.session.execute(
            text("SELECT id, name, contact, email, is_active, created_at, updated_at FROM company WHERE id = :company_id"),
            {"company_id": company_id}
        ).fetchone()
        
        if not result:
            return jsonify({"error": "Company not found"}), 404
        
        # Get students associated with this company
        students = User.query.filter_by(company_id=company_id, role='Student').all()
        student_list = []
        
        for student in students:
            student_list.append({
                'user_id': student.id, # Change key to user_id
                'name': f"{student.first_name} {student.last_name}",
                'email': student.email,
                'status': 'Active' if student.is_active else 'Inactive',
                'profile_img': student.profile_img # Add profile_img
            })
        
        # Map the result to a dictionary
        company = {
            'company_id': result.id,
            'name': result.name,
            'contact': result.contact,
            'email': result.email,
            'status': result.is_active,
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
        
        # Get the company first to check current status using is_active
        company = Company.query.get(company_id)
        if not company:
            return jsonify({'error': 'Company not found'}), 404
            
        # Check if we're archiving/changing status (check is_active field)
        is_status_change_to_inactive = 'status' in data and data['status'] == 'Inactive' and company.is_active != 'Inactive'
        
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
            if data['status'] in ['Active', 'Inactive']:
                update_fields.append("is_active = :is_active")
                params["is_active"] = data['status']
            else:
                # Handle invalid status value if necessary
                print(f"Warning: Invalid status value '{data['status']}' received in update_company_direct for company {company_id}. Ignoring status update.")
        
        # Add updated_at timestamp
        update_fields.append("updated_at = NOW()")
        
        # If changing status to Inactive, consider adding archive note (logic unchanged, uses notes field)
        if is_status_change_to_inactive and 'archiveNote' in data and data['archiveNote']:
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
            if is_status_change_to_inactive:
                message = 'Company status set to Inactive successfully'
            
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

@api_bp.route('/companies/<string:company_id>/archive', methods=['PUT'])
@login_required
@admin_required
def archive_company(company_id):
    """API endpoint to archive a specific company."""
    try:
        company = Company.query.get_or_404(company_id)
        
        # Get the reason from the request body
        data = request.json or {}
        archive_reason = data.get('reason', 'No reason provided') # Get reason or use default

        # Check for active students associated with this company
        active_students = User.query.filter_by(
            company_id=company_id,
            role='Student',
            is_active=True,
            is_archived=False
        ).count()
        
        if active_students > 0:
            return jsonify({
                'success': False, # Add success: False
                'error': f'Company has {active_students} active students',
                'details': 'Reassign or archive students before archiving the company.'
            }), 400

        # Mark as inactive and archived
        company.is_active = 'Inactive'
        company.is_archived = True
        
        # Add archive note (similar to user archive)
        if hasattr(company, 'notes'):
            archive_timestamp = datetime.now().strftime('%Y-%m-%d')
            admin_name = f"{current_user.first_name} {current_user.last_name}"
            
            # Use the extracted archive_reason here
            archive_note = f"ARCHIVE NOTE ({archive_timestamp}): {archive_reason}\nArchived by: {admin_name}"
            
            # Update notes field with the archive note
            if company.notes:
                company.notes += f"\n\n{archive_note}"
            else:
                company.notes = archive_note
        
        # Add archive date if column exists (it might not if migration hasn't added it yet)
        if hasattr(company, 'archive_date'):
             try:
                 company.archive_date = datetime.now().date()
             except Exception as e:
                 print(f"Warning: Could not set archive_date for company {company_id}: {e}")

        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Company {company.name} ({company_id}) has been archived.'
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error archiving company {company_id}: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Failed to archive company: {str(e)}'}), 500

@api_bp.route('/classes', methods=['GET', 'POST'])
@login_required
def get_classes():
    """
    Get a list of all classes or create a new class
    """
    # Handle POST request to create a new class
    if request.method == 'POST':
        try:
            # Check if user has permission to create classes
            if current_user.role.lower() != 'admin':
                return jsonify({
                    'error': 'You do not have permission to create classes'
                }), 403
                
            # Get JSON data from request
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
                
            # Extract class data
            name = data.get('name')
            description = data.get('description', '')
            day_of_week = data.get('day')
            instructor_id = data.get('instructor_id')
            year = data.get('year')
            status = data.get('status', 'Active')
            
            # Parse time string (format: "09:00 - 10:00")
            time_str = data.get('time', '')
            start_time = None
            end_time = None
            
            if time_str and ' - ' in time_str:
                time_parts = time_str.split(' - ')
                if len(time_parts) == 2:
                    start_time_str, end_time_str = time_parts
                    try:
                        # Convert time strings to time objects
                        start_time = datetime.strptime(start_time_str.strip(), '%H:%M').time()
                        end_time = datetime.strptime(end_time_str.strip(), '%H:%M').time()
                    except ValueError:
                        return jsonify({'error': 'Invalid time format. Use HH:MM format.'}), 400
            
            # Validate required fields
            if not name or not name.strip():
                return jsonify({'error': 'Class name is required'}), 400
                
            if not day_of_week or not day_of_week.strip():
                return jsonify({'error': 'Day of week is required'}), 400
                
            if not start_time or not end_time:
                return jsonify({'error': 'Start and end times are required'}), 400
                
            # Generate a unique class ID with format: kl + 2 digits + 2 lowercase letters
            import string
            class_id = 'kl' + ''.join(random.choices('0123456789', k=2)) + ''.join(random.choices(string.ascii_lowercase, k=2))
            
            # Check if the ID already exists, if so, generate a new one
            while Class.query.filter_by(id=class_id).first():
                class_id = 'kl' + ''.join(random.choices('0123456789', k=2)) + ''.join(random.choices(string.ascii_lowercase, k=2))
                
            # Create new class object
            new_class = Class(
                id=class_id,
                name=name,
                description=description,
                day_of_week=day_of_week,
                start_time=start_time,
                end_time=end_time,
                instructor_id=instructor_id if instructor_id else None,
                term=year,
                is_active=(status.lower() == 'active'),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            # Add to database
            db.session.add(new_class)
            db.session.commit()
            
            # Get instructor name for response
            instructor_name = "Not Assigned"
            if instructor_id:
                instructor = User.query.get(instructor_id)
                if instructor:
                    instructor_name = f"{instructor.first_name} {instructor.last_name}"
            
            # Return success response
            return jsonify({
                'success': True,
                'message': f'Class "{name}" created successfully',
                'class': {
                    'id': new_class.id,
                    'name': new_class.name,
                    'description': new_class.description,
                    'dayOfWeek': new_class.day_of_week,
                    'startTime': new_class.start_time.strftime('%H:%M') if new_class.start_time else None,
                    'endTime': new_class.end_time.strftime('%H:%M') if new_class.end_time else None,
                    'instructorId': new_class.instructor_id,
                    'instructorName': instructor_name,
                    'term': new_class.term,
                    'isActive': new_class.is_active
                }
            })
            
        except Exception as e:
            db.session.rollback()
            import traceback
            traceback.print_exc()
            return jsonify({
                'error': f'Failed to create class: {str(e)}'
            }), 500
    
    # Handle GET request to fetch classes
    try:
        # Get query parameters
        is_active = request.args.get('is_active')
        instructor_id = request.args.get('instructor_id')
        
        # Start the query
        query = db.session.query(Class)
        
        # Always exclude archived classes from the main class list
        query = query.filter(Class.is_archived != True)
        
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


@api_bp.route('/classes/<class_id>/archive', methods=['PUT'])
@login_required
@admin_required
def archive_class(class_id):
    """
    Update the status of a class (active/inactive) and handle archiving
    """
    try:
        # Get JSON data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Get status and archive note
        new_status = data.get('status')
        archive_note = data.get('archiveNote', '')
        
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400
            
        # Get the class
        class_obj = Class.query.get(class_id)
        if not class_obj:
            return jsonify({'error': f'Class with ID {class_id} not found'}), 404
            
        # Update status
        is_active = new_status.lower() == 'active'
        class_obj.is_active = is_active
        
        # If archiving (setting to inactive), set archive flag and note
        if not is_active:
            # Set archive flags and dates
            class_obj.is_archived = True
            class_obj.is_active = False
            
            # Update timestamps
            current_time = datetime.now()
            class_obj.updated_at = current_time
            class_obj.archive_date = current_time.date()
            
            # Store archive note if provided
            if archive_note:
                # Get admin name
                admin_name = f"{current_user.first_name} {current_user.last_name}"
                
                # Format note with ARCHIVE NOTE format for extraction by frontend
                # Make sure to use the exact format expected by the extractArchiveReason function
                formatted_note = f"ARCHIVE NOTE ({current_time.strftime('%Y-%m-%d')}): {archive_note}\nArchived by: {admin_name}"
                
                # If class already has notes, append to them
                if class_obj.notes:
                    class_obj.notes = f"{class_obj.notes}\n\n{formatted_note}"
                else:
                    # Create new notes
                    class_obj.notes = formatted_note
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Class status updated to {new_status}',
            'class_id': class_id,
            'status': new_status
        })
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to update class status: {str(e)}'}), 500

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

@api_bp.route('/classes/<string:class_id>/students', methods=['GET'])
@login_required
def get_class_students(class_id):
    """API endpoint to get students enrolled in a specific class"""
    try:
        # Verify the class exists
        class_obj = Class.query.get_or_404(class_id)
        
        # Get enrolled students for this class - use distinct to avoid duplicates
        students = db.session.query(User).distinct().join(
            Enrollment, User.id == Enrollment.student_id
        ).filter(
            Enrollment.class_id == class_id,
            User.role == 'Student',
            User.is_active == True,
            Enrollment.unenrollment_date.is_(None)  # Only active enrollments
        ).all()
        
        # Format the response
        result = []
        # Use a set to track student IDs we've already added
        processed_student_ids = set()
        
        for student in students:
            # Skip if we've already processed this student
            if student.id in processed_student_ids:
                continue
                
            processed_student_ids.add(student.id)
            result.append({
                'id': student.id,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'email': student.email,
                'profile_img': student.profile_img or 'profile.png'
            })
        
        return jsonify({
            'class_id': class_id,
            'class_name': class_obj.name,
            'students': result
        })
        
    except Exception as e:
        print(f"Error getting class students: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'students': []
        }), 500

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
        
        # Get optional date filters
        date = request.args.get('date')  # Single date filter
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
        if date:  # Single date filter takes precedence
            try:
                specific_date = datetime.strptime(date, '%Y-%m-%d').date()
                query = query.filter(Attendance.date == specific_date)
            except ValueError:
                pass
        else:  # Use date range if single date not provided
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
def save_attendance():
    # Check if user is authenticated and return JSON response if not
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
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
                
                try:
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
                    
                    # Try to flush each record individually to catch duplicates early
                    db.session.flush()
                    success_count += 1
                    
                except IntegrityError as e:
                    # Handle duplicate record
                    db.session.rollback()
                    print(f"Integrity error for student {record['student_id']}: {str(e)}")
                    error_count += 1
                    # Continue processing other records
                
            except Exception as e:
                print(f"Error processing attendance record: {str(e)}")
                error_count += 1
                
        try:
            # Commit all changes
            db.session.commit()
        except IntegrityError as e:
            # Handle unique constraint violation
            db.session.rollback()
            print(f"Integrity error when saving attendance: {str(e)}")
            
            return jsonify({
                'success': True,
                'message': 'Some attendance records already exist. Only new records were saved.',
                'duplicate': True,
                'records_processed': success_count,
                'errors': error_count
            })
        except Exception as e:
            # Handle other errors
            db.session.rollback()
            print(f"Error saving attendance: {str(e)}")
            return jsonify({
                'success': False,
                'message': f'Error saving attendance: {str(e)}',
                'records_processed': success_count,
                'errors': error_count
            }), 500
        
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
            User, Attendance.student_id == User.id
        ).outerjoin(
            Class, Attendance.class_id == Class.id
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
        
        # Check if the user is authorized to modify this record
        if current_user.role.lower() == 'instructor':
            # Instructors can only modify their own class records
            class_obj = Class.query.get(attendance.class_id)
            if not class_obj or class_obj.instructor_id != current_user.id:
                return jsonify({'success': False, 'message': 'You are not authorized to modify this attendance record'}), 403
        elif current_user.role.lower() != 'admin':
            # Only admins and instructors can modify attendance
            return jsonify({'success': False, 'message': 'You are not authorized to modify attendance records'}), 403
        
        # Update status if provided
        if 'status' in data:
            # Normalize status to match enum values (capitalize first letter)
            status_value = str(data['status']).strip().lower()
            
            if status_value == 'present':
                attendance.status = 'Present'
            elif status_value == 'absent':
                attendance.status = 'Absent'
            elif status_value == 'late':
                attendance.status = 'Late'
            else:
                # Default to Present if unknown
                attendance.status = 'Present'
                
        # Update comment if provided (handle both 'comment' and 'comments' keys)
        if 'comment' in data:
            attendance.comments = data['comment']
        elif 'comments' in data:
            attendance.comments = data['comments']
            
        # Update timestamp
        attendance.updated_at = datetime.utcnow()
        
        # Save changes
        db.session.commit()
        
        # Return updated record with standardized keys
        return jsonify({
            'success': True,
            'message': 'Attendance record updated successfully',
            'record': {
                'id': attendance.id,
                'date': attendance.date.strftime('%Y-%m-%d'),
                'status': attendance.status.lower(),  # Return lowercase for frontend consistency
                'student_id': attendance.student_id,
                'class_id': attendance.class_id,
                'comment': attendance.comments,
                'updated_at': attendance.updated_at.strftime('%Y-%m-%d %H:%M:%S') if attendance.updated_at else None
            }
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating attendance: {str(e)}")
        traceback.print_exc()
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
        
        # Check if current user is an admin
        if current_user.role.lower() != 'admin':
            return jsonify({'error': 'Only administrators can update class status'}), 403
            
        # Check if current user has limited access
        if hasattr(current_user, 'access_level') and current_user.access_level == 'limited':
            return jsonify({'error': 'Limited access accounts cannot change class status'}), 403
        
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
        
        elif folder == 'company':
            # Build the query for archived companies
            query = Company.query.filter(Company.is_archived == True)
            
            # Apply search if provided
            if search:
                query = query.filter(or_(
                    Company.name.ilike(f'%{search}%'),
                    Company.id.ilike(f'%{search}%'),
                    Company.contact.ilike(f'%{search}%'),
                    Company.email.ilike(f'%{search}%')
                ))
                
            # Count total for pagination
            total = query.count()
            
            # Get paginated results
            companies = query.order_by(Company.name).all() # Order by name
            
            # Format for response
            company_records = []
            for company in companies:
                # Format date if available
                archive_date = "Unknown"
                try:
                    if hasattr(company, 'archive_date') and company.archive_date:
                        archive_date = company.archive_date.strftime('%Y-%m-%d')
                except Exception:
                    pass
                
                # Add to results (send notes/description for reason extraction)
                company_records.append({
                    'company_id': company.id,
                    'name': company.name,
                    'contact': company.contact,
                    'email': company.email,
                    'archive_date': archive_date,
                    'notes': company.notes if hasattr(company, 'notes') else '',
                    'description': company.description if hasattr(company, 'description') else '' # Send description too if it exists
                })
                
            # Apply pagination
            result['records'] = company_records[start:end]
            result['total'] = total
            
        elif folder == 'class':
            # Build the query for archived classes
            query = Class.query.filter(Class.is_archived == True)
            
            # Apply search if provided
            if search:
                query = query.filter(or_(
                    Class.id.ilike(f'%{search}%'),
                    Class.name.ilike(f'%{search}%'),
                    Class.description.ilike(f'%{search}%')
                ))
                
            # Count total for pagination
            total = query.count()
            
            # Get paginated results
            classes = query.order_by(Class.id).all()
            
            # Format for response
            class_records = []
            for class_obj in classes:
                # Format date if available
                archive_date = "Unknown"
                try:
                    if hasattr(class_obj, 'archive_date') and class_obj.archive_date:
                        archive_date = class_obj.archive_date.strftime('%Y-%m-%d')
                except Exception:
                    pass
                
                # Get instructor information
                instructor_name = "Not Assigned"
                if hasattr(class_obj, 'instructor_id') and class_obj.instructor_id:
                    instructor = User.query.get(class_obj.instructor_id)
                    if instructor:
                        instructor_name = f"{instructor.first_name} {instructor.last_name}"
                
                # Format schedule for display
                day = class_obj.day_of_week if hasattr(class_obj, 'day_of_week') else ''
                
                # Format time properly
                start_time = ''
                end_time = ''
                if hasattr(class_obj, 'start_time') and class_obj.start_time:
                    try:
                        if isinstance(class_obj.start_time, str):
                            start_time = class_obj.start_time
                        else:
                            start_time = class_obj.start_time.strftime('%H:%M')
                    except Exception:
                        pass
                        
                if hasattr(class_obj, 'end_time') and class_obj.end_time:
                    try:
                        if isinstance(class_obj.end_time, str):
                            end_time = class_obj.end_time
                        else:
                            end_time = class_obj.end_time.strftime('%H:%M')
                    except Exception:
                        pass
                
                # Create schedule string
                schedule = f"{day} {start_time}-{end_time}" if day and (start_time or end_time) else 'Not scheduled'
                
                # We don't need to extract the archive reason here anymore
                # The frontend will handle the extraction and formatting
                # Just pass the raw notes to the frontend
                
                # Add to results
                class_records.append({
                    'id': class_obj.id,
                    'name': class_obj.name,
                    'instructor': instructor_name,
                    'schedule': schedule,
                    'year': class_obj.year if hasattr(class_obj, 'year') else 'N/A',
                    'archive_date': archive_date,
                    'notes': class_obj.notes if hasattr(class_obj, 'notes') else '',
                    'description': class_obj.description if hasattr(class_obj, 'description') else ''
                    # Removed archive_reason field - frontend will extract it from notes
                })
                
            # Apply pagination
            result['records'] = class_records[start:end]
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
            
            # Mark the company as active and not archived (Restore Logic)
            company.is_archived = False
            company.is_active = 'Active' # Restore to Active status
            
            # Remove the archive note
            if hasattr(company, 'notes') and company.notes and "ARCHIVE NOTE" in company.notes:
                # Split by the specific note format to remove it reliably
                note_parts = company.notes.split("ARCHIVE NOTE (")
                # Keep the part before the first archive note instance
                company.notes = note_parts[0].strip() if note_parts[0] else None 
            
            # Clear archive date if it exists (Optional but good practice)
            if hasattr(company, 'archive_date'):
                 company.archive_date = None

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
        
        elif folder == 'instructor':
            # Find the instructor
            instructor = User.query.get(record_id)
            if not instructor:
                return jsonify({'error': f'Instructor with ID {record_id} not found'}), 404
            
            # Check if instructor has classes
            instructor_classes = Class.query.filter_by(instructor_id=record_id).count()
            if instructor_classes > 0:
                return jsonify({
                    'error': f'Instructor has {instructor_classes} classes',
                    'details': 'Reassign all classes first'
                }), 400
                
            # Delete the instructor
            db.session.delete(instructor)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Instructor with ID {record_id} permanently deleted'
            })
        
        elif folder == 'company':
            # Find the company
            company = Company.query.get(record_id)
            if not company:
                return jsonify({'error': f'Company with ID {record_id} not found'}), 404

            # Check if company has associated users (students)
            associated_users = User.query.filter_by(company_id=record_id).count()
            if associated_users > 0:
                return jsonify({
                    'error': f'Company has {associated_users} associated user(s)',
                    'details': 'Cannot delete company with assigned users. Please reassign or archive users first.'
                }), 400

            # Delete the company
            db.session.delete(company)
            db.session.commit()

            return jsonify({
                'success': True,
                'message': f'Company {record_id} permanently deleted'
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

        else: # This is the path being hit when folder is 'company'
            return jsonify({'error': f'Invalid archive type: {folder}'}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete archived record: {str(e)}'}), 500

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
            
        elif folder == 'company':
            # Get archived companies
            query = Company.query.filter_by(is_archived=True)
            
            if search_term:
                query = query.filter(
                    or_(
                        Company.name.ilike(f'%{search_term}%'),
                        Company.contact_person.ilike(f'%{search_term}%'),
                        Company.email.ilike(f'%{search_term}%')
                    )
                )
                
            archived_companies = query.all()
            
            # Create CSV string
            writer.writerow(['Company', 'Contact Person', 'Email', 'Archived Date', 'Reason'])
            
            for company in archived_companies:
                # Extract archive reason if available
                archive_reason = 'Archived'
                if hasattr(company, 'notes') and company.notes and 'ARCHIVE NOTE' in company.notes:
                    match = re.search(r'ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(?:\n|$)', company.notes)
                    if match and match.group(1):
                        archive_reason = match.group(1).strip()
                
                # Format archive date
                archive_date = 'Unknown'
                if hasattr(company, 'archive_date') and company.archive_date:
                    try:
                        archive_date = company.archive_date.strftime('%Y-%m-%d')
                    except:
                        pass
                
                writer.writerow([
                    company.name,
                    company.contact or 'Not specified',  # Using the correct field name 'contact' instead of 'contact_person'
                    company.email or 'Not specified',
                    archive_date,
                    archive_reason
                ])
                
        elif folder == 'attendance':
            # Get archived attendance records
            query = Attendance.query.filter_by(is_archived=True)
            
            if search_term:
                # Join with Student and Class to allow searching by student or class name
                query = query.join(User, Attendance.student_id == User.id)\
                             .join(Class, Attendance.class_id == Class.id)\
                             .filter(
                                 or_(
                                     User.first_name.ilike(f'%{search_term}%'),
                                     User.last_name.ilike(f'%{search_term}%'),
                                     Class.name.ilike(f'%{search_term}%')
                                 )
                             )
                
            archived_attendance = query.all()
            
            # Create CSV string
            writer.writerow(['Student', 'Class', 'Date', 'Status', 'Archived Date', 'Reason'])
            
            for attendance in archived_attendance:
                # Get student name
                student_name = 'Unknown Student'
                if attendance.student_id:
                    student = User.query.get(attendance.student_id)
                    if student:
                        student_name = f"{student.first_name} {student.last_name}"
                
                # Get class name
                class_name = 'Unknown Class'
                if attendance.class_id:
                    class_obj = Class.query.get(attendance.class_id)
                    if class_obj:
                        class_name = class_obj.name
                
                # Extract archive reason if available
                archive_reason = 'Archived'
                if hasattr(attendance, 'comment') and attendance.comment and 'ARCHIVE NOTE' in attendance.comment:
                    match = re.search(r'ARCHIVE NOTE \(\d{4}-\d{2}-\d{2}\): (.+?)(?:\n|$)', attendance.comment)
                    if match and match.group(1):
                        archive_reason = match.group(1).strip()
                
                # Format archive date
                archive_date = 'Unknown'
                if hasattr(attendance, 'archive_date') and attendance.archive_date:
                    try:
                        archive_date = attendance.archive_date.strftime('%Y-%m-%d')
                    except:
                        pass
                
                # Format attendance date
                attendance_date = 'Unknown'
                if attendance.date:
                    try:
                        attendance_date = attendance.date.strftime('%Y-%m-%d')
                    except:
                        pass
                
                writer.writerow([
                    student_name,
                    class_name,
                    attendance_date,
                    attendance.status or 'Unknown',
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
            
        # Count companies - checking is_archived field
        try:
            # Correctly filter by the is_archived flag
            result['counts']['company'] = Company.query.filter(Company.is_archived == True).count()
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
                
                if class_obj and class_obj.instructor_id:
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
def get_attendance_report():
    """
    Get attendance records with filters
    Filters:
    - class_id: Filter by class
    - instructor_id: Filter by instructor
    - student_name: Filter by student name
    - date_start: Filter from this date
    - date_end: Filter to this date
    - status: Filter by status
    - page: Page number for pagination
    - per_page: Records per page
    """
    try:
        # Get query parameters
        class_id = request.args.get('class_id')
        instructor_id = request.args.get('instructor_id')
        student_name = request.args.get('student_name')
        date_start = request.args.get('date_start')
        date_end = request.args.get('end_date')
        status = request.args.get('status')
        record_id = request.args.get('id')  # For fetching a specific record
        exclude_archived = request.args.get('exclude_archived', 'true').lower() == 'true'
        is_admin = request.args.get('admin', 'false').lower() == 'true'
        
        # Pagination parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        
        # Start the query
        query = db.session.query(
            Attendance,
            User.first_name.label('student_first_name'),
            User.last_name.label('student_last_name'),
            User.id.label('student_id'),
            User.profile_img.label('student_profile_img'),
            Class.name.label('class_name'),
            Class.id.label('class_id')
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        )
        
        # Get instructor information through a separate join
        instructor_alias = aliased(User)
        query = query.outerjoin(
            instructor_alias, Class.instructor_id == instructor_alias.id
        ).add_columns(
            instructor_alias.first_name.label('instructor_first_name'),
            instructor_alias.last_name.label('instructor_last_name'),
            instructor_alias.id.label('instructor_id')
        )
        
        # Apply filters for archived status
        if exclude_archived:
            query = query.filter(Attendance.is_archived == False)
        
        # Direct record lookup
        if record_id:
            query = query.filter(Attendance.id == record_id)
        
        # Apply other filters
        if class_id:
            query = query.filter(Attendance.class_id == class_id)
        
        if instructor_id:
            query = query.filter(Class.instructor_id == instructor_id)
        
        if student_name:
            query = query.filter(
                or_(
                    User.first_name.like(f'%{student_name}%'),
                    User.last_name.like(f'%{student_name}%')
                )
            )
        
        if status:
            query = query.filter(Attendance.status.ilike(status))
        
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
        
        # Restrict instructors to only see their classes
        if current_user.role.lower() == 'instructor' and not is_admin:
            query = query.filter(Class.instructor_id == current_user.id)
        
        # Get total count before pagination
        total_count = query.count()
        
        # Apply sorting
        query = query.order_by(Attendance.date.desc())
        
        # Apply pagination if this is not a direct record lookup
        if not record_id:
            query = query.offset((page - 1) * per_page).limit(per_page)
        
        # Execute query
        results = query.all()
        
        # Format results
        records = []
        for record in results:
            attendance = record[0]  # Attendance object
            
            # Get student information
            student_name = f"{record.student_first_name} {record.student_last_name}"
            
            # Get instructor information
            instructor_name = ""
            if record.instructor_first_name and record.instructor_last_name:
                instructor_name = f"{record.instructor_first_name} {record.instructor_last_name}"
            
            # Format attendance record
            attendance_record = {
                'id': attendance.id,
                'student_id': record.student_id,
                'student_name': student_name,
                'student_profile_img': record.student_profile_img,
                'class_id': record.class_id,
                'class_name': record.class_name,
                'instructor_id': record.instructor_id,
                'instructor_name': instructor_name,
                'date': attendance.date.strftime('%Y-%m-%d'),
                'status': attendance.status.lower(),
                'comment': attendance.comments,
                'is_archived': attendance.is_archived
            }
            
            records.append(attendance_record)
        
        # Calculate statistics for the filtered data
        status_counts = {
            'present': 0,
            'absent': 0,
            'late': 0,
            'total': total_count
        }
        
        # Log the total count for debugging
        print(f"Total attendance records matching filters: {total_count}")
        
        # -------------------------------------------------------------
        # Create a SQL query directly to avoid ORM overhead for counting
        # -------------------------------------------------------------
        try:
            from sqlalchemy import text
            
            # Build the WHERE clause for our SQL based on the filters
            where_clauses = []
            params = {}
            
            if exclude_archived:
                where_clauses.append("a.is_archived = 0")
            
            if class_id:
                where_clauses.append("a.class_id = :class_id")
                params['class_id'] = class_id
            
            if instructor_id:
                where_clauses.append("c.instructor_id = :instructor_id")
                params['instructor_id'] = instructor_id
            
            if student_name:
                where_clauses.append("(u.first_name LIKE :student_name OR u.last_name LIKE :student_name)")
                params['student_name'] = f"%{student_name}%"
            
            if date_start:
                try:
                    start_date = datetime.strptime(date_start, '%Y-%m-%d').date()
                    where_clauses.append("a.date >= :date_start")
                    params['date_start'] = start_date
                except ValueError:
                    pass
            
            if date_end:
                try:
                    end_date = datetime.strptime(date_end, '%Y-%m-%d').date()
                    where_clauses.append("a.date <= :date_end")
                    params['date_end'] = end_date
                except ValueError:
                    pass
            
            if current_user.role.lower() == 'instructor' and not is_admin:
                where_clauses.append("c.instructor_id = :current_user_id")
                params['current_user_id'] = current_user.id
            
            # Build the complete WHERE clause
            where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
            
            # Build the SQL for counting each status
            sql = f"""
            SELECT 
                CASE 
                    WHEN UPPER(a.status) = 'PRESENT' THEN 'present'
                    WHEN UPPER(a.status) = 'ABSENT' THEN 'absent'
                    WHEN UPPER(a.status) = 'LATE' THEN 'late'
                    ELSE 'other'
                END as normalized_status,
                COUNT(*) as count
            FROM 
                attendance a
                JOIN user u ON a.student_id = u.id
                JOIN class c ON a.class_id = c.id
            WHERE 
                {where_sql}
            GROUP BY 
                normalized_status
            """
            
            # Execute the query and get the results
            result = db.session.execute(text(sql), params)
            
            # Process the results
            for row in result:
                normalized_status = row[0].lower() if row[0] else None
                count = row[1] or 0
                
                # Use lowercase comparison for case-insensitive matching
                if normalized_status and normalized_status.lower() == 'present':
                    status_counts['present'] = count
                elif normalized_status and normalized_status.lower() == 'absent':
                    status_counts['absent'] = count
                elif normalized_status and normalized_status.lower() == 'late':
                    status_counts['late'] = count
            
            # Check if specific status filter is applied
            if status:
                status_key = status.lower()
                if status_key in ['present', 'absent', 'late']:
                    if status_counts[status_key] == 0:
                        # If we have a count from total but our status count is 0, 
                        # that means the records might not be in the exact case we're checking
                        status_counts[status_key] = total_count
            
            # Verify our counts add up to the total
            calculated_total = status_counts['present'] + status_counts['absent'] + status_counts['late']
            
            # If the calculated total doesn't match and we have records, adjust the total
            if calculated_total != total_count and calculated_total > 0:
                print(f"Stats don't add up: calculated={calculated_total}, total={total_count}")
                if not status:  # Only adjust if not filtering by status
                    status_counts['total'] = calculated_total
            
            # If we still have 0 for all statuses but records exist, try to count from the records
            if calculated_total == 0 and total_count > 0:
                print("Warning: All status counts are 0 despite having records. Counting from paginated results.")
                
                # Count directly from the results we have
                for record in results:
                    attendance = record[0]
                    if attendance and attendance.status:
                        normalized_status = attendance.status.lower()
                        if normalized_status == 'present':
                            status_counts['present'] += 1
                        elif normalized_status == 'absent': 
                            status_counts['absent'] += 1
                        elif normalized_status == 'late':
                            status_counts['late'] += 1
                
                # If we found some counts and we're using pagination, adjust the total counts proportionally
                status_sum = status_counts['present'] + status_counts['absent'] + status_counts['late']
                if status_sum > 0 and len(results) < total_count:
                    ratio = total_count / len(results)
                    status_counts['present'] = int(status_counts['present'] * ratio)
                    status_counts['absent'] = int(status_counts['absent'] * ratio)
                    status_counts['late'] = int(status_counts['late'] * ratio)
            
        except Exception as e:
            print(f"Error calculating SQL-based stats: {str(e)}")
            traceback.print_exc()
        
        # Prepare response
        response = {
            'records': records,
            'total_records': total_count,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_pages': math.ceil(total_count / per_page) if per_page > 0 else 0
            },
            'stats': status_counts
        }
        
        # For direct record lookup, use a simplified response
        if record_id:
            response = {
                'records': records,
                'success': True
            }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error retrieving attendance records: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

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
        print("\n=== Starting get_archived_attendance API call ===")
        # Get query parameters
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 5))
        
        # Start with base query for archived attendance records
        query = db.session.query(
            Attendance,
            User.first_name.label('student_first_name'),
            User.last_name.label('student_last_name'),
            User.id.label('student_id'),
            User.profile_img.label('student_profile_img'),
            Class.name.label('class_name'),
            Class.id.label('class_id')
        ).join(
            User, Attendance.student_id == User.id
        ).join(
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
        print(f"Attendance archive query: start_idx={start_idx}, per_page={per_page}")
        
        # Simplify the query to directly get archived attendance records
        archived_attendance = Attendance.query.filter_by(is_archived=True).all()
        print(f"Found {len(archived_attendance)} archived attendance records directly from Attendance model")
        
        # Format these records manually
        formatted_records = []
        for attendance in archived_attendance:
            try:
                # Get student info
                student = User.query.get(attendance.student_id)
                student_name = f"{student.first_name} {student.last_name}" if student else "Unknown Student"
                student_profile = student.profile_img if student and hasattr(student, 'profile_img') else 'profile.png'
                
                # Get class info
                class_obj = Class.query.get(attendance.class_id)
                class_name = class_obj.name if class_obj else "Unknown Class"
                
                # Extract archive reason from comments
                archive_reason = "Archived"
                if attendance.comments and "ARCHIVED" in attendance.comments:
                    import re
                    match = re.search(r'ARCHIVED \(.*?\): ([^\n]+)', attendance.comments)
                    if match:
                        archive_reason = match.group(1).strip()
                
                # Format date
                formatted_date = attendance.date.strftime('%Y-%m-%d') if attendance.date else 'Unknown'
                formatted_archive_date = attendance.updated_at.strftime('%Y-%m-%d') if attendance.updated_at else 'Unknown'
                
                # Add to results
                formatted_records.append({
                    'id': attendance.id,
                    'student_id': attendance.student_id,
                    'student_name': student_name,
                    'student_profile_img': student_profile,
                    'class_id': attendance.class_id,
                    'class_name': class_name,
                    'date': formatted_date,
                    'status': attendance.status,
                    'archive_date': formatted_archive_date,
                    'archive_reason': archive_reason,
                    'comments': attendance.comments or ""
                })
                print(f"Added record ID {attendance.id} for student {student_name}")
            except Exception as e:
                print(f"Error formatting attendance record {attendance.id}: {e}")
        
        # Apply pagination to the formatted records
        total_records = len(formatted_records)
        paginated_records = formatted_records[start_idx:start_idx + per_page]
        
        # Return the paginated records
        print(f"Returning {len(paginated_records)} records out of {total_records} total")
        
        # Count all archive types for stats
        try:
            student_count = User.query.filter_by(is_archived=True, role='Student').count()
            instructor_count = User.query.filter_by(is_archived=True, role='Instructor').count()
            class_count = Class.query.filter_by(is_archived=True).count()
            company_count = Company.query.filter_by(is_archived=True).count()
            admin_count = User.query.filter_by(is_archived=True, role='Admin').count()
            attendance_count = Attendance.query.filter_by(is_archived=True).count()
        except Exception as e:
            print(f"Error getting archive counts: {e}")
            student_count = instructor_count = class_count = company_count = admin_count = attendance_count = 0
                
        # Return the response with paginated records and counts
        return jsonify({
            'records': paginated_records,
            'total': total_records,
            'counts': {
                'student': student_count,
                'instructor': instructor_count,
                'class': class_count,
                'company': company_count,
                'admin': admin_count,
                'attendance': attendance_count
            }
        })
        
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

        # Check if current user has limited access
        if hasattr(current_user, 'access_level') and current_user.access_level == 'limited':
            return jsonify({'error': 'Limited access accounts cannot archive users'}), 403
        
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
        
        # Check if current user has limited access
        if hasattr(current_user, 'access_level') and current_user.access_level == 'limited':
            return jsonify({'error': 'Limited access accounts cannot change user status'}), 403
        
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

@api_bp.route('/users', methods=['POST'])
@login_required
@admin_required
def create_user():
    """API endpoint to create a new user"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['firstName', 'lastName', 'email', 'userId', 'userRole']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Check if user ID already exists
        if User.query.get(data['userId']):
            return jsonify({'error': 'User ID already exists'}), 400
        
        # Check if email already exists
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
            
        # Map role prefixes to role names
        role_map = {
            'bh': 'admin',  # Changed from 'Administrator' to 'admin'
            'ak': 'instructor',  # Changed from 'Instructor' to 'instructor'
            'st': 'student'  # Changed from 'Student' to 'student'
        }
        
        # Generate a secure password (should be changed by user later)
        import secrets
        import string
        password_chars = string.ascii_letters + string.digits + string.punctuation
        temp_password = ''.join(secrets.choice(password_chars) for _ in range(12))
        
        # Hash the password
        from werkzeug.security import generate_password_hash
        hashed_password = generate_password_hash(temp_password)
        
        # Create username from first name and last name
        username = f"{data['firstName'].lower()}.{data['lastName'].lower()}"
        
        # Check for existing username and append numbers if needed
        base_username = username
        counter = 1
        while User.query.filter_by(username=username).first():
            username = f"{base_username}{counter}"
            counter += 1
        
        # Parse date of birth if provided
        date_of_birth = None
        if 'dateOfBirth' in data and data['dateOfBirth']:
            from datetime import datetime
            try:
                date_of_birth = datetime.strptime(data['dateOfBirth'], '%Y-%m-%d').date()
            except ValueError:
                pass
        
        # Create new user
        new_user = User(
            id=data['userId'],
            username=username,
            email=data['email'],
            password=hashed_password,
            first_name=data['firstName'],
            last_name=data['lastName'],
            role=role_map.get(data['userRole'], 'Student'),
            is_active=True,
            date_of_birth=date_of_birth,
            profile_img='profile.png'
        )
        
        # Add instructor-specific fields
        if data['userRole'] == 'ak':
            if 'department' in data and data['department']:
                new_user.department = data['department']
            if 'qualification' in data and data['qualification']:
                new_user.qualification = data['qualification']
            if 'specialization' in data and data['specialization']:
                new_user.specialization = data['specialization']
        
        # Add admin-specific fields
        if data['userRole'] == 'bh':
            if 'accessLevel' in data and data['accessLevel']:
                new_user.access_level = data['accessLevel']
        
        # Add company ID for students
        if data['userRole'] == 'st' and 'companyId' in data and data['companyId']:
            new_user.company_id = data['companyId']
        
        # Save to database
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user': {
                'id': new_user.id,
                'first_name': new_user.first_name,
                'last_name': new_user.last_name,
                'email': new_user.email,
                'role': new_user.role,
                'username': new_user.username,
                'temp_password': temp_password  # Only return this during development
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error creating user: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Failed to create user: {str(e)}'}), 500

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

@api_bp.route('/companies/export', methods=['GET'])
@login_required
def export_companies_csv():
    """API endpoint to export companies to CSV based on filters."""
    try:
        status_filter = request.args.get('status') # Active, Inactive, Archived, All (or empty)
        search = request.args.get('search', '').strip()

        # Base query - Start with Company model
        query = Company.query

        # Apply filters similar to get_companies_direct, but using ORM
        if status_filter == 'Active':
            query = query.filter(Company.is_active == 'Active', Company.is_archived == False)
        elif status_filter == 'Inactive':
            query = query.filter(Company.is_active == 'Inactive', Company.is_archived == False)
        elif status_filter == 'Archived':
            query = query.filter(Company.is_archived == True)
        else: # 'All' or empty filter - show only non-archived
            query = query.filter(Company.is_archived == False)

        # Apply search filter
        if search:
            search_term = f'%{search}%'
            query = query.filter(or_(
                Company.name.ilike(search_term),
                Company.id.ilike(search_term),
                Company.contact.ilike(search_term),
                Company.email.ilike(search_term)
            ))

        companies = query.order_by(Company.name).all()

        # --- Generate CSV --- 
        output = StringIO()
        writer = csv.writer(output)

        # Write Header
        writer.writerow(['Company ID', 'Company Name', 'Contact Person', 'Contact Email', 'Status'])

        # Write Data Rows
        for company in companies:
            writer.writerow([
                company.id,
                company.name,
                company.contact,
                company.email,
                'Archived' if company.is_archived else company.is_active # Show Archived if applicable
            ])
        
        output.seek(0)

        # Create Flask Response
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=companies_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )

    except Exception as e:
        print(f"Error exporting companies: {str(e)}")
        traceback.print_exc()
        # Return an error response, maybe redirect back or show an error page?
        # For API consistency, returning JSON error might be better than redirecting.
        return jsonify({'error': 'Failed to generate company export.'}), 500

# Endpoint to count companies based on filters (for export confirmation)
@api_bp.route('/companies/export/count', methods=['GET'])
@login_required
def count_companies_for_export():
    """Counts companies matching the given filters, without generating the CSV."""
    try:
        status_filter = request.args.get('status')
        search = request.args.get('search', '').strip()

        query = Company.query

        if status_filter == 'Active':
            query = query.filter(Company.is_active == 'Active', Company.is_archived == False)
        elif status_filter == 'Inactive':
            query = query.filter(Company.is_active == 'Inactive', Company.is_archived == False)
        elif status_filter == 'Archived':
            query = query.filter(Company.is_archived == True)
        else: # 'All' or empty filter
            query = query.filter(Company.is_archived == False)

        if search:
            search_term = f'%{search}%'
            query = query.filter(or_(
                Company.name.ilike(search_term),
                Company.id.ilike(search_term),
                Company.contact.ilike(search_term),
                Company.email.ilike(search_term)
            ))

        count = query.count()
        return jsonify({'success': True, 'count': count})

    except Exception as e:
        print(f"Error counting companies for export: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to count companies.'}), 500

# Endpoint to count users based on filters (for export confirmation)
@api_bp.route('/users/export/count', methods=['GET'])
@login_required
def count_users_for_export():
    """Counts users matching the given filters, without generating the CSV."""
    try:
        role_filter = request.args.get('role', '')
        status_filter = request.args.get('status', '')
        search = request.args.get('search', '').strip()

        query = User.query.filter_by(is_archived=False)

        if role_filter:
            query = query.filter(User.role.ilike(f'%{role_filter}%')) # Use ilike for flexibility
        
        if status_filter:
            is_active = status_filter.lower() == 'active'
            query = query.filter(User.is_active == is_active)
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(or_(
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term),
                User.email.ilike(search_term),
                User.id.ilike(search_term)
            ))

        count = query.count()
        return jsonify({'success': True, 'count': count})

    except Exception as e:
        print(f"Error counting users for export: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to count users.'}), 500

# Endpoint to export users to CSV
@api_bp.route('/users/export', methods=['GET'])
@login_required
def export_users_csv():
    """API endpoint to export users to CSV based on filters."""
    try:
        role_filter = request.args.get('role', '')
        status_filter = request.args.get('status', '')
        search = request.args.get('search', '').strip()

        query = User.query.filter_by(is_archived=False)

        if role_filter:
            query = query.filter(User.role.ilike(f'%{role_filter}%'))
        
        if status_filter:
            is_active = status_filter.lower() == 'active'
            query = query.filter(User.is_active == is_active)
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(or_(
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term),
                User.email.ilike(search_term),
                User.id.ilike(search_term)
            ))

        users = query.order_by(User.last_name, User.first_name).all()

        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(['User ID', 'First Name', 'Last Name', 'Email', 'Role', 'Status'])

        for user in users:
            writer.writerow([
                user.id,
                user.first_name,
                user.last_name,
                user.email,
                user.role,
                'Active' if user.is_active else 'Inactive'
            ])
        
        output.seek(0)

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )

    except Exception as e:
        print(f"Error exporting users: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': 'Failed to generate user export.'}), 500

@api_bp.route('/students/<string:student_id>/attendance', methods=['GET'])
@login_required
def get_student_attendance(student_id):
    """API endpoint to get attendance records for a specific student"""
    try:
        # Verify the student exists
        student = User.query.get_or_404(student_id)
        
        # Check if student role is correct
        if student.role.lower() != 'student':
            return jsonify({'error': 'Requested ID is not a student'}), 400
        
        # Get optional date filters
        date = request.args.get('date')  # Single date filter
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Build query for attendance records with related data
        query = db.session.query(
            Attendance,
            Class.name.label('class_name'),
            Class.start_time.label('class_time'),
            User.first_name.label('instructor_first_name'),
            User.last_name.label('instructor_last_name')
        ).join(
            Class, Attendance.class_id == Class.id
        ).outerjoin(  # Use outer join in case instructor is not assigned
            User, Class.instructor_id == User.id
        ).filter(
            Attendance.student_id == student_id
        )
        
        # Apply date filters if provided
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                query = query.filter(Attendance.date >= start)
            except ValueError:
                return jsonify({'error': 'Invalid start date format. Use YYYY-MM-DD.'}), 400
                
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                query = query.filter(Attendance.date <= end)
            except ValueError:
                return jsonify({'error': 'Invalid end date format. Use YYYY-MM-DD.'}), 400
        
        # Execute the query and order by date (most recent first)
        attendance_records = query.order_by(Attendance.date.desc()).all()
        
        # Format the response
        result = []
        for record in attendance_records:
            attendance, class_name, class_time, instructor_first_name, instructor_last_name = record
            
            # Format the time string for display
            time_str = class_time.strftime('%H:%M') if class_time else 'N/A'
            
            # Format instructor name
            instructor = 'N/A'
            if instructor_first_name and instructor_last_name:
                instructor = f"{instructor_first_name} {instructor_last_name}"
            
            result.append({
                'id': attendance.id,
                'date': attendance.date.strftime('%Y-%m-%d') if attendance.date else 'N/A',
                'status': attendance.status,
                'class_id': attendance.class_id,
                'class_name': class_name or 'Unknown',
                'time': time_str,
                'instructor': instructor,
                'comments': attendance.comments
            })
        
        # Calculate some basic statistics
        total_records = len(result)
        present_count = sum(1 for r in result if r['status'].lower() == 'present')
        absent_count = sum(1 for r in result if r['status'].lower() == 'absent')
        late_count = sum(1 for r in result if r['status'].lower() == 'late')
        
        # Calculate attendance rate
        attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0
        
        # Return the formatted response with statistics
        response = {
            'records': result,
            'stats': {
                'total': total_records,
                'present': present_count,
                'absent': absent_count,
                'late': late_count,
                'attendance_rate': round(attendance_rate, 1)
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error fetching student attendance: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/attendance/export', methods=['GET'])
@login_required
@admin_or_instructor_required
def export_attendance_csv():
    """API endpoint to export attendance records to CSV"""
    try:
        # Get query parameters for filtering
        class_id = request.args.get('class_id')
        student_name = request.args.get('student_name')
        instructor_id = request.args.get('instructor_id')
        status = request.args.get('status')
        date_start = request.args.get('date_start')
        date_end = request.args.get('end_date')
        exclude_archived = request.args.get('exclude_archived', 'true').lower() == 'true'
        
        # Start the query
        query = db.session.query(
            Attendance,
            User.first_name.label('student_first_name'),
            User.last_name.label('student_last_name'),
            Class.name.label('class_name'),
            User.id.label('student_id')
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        )
        
        # Get instructor information through a separate join
        instructor_alias = aliased(User)
        query = query.outerjoin(
            instructor_alias, Class.instructor_id == instructor_alias.id
        ).add_columns(
            instructor_alias.first_name.label('instructor_first_name'),
            instructor_alias.last_name.label('instructor_last_name')
        )
        
        # Apply filters for archived status
        if exclude_archived:
            query = query.filter(Attendance.is_archived == False)
        
        # Apply other filters
        if class_id:
            query = query.filter(Attendance.class_id == class_id)
        
        if student_name:
            query = query.filter(
                or_(
                    User.first_name.like(f'%{student_name}%'),
                    User.last_name.like(f'%{student_name}%')
                )
            )
        
        if instructor_id:
            query = query.filter(Class.instructor_id == instructor_id)
        
        if status:
            query = query.filter(Attendance.status == status)
        
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
        
        # Restrict instructors to only see their classes
        if current_user.role == 'instructor':
            query = query.filter(Class.instructor_id == current_user.id)
        
        # Execute query
        results = query.order_by(Attendance.date.desc()).all()
        
        # Create CSV file in memory
        output = StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow([
            'Date', 'Student ID', 'Student Name', 'Class', 'Instructor', 
            'Status', 'Comments', 'Last Updated'
        ])
        
        # Write data
        for record in results:
            attendance = record[0]  # Attendance object
            student_first_name = record.student_first_name
            student_last_name = record.student_last_name
            class_name = record.class_name
            instructor_first_name = record.instructor_first_name or ''
            instructor_last_name = record.instructor_last_name or ''
            
            # Format the date
            date_formatted = attendance.date.strftime('%Y-%m-%d') if attendance.date else ''
            
            # Format full names
            student_name = f"{student_first_name} {student_last_name}"
            instructor_name = f"{instructor_first_name} {instructor_last_name}".strip()
            if not instructor_name:
                instructor_name = "Not Assigned"
            
            # Format last updated
            last_updated = attendance.updated_at.strftime('%Y-%m-%d %H:%M') if attendance.updated_at else ''
            
            writer.writerow([
                date_formatted,
                record.student_id,
                student_name,
                class_name,
                instructor_name,
                attendance.status,
                attendance.comments or '',
                last_updated
            ])
        
        # Create response with CSV file
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = f'attachment; filename=attendance_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        
        return response
    except Exception as e:
        print(f"Error exporting attendance CSV: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/attendance/stats', methods=['GET'])
@login_required
@admin_or_instructor_required
def get_attendance_stats():
    """API endpoint to get attendance data for reports with statistics"""
    try:
        # Get filter parameters
        class_id = request.args.get('class_id')
        student_id = request.args.get('student_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        status_filter = request.args.get('status')
        
        # Build base query
        query = db.session.query(
            Attendance,
            User.id.label('student_id'),
            User.first_name.label('student_first_name'),
            User.last_name.label('student_last_name'),
            Class.name.label('class_name')
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
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
                pass
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
                query = query.filter(Attendance.date <= to_date)
            except ValueError:
                pass
        
        if status_filter:
            statuses = status_filter.split(',')
            query = query.filter(Attendance.status.in_(statuses))
        
        # Restrict instructors to only see their classes
        if current_user.role == 'instructor':
            query = query.filter(Class.instructor_id == current_user.id)
        
        # Execute query
        results = query.order_by(Attendance.date.desc()).all()
        
        # Format attendance records
        attendance_records = []
        
        # Track status counts for accurate statistics
        status_counts = {
            'present': 0,
            'absent': 0,
            'late': 0,
            'total': len(results)
        }
        
        for record in results:
            attendance = record[0]  # Attendance object
            
            # Count by status for statistics
            normalized_status = attendance.status.lower()
            if normalized_status == 'present':
                status_counts['present'] += 1
            elif normalized_status == 'absent':
                status_counts['absent'] += 1
            elif normalized_status == 'late':
                status_counts['late'] += 1
            
            attendance_records.append({
                'id': attendance.id,
                'date': attendance.date.isoformat() if attendance.date else None,
                'studentId': record.student_id,
                'studentName': f"{record.student_first_name} {record.student_last_name}",
                'className': record.class_name,
                'status': attendance.status,
                'comments': attendance.comments
            })
        
        # Get unique students and classes for additional statistics
        unique_students = set(record['studentId'] for record in attendance_records)
        total_students = len(unique_students)
        
        unique_classes = set(record['className'] for record in attendance_records)
        active_classes = len(unique_classes)
        
        # Calculate attendance rate from our counted data
        attendance_rate = 0
        if status_counts['total'] > 0:
            attendance_rate = (status_counts['present'] / status_counts['total']) * 100
        
        # Get total enrollments from database
        total_enrollments = db.session.query(Enrollment).count()
        
        # Compile all statistics
        stats = {
            'totalStudents': total_students,
            'activeClasses': active_classes,
            'attendanceRate': attendance_rate,
            'totalEnrollments': total_enrollments,
            'present': status_counts['present'],
            'absent': status_counts['absent'],
            'late': status_counts['late'],
            'total': status_counts['total']
        }
        
        return jsonify({
            'attendance': attendance_records,
            'stats': stats
        })
    except Exception as e:
        print(f"Error fetching attendance report: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/attendance/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify API routing"""
    return jsonify({
        'status': 'success',
        'message': 'API test endpoint is working',
        'python_version': sys.version
    })

@api_bp.route('/attendance/report', methods=['GET'])
@login_required
def get_admin_attendance_list():
    """API endpoint to get attendance records with filtering for admin view"""
    try:
        print("API endpoint /attendance/report accessed")
        # Check if user is admin
        if not hasattr(current_user, 'role') or current_user.role.lower() != 'admin':
            print("User is not admin, returning 403")
            return jsonify({'error': 'Unauthorized access'}), 403
            
        # Get filter parameters
        class_id = request.args.get('class_id', '')
        instructor_id = request.args.get('instructor_id', '')
        student = request.args.get('student', '')
        status_filter = request.args.get('status', '')
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        # Build query for attendance records
        query = db.session.query(
            Attendance,
            User.first_name.label('student_first_name'),
            User.last_name.label('student_last_name'),
            User.profile_img.label('student_profile_img'),
            User.id.label('student_id'),
            Class.name.label('class_name'),
            Class.id.label('class_id'),
            Class.instructor_id
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        )
        
        # Apply student role filter
        query = query.filter(or_(User.role == 'Student', User.role == 'student'))
        
        # Filter out archived records
        query = query.filter(or_(Attendance.is_archived == False, Attendance.is_archived == None))
        
        # Apply class filter if provided
        if class_id:
            query = query.filter(Class.id == class_id)
        
        # Apply instructor filter if provided
        if instructor_id:
            query = query.filter(Class.instructor_id == instructor_id)
        
        # Apply status filter if provided
        if status_filter:
            query = query.filter(Attendance.status == status_filter)
        
        # Apply student name filter if provided
        if student:
            query = query.filter(
                or_(
                    User.first_name.like(f'%{student}%'),
                    User.last_name.like(f'%{student}%'),
                    User.id.like(f'%{student}%')
                )
            )
        
        # Apply date filters if provided
        if start_date:
            try:
                from_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                query = query.filter(Attendance.date >= from_date)
            except ValueError:
                pass
        
        if end_date:
            try:
                to_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                query = query.filter(Attendance.date <= to_date)
            except ValueError:
                pass
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        query = query.order_by(Attendance.date.desc())
        query = query.offset((page - 1) * per_page).limit(per_page)
        
        # Execute query
        results = query.all()
        
        # Format attendance records
        records = []
        
        # Get instructor names for display
        instructor_ids = set()
        for result in results:
            if result.instructor_id:
                instructor_ids.add(result.instructor_id)
        
        instructor_names = {}
        if instructor_ids:
            instructors = User.query.filter(User.id.in_(instructor_ids)).all()
            for instructor in instructors:
                instructor_names[instructor.id] = f"{instructor.first_name} {instructor.last_name}"
        
        # Process results
        for result in results:
            attendance = result[0]  # Attendance object
            
            # Get instructor name
            instructor_name = instructor_names.get(result.instructor_id, 'N/A')
            
            # Format record
            records.append({
                'id': attendance.id,
                'date': attendance.date.strftime('%Y-%m-%d') if attendance.date else None,
                'student_id': result.student_id,
                'student_name': f"{result.student_first_name} {result.student_last_name}",
                'student_profile_img': result.student_profile_img,
                'class_id': result.class_id,
                'class_name': result.class_name,
                'instructor_id': result.instructor_id,
                'instructor_name': instructor_name,
                'status': attendance.status,
                'comment': attendance.comments
            })
        
        # Calculate statistics
        stats_query = db.session.query(
            Attendance.status, func.count(Attendance.id)
        ).group_by(Attendance.status)
        
        # Apply the same filters as the main query
        if class_id:
            stats_query = stats_query.filter(Attendance.class_id == class_id)
        
        # Join with User and Class for other filters
        stats_query = stats_query.join(User, Attendance.student_id == User.id)
        stats_query = stats_query.join(Class, Attendance.class_id == Class.id)
        
        if instructor_id:
            stats_query = stats_query.filter(Class.instructor_id == instructor_id)
        
        if student:
            stats_query = stats_query.filter(
                or_(
                    User.first_name.like(f'%{student}%'),
                    User.last_name.like(f'%{student}%'),
                    User.id.like(f'%{student}%')
                )
            )
        
        if start_date:
            try:
                from_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                stats_query = stats_query.filter(Attendance.date >= from_date)
            except ValueError:
                pass
        
        if end_date:
            try:
                to_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                stats_query = stats_query.filter(Attendance.date <= to_date)
            except ValueError:
                pass
        
        # Get the status counts
        status_counts = stats_query.all()
        
        # Initialize stats
        stats = {
            'present': 0,
            'absent': 0,
            'late': 0,
            'total': total_count
        }
        
        # Update stats with the actual counts
        for status, count in status_counts:
            normalized_status = status.lower() if status else 'unknown'
            if normalized_status == 'present':
                stats['present'] = count
            elif normalized_status == 'absent':
                stats['absent'] = count
            elif normalized_status == 'late':
                stats['late'] = count
        
        # Return formatted response
        return jsonify({
            'records': records,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total_count,
                'pages': math.ceil(total_count / per_page) if per_page > 0 else 0
            },
            'stats': stats
        })
    except Exception as e:
        print(f"Error fetching attendance report: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/attendance/report/<string:record_id>', methods=['GET'])
@login_required
def get_admin_attendance_record(record_id):
    """API endpoint to get a single attendance record by ID for admin view"""
    try:
        # Check if user is admin
        if not hasattr(current_user, 'role') or current_user.role.lower() != 'admin':
            return jsonify({'error': 'Unauthorized access'}), 403
            
        # Query for the attendance record with related data
        result = db.session.query(
            Attendance,
            User.first_name.label('student_first_name'),
            User.last_name.label('student_last_name'),
            User.profile_img.label('student_profile_img'),
            User.id.label('student_id'),
            Class.name.label('class_name'),
            Class.id.label('class_id'),
            Class.instructor_id
        ).join(
            User, Attendance.student_id == User.id
        ).join(
            Class, Attendance.class_id == Class.id
        ).filter(
            Attendance.id == record_id
        ).first()
        
        if not result:
            return jsonify({'error': 'Attendance record not found'}), 404
            
        attendance = result[0]  # Attendance object
        
        # Get instructor name
        instructor_name = 'N/A'
        if result.instructor_id:
            instructor = User.query.get(result.instructor_id)
            if instructor:
                instructor_name = f"{instructor.first_name} {instructor.last_name}"
        
        # Format the record
        record = {
            'id': attendance.id,
            'date': attendance.date.strftime('%Y-%m-%d') if attendance.date else None,
            'student_id': result.student_id,
            'student_name': f"{result.student_first_name} {result.student_last_name}",
            'student_profile_img': result.student_profile_img,
            'class_id': result.class_id,
            'class_name': result.class_name,
            'instructor_id': result.instructor_id,
            'instructor_name': instructor_name,
            'status': attendance.status,
            'comment': attendance.comments,
            'created_at': attendance.created_at.strftime('%Y-%m-%d %H:%M:%S') if attendance.created_at else None,
            'updated_at': attendance.updated_at.strftime('%Y-%m-%d %H:%M:%S') if attendance.updated_at else None
        }
        
        return jsonify(record)
    except Exception as e:
        print(f"Error fetching attendance record: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@api_bp.route('/attendance/report/<string:record_id>', methods=['PUT'])
@login_required
def update_admin_attendance_record(record_id):
    """API endpoint to update an attendance record for admin view"""
    try:
        # Check if user is admin
        if not hasattr(current_user, 'role') or current_user.role.lower() != 'admin':
            return jsonify({'error': 'Unauthorized access'}), 403
            
        # Get JSON data from request
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Get the attendance record
        attendance = Attendance.query.get(record_id)
        
        if not attendance:
            return jsonify({'error': 'Attendance record not found'}), 404
            
        # Update fields
        if 'status' in data:
            attendance.status = data['status']
            
        if 'comment' in data:
            attendance.comments = data['comment']
            
        if 'date' in data:
            try:
                attendance.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Expected format: YYYY-MM-DD'}), 400
                
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

@api_bp.route('/attendance/report/<string:record_id>/archive', methods=['PUT'])
@login_required
def archive_admin_attendance_record(record_id):
    """API endpoint to archive an attendance record for admin view"""
    try:
        # Check if user is admin
        if not hasattr(current_user, 'role') or current_user.role.lower() != 'admin':
            return jsonify({'error': 'Unauthorized access'}), 403
            
        # Get the attendance record
        attendance = Attendance.query.get(record_id)
        
        if not attendance:
            return jsonify({'error': 'Attendance record not found'}), 404
            
        # Get archive reason from request
        data = request.json
        archive_reason = data.get('reason', 'No reason provided')
        
        # Add archive note to comments
        archive_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        admin_name = f"{current_user.first_name} {current_user.last_name}"
        
        archive_note = f"ARCHIVED ({archive_timestamp}): {archive_reason}\nArchived by: {admin_name}"
        
        if attendance.comments:
            attendance.comments += f"\n\n{archive_note}"
        else:
            attendance.comments = archive_note
            
        # Mark as archived
        attendance.is_archived = True
        attendance.updated_at = datetime.now()
        attendance.archive_date = datetime.now()
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Attendance record archived successfully'
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error archiving attendance record: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500