from flask import Blueprint, jsonify, request, make_response, render_template, current_app
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

# Create API blueprint
api_bp = Blueprint('api', __name__, url_prefix='/api')

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
        
        # Build and execute update query
        if update_fields:
            query = f"UPDATE company SET {', '.join(update_fields)} WHERE id = :company_id"
            db.session.execute(text(query), params)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Company updated successfully'
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
    try:
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
        
        # Build query
        query = Class.query
        
        # Apply status filter if provided
        if status_filter:
            is_active = status_filter.lower() == 'active'
            query = query.filter(Class.is_active == is_active)
        else:
            # Default: Only show active classes and restored inactive classes (without ARCHIVE NOTE)
            query = query.filter(
                (Class.is_active == True) |  # Active classes
                (
                    (Class.is_active == False) &  # Inactive classes
                    (
                        (Class.description.is_(None)) |  # with no description
                        (Class.description == '') |      # or empty description
                        (~Class.description.like('%ARCHIVE NOTE%'))  # or without ARCHIVE NOTE
                    )
                )
            )
        
        # Apply instructor filter if provided
        if instructor_id:
            query = query.filter(Class.instructor_id == instructor_id)
        
        # Execute query
        classes = query.all()
        print(f"Found {len(classes)} classes in get_classes API")
        
        # Debug first 5 classes
        for i, class_obj in enumerate(classes[:5]):
            print(f"Class {i+1}: ID={class_obj.id}, Name={class_obj.name}, Active={class_obj.is_active}")
            
        # Format response
        result = []
        for class_obj in classes:
            # Get instructor info
            instructor_name = "Not Assigned"
            if class_obj.instructor_id:
                instructor = User.query.get(class_obj.instructor_id)
                if instructor:
                    instructor_name = f"{instructor.first_name} {instructor.last_name}"
            
            # Format class data
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
    except Exception as e:
        print(f"Error in get_classes API: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify([]), 200  # Return empty array to prevent UI errors

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
            
        # Count attendance records
        try:
            result['counts']['attendance'] = Attendance.query.filter_by(is_archived=True).count()
        except Exception as e:
            print(f"Error counting attendance: {str(e)}")
            result['counts']['attendance'] = 0
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error retrieving archive counts: {str(e)}")
        return jsonify({'counts': {
            'student': 0,
            'class': 0,
            'company': 0,
            'instructor': 0,
            'attendance': 0
        }}), 200  # Return zeros with 200 status to prevent breaking the UI 

@api_bp.route('/students/<string:student_id>/enrollment', methods=['GET'])
@login_required
def get_student_enrollment(student_id):
    try:
        student = User.query.get_or_404(student_id)
        
        # Get student info
        student_info = {
            'user_id': student.id,
            'name': f"{student.first_name} {student.last_name}",
            'email': student.email,
            'status': 'Active' if student.is_active else 'Inactive',
            'profile_img': student.profile_img
        }
        
        # Get company info
        company_info = {
            'company_id': student.company_id,
            'name': 'Not Assigned'
        }
        
        if student.company_id:
            try:
                company = Company.query.get(student.company_id)
                if company:
                    company_info['name'] = company.name
            except Exception as company_error:
                print(f"Error getting company info: {company_error}")
                # Continue with default company info
        
        # Get enrollment info with classes
        classes = []
        active_classes = []
        historical_classes = []
        
        # Use raw SQL to get ALL enrollments, including past ones
        try:
            # First, get active enrollments (no unenrollment_date)
            active_sql = text("""
                SELECT id, student_id, class_id, enrollment_date, status, 
                       IFNULL(unenrollment_date, '') as unenrollment_date
                FROM enrollment
                WHERE student_id = :student_id
                AND (unenrollment_date IS NULL)
                ORDER BY enrollment_date DESC
            """)
            
            active_enrollments = db.session.execute(active_sql, {"student_id": student_id}).fetchall()
            print(f"Found {len(active_enrollments)} active enrollments for student {student_id}")
            
            # Then, get historical enrollments (with unenrollment_date)
            historical_sql = text("""
                SELECT id, student_id, class_id, enrollment_date, status, 
                       IFNULL(unenrollment_date, '') as unenrollment_date
                FROM enrollment
                WHERE student_id = :student_id
                AND unenrollment_date IS NOT NULL
                ORDER BY unenrollment_date DESC
            """)
            
            historical_enrollments = db.session.execute(historical_sql, {"student_id": student_id}).fetchall()
            print(f"Found {len(historical_enrollments)} historical enrollments for student {student_id}")
            
            # Process active enrollments
            for enrollment in active_enrollments:
                # Get enrollment data from SQL result
                enrollment_id = enrollment[0]
                class_id = enrollment[2]
                enrollment_date = enrollment[3]
                enrollment_status = enrollment[4]
                
                # Get class info
                class_obj = Class.query.get(class_id)
                if not class_obj:
                    print(f"Warning: Class {class_id} not found for active enrollment {enrollment_id}")
                    continue  # Skip if class not found
                
                # Create class info dictionary
                class_info = {
                    'class_id': class_obj.id,
                    'name': class_obj.name,
                    'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}",
                    'enrollment_status': enrollment_status,
                    'enrollment_id': enrollment_id,
                    'enrollment_date': enrollment_date.strftime('%Y-%m-%d') if hasattr(enrollment_date, 'strftime') else enrollment_date,
                    'is_active': True
                }
                active_classes.append(class_info)
            
            # Process historical enrollments
            for enrollment in historical_enrollments:
                # Get enrollment data from SQL result
                enrollment_id = enrollment[0]
                class_id = enrollment[2]
                enrollment_date = enrollment[3]
                enrollment_status = enrollment[4]
                unenrollment_date = enrollment[5]
                
                # Get class info
                class_obj = Class.query.get(class_id)
                if not class_obj:
                    print(f"Warning: Class {class_id} not found for historical enrollment {enrollment_id}")
                    continue  # Skip if class not found
                
                # Create class info dictionary
                class_info = {
                    'class_id': class_obj.id,
                    'name': class_obj.name,
                    'schedule': f"{class_obj.day_of_week}, {class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}",
                    'enrollment_status': 'Unenrolled',
                    'enrollment_id': enrollment_id,
                    'enrollment_date': enrollment_date.strftime('%Y-%m-%d') if hasattr(enrollment_date, 'strftime') else enrollment_date,
                    'unenrollment_date': unenrollment_date if isinstance(unenrollment_date, str) else (unenrollment_date.strftime('%Y-%m-%d') if unenrollment_date else None),
                    'is_active': False
                }
                historical_classes.append(class_info)
            
            # Combine active and historical classes
            classes = active_classes + historical_classes
                
        except Exception as e:
            print(f"Error getting enrollments: {e}")
            import traceback
            print(traceback.format_exc())
            # If SQL fails, return empty classes list
            classes = []
        
        # Return the full response
        return jsonify({
            'student': student_info,
            'company': company_info,
            'classes': classes
        })
    except Exception as e:
        import traceback
        print(f"Error fetching student enrollment: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': str(e),
            'student': {'name': 'Unknown Student', 'user_id': student_id},
            'company': {'name': 'Unknown'},
            'classes': []
        }), 500

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
def get_attendance():
    """API endpoint to get attendance records with filters."""
    try:
        # Get filter parameters
        class_id = request.args.get('class_id', '')
        instructor_id = request.args.get('instructor_id', '')
        student_name = request.args.get('student_name', '')
        status = request.args.get('status', '')
        date_start = request.args.get('date_start', '')
        date_end = request.args.get('date_end', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        exclude_archived = request.args.get('exclude_archived', 'false').lower() == 'true'
        
        # Build the base query with direct SQL filtering
        query = db.session.query(
            Attendance, User, Class
        ).outerjoin(
            User, User.id == Attendance.student_id
        ).outerjoin(
            Class, Class.id == Attendance.class_id
        )
        
        # Apply filters
        if class_id:
            query = query.filter(Class.id == class_id)
        
        if status:
            query = query.filter(Attendance.status == status)
        
        if student_name:
            query = query.filter(or_(
                User.first_name.ilike(f'%{student_name}%'),
                User.last_name.ilike(f'%{student_name}%')
            ))
        
        if instructor_id:
            query = query.filter(Class.instructor_id == instructor_id)
        
        # Filter out archived records if requested
        if exclude_archived:
            query = query.filter(or_(Attendance.is_archived == False, Attendance.is_archived == None))
        
        # Apply date filters
        if date_start:
            try:
                date_start_obj = datetime.strptime(date_start, '%Y-%m-%d').date()
                query = query.filter(Attendance.date >= date_start_obj)
            except Exception as e:
                print(f"Invalid date_start format: {date_start}")
        
        if date_end:
            try:
                date_end_obj = datetime.strptime(date_end, '%Y-%m-%d').date()
                query = query.filter(Attendance.date <= date_end_obj)
            except Exception as e:
                print(f"Invalid date_end format: {date_end}")
        
        # Count total records first
        total_count = query.count()
        
        # Get status counts
        present_count = query.filter(Attendance.status == 'Present').count()
        absent_count = query.filter(Attendance.status == 'Absent').count()
        late_count = query.filter(Attendance.status == 'Late').count()
        
        # Apply pagination
        query = query.order_by(Attendance.date.desc())
        results = query.offset((page - 1) * per_page).limit(per_page).all()
        
        # Format records for response
        records = []
        for attendance, student, class_obj in results:
            instructor_name = "Unknown"
            instructor_id = None
            
            if class_obj and class_obj.instructor_id:
                instructor = User.query.get(class_obj.instructor_id)
                if instructor:
                    instructor_name = f"{instructor.first_name} {instructor.last_name}"
                    instructor_id = instructor.id
            
            records.append({
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
            })
        
        # Calculate total pages
        total_pages = math.ceil(total_count / per_page) if total_count > 0 else 1
        
        # Prepare response
        return jsonify({
            'records': records,
            'total_records': total_count,
            'stats': {
                'total': total_count,
                'present': present_count,
                'absent': absent_count,
                'late': late_count
            },
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_pages': total_pages
            }
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'Failed to fetch attendance data: {str(e)}',
            'records': []
        }), 500

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
        
        # Add archive note to comments
        reason = data.get('reason', 'User requested archive')
        comment = data.get('comment', '')
        archive_note = f"ARCHIVE NOTE ({datetime.now().strftime('%Y-%m-%d')}): {reason}"
        
        if comment:
            archive_note += f" - {comment}"
        
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
            company_count = Company.query.filter_by(is_archived=True).count()
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

@api_bp.route('/restore-archived/attendance/<int:record_id>', methods=['POST'])
@login_required
def restore_archived_attendance(record_id):
    """Restore an archived attendance record"""
    try:
        # Get the attendance record
        attendance = Attendance.query.get_or_404(record_id)
        
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
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@api_bp.route('/archives/delete/attendance/<int:record_id>', methods=['DELETE'])
@login_required
def delete_archived_attendance(record_id):
    """Permanently delete an archived attendance record"""
    try:
        # Get the attendance record
        attendance = Attendance.query.get_or_404(record_id)
        
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
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500