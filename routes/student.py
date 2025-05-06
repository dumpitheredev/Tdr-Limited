from flask import Blueprint, redirect, url_for, flash
from flask_login import login_required, current_user

student_bp = Blueprint('student', __name__, url_prefix='/student')

# Middleware to check if user is student
@student_bp.before_request
def check_student():
    if not current_user.is_authenticated or current_user.role != 'student':
        flash('You do not have permission to access this page.', 'error')
        return redirect(url_for('auth.login'))

# Placeholder route for future implementation
@student_bp.route('/dashboard')
@login_required
def dashboard():
    flash('Student functionality is not implemented yet.', 'info')
    return redirect(url_for('auth.login'))

# Placeholder route for future implementation  
@student_bp.route('/attendance-history')
@login_required
def attendance_history():
    flash('Student functionality is not implemented yet.', 'info')
    return redirect(url_for('auth.login'))

# Placeholder route for future implementation
@student_bp.route('/enrolment')
@login_required
def enrolment():
    flash('Student functionality is not implemented yet.', 'info')
    return redirect(url_for('auth.login')) 