from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import hashlib
import binascii
import os

# Initialize SQLAlchemy
db = SQLAlchemy()

# User model for instructors/administrators
class User(db.Model, UserMixin):
    __tablename__ = 'user'
    id = db.Column(db.String(6), primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    email = db.Column(db.String(120), unique=True, nullable=False)
    department = db.Column(db.String(50))
    role = db.Column(db.Enum('student', 'instructor', 'admin', name='user_role_enum'), default='student')
    password = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    profile_img = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    date_of_birth = db.Column(db.Date)
    company_id = db.Column(db.String(6), db.ForeignKey('company.id'))
    qualification = db.Column(db.String(50), nullable=True)  # For instructor qualifications (e.g., PhD, Masters)
    specialization = db.Column(db.String(50), nullable=True)  # For instructor specializations
    access_level = db.Column(db.String(10), nullable=True)  # For admin access levels
    is_archived = db.Column(db.Boolean, default=False)
    archive_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)  # For archive notes and other comments
    first_login = db.Column(db.Boolean, default=True)  # Flag to indicate if this is the user's first login

    # Relationships
    company = db.relationship('Company', backref='users')
    enrollments = db.relationship('Enrollment', backref='student', lazy=True)
    classes_taught = db.relationship('Class', backref='instructor', lazy=True)
    attendance_records = db.relationship('Attendance', backref='student', lazy=True)

    def set_password(self, password):
        """Set the password hash for the user"""
        try:
            # Generate a random salt
            salt = binascii.hexlify(os.urandom(8)).decode()
            
            # Hash the password with salt
            hash_obj = hashlib.sha256()
            hash_obj.update(f"{salt}{password}".encode('utf-8'))
            password_hash = hash_obj.hexdigest()
            
            # Store in format: algorithm$salt$hash
            self.password = f"sha256${salt}${password_hash}"
        except Exception as e:
            # Log the error but don't store plaintext
            print(f"Error setting password: {e}")
            raise

    def check_password(self, password):
        """Check if the provided password matches the stored hash"""
        try:
            # Handle our custom password format: algorithm$salt$hash
            if self.password and self.password.startswith('sha256$'):
                parts = self.password.split('$')
                if len(parts) == 3:
                    algorithm, salt, stored_hash = parts
                    
                    # Recreate the hash
                    hash_obj = hashlib.sha256()
                    hash_obj.update(f"{salt}{password}".encode('utf-8'))
                    calculated_hash = hash_obj.hexdigest()
                    
                    # Compare the calculated hash with the stored hash
                    return calculated_hash == stored_hash
            
            # Handle Werkzeug password format (used for new users)
            if self.password and self.password.startswith('pbkdf2:sha256:') or self.password.startswith('scrypt:'):
                return check_password_hash(self.password, password)
                
            # If we get here, it's an unrecognized format
            print(f"Unrecognized password format: {self.password[:10] if self.password else 'None'}...")
            return False
            
        except Exception as e:
            print(f"Password check error: {e}")
            # Return False instead of allowing access
            return False

    def to_dict(self):
        """Convert User object to a dictionary for JSON serialization"""
        return {
            'id': self.id,
            'username': self.username,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'department': self.department,
            'role': self.role,
            'is_active': self.is_active,
            'profile_img': self.profile_img,
            'created_at': self.created_at,
            'last_login': self.last_login
        }

    def __repr__(self):
        return f'<User {self.username}>'

# Additional user settings for admin
class AdminSettings(db.Model):
    __tablename__ = 'admin_settings'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(6), db.ForeignKey('user.id'), nullable=False)
    email_notifications = db.Column(db.Boolean, default=True)
    maintenance_mode = db.Column(db.Boolean, default=False)
    maintenance_message = db.Column(db.Text, nullable=True)
    maintenance_start_time = db.Column(db.DateTime, nullable=True)
    maintenance_end_time = db.Column(db.DateTime, nullable=True)
    data_retention = db.Column(db.Integer, default=90)  # days
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with User
    user = db.relationship('User', backref='settings')
    
    def __repr__(self):
        return f"<AdminSettings(user_id={self.user_id}, email_notifications={self.email_notifications})>"

# Class model
class Class(db.Model):
    __tablename__ = 'class'
    id = db.Column(db.String(6), primary_key=True)
    name = db.Column(db.String(100))
    description = db.Column(db.Text)
    term = db.Column(db.String(15))
    instructor_id = db.Column(db.String(6), db.ForeignKey('user.id'))
    day_of_week = db.Column(db.String(15))
    start_time = db.Column(db.Time)
    end_time = db.Column(db.Time)
    is_active = db.Column(db.Boolean, default=True)
    is_archived = db.Column(db.Boolean, default=False)
    archive_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)  
    created_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime)
    
    # Relationships
    enrollments = db.relationship('Enrollment', backref='class', lazy=True)
    attendance_records = db.relationship('Attendance', backref='class', lazy=True)
    
    def __repr__(self):
        return f'<Class {self.id}>'

# Enrollment model (many-to-many relationship between students and classes)
class Enrollment(db.Model):
    __tablename__ = 'enrollment'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.String(6), db.ForeignKey('user.id'), nullable=False)
    class_id = db.Column(db.String(6), db.ForeignKey('class.id'), nullable=False)
    enrollment_date = db.Column(db.Date, nullable=False)
    unenrollment_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.Enum('Active', 'Pending'), default='Pending')
    
    def __repr__(self):
        return f'<Enrollment {self.student_id} in {self.class_id}>'

# Attendance model
class Attendance(db.Model):
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.String(6), db.ForeignKey('user.id'), nullable=False)
    class_id = db.Column(db.String(6), db.ForeignKey('class.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    
    # Unique constraint to prevent duplicate attendance records
    __table_args__ = (db.UniqueConstraint('student_id', 'class_id', 'date', name='uix_attendance_student_class_date'),)
    status = db.Column(db.Enum('Present', 'Absent', 'Late'), nullable=False)
    comments = db.Column(db.Text)
    
    # Admin-only fields for archiving attendance records
    is_archived = db.Column(db.Boolean, default=False)
    archive_date = db.Column(db.DateTime)
    
    def __repr__(self):
        return f'<Attendance {self.student_id} in {self.class_id} on {self.date}>'

# Helper function to fix existing attendance records with lowercase status values
def fix_attendance_status_values(app=None):
    """
    Utility function to fix any existing lowercase attendance status values.
    This should be run once to correct any data issues.
    
    Args:
        app: Flask application instance to create context if needed
        
    Returns:
        dict: Counts of fixed records by status
    """
    fixed_counts = {
        'present': 0,
        'absent': 0,
        'late': 0,
        'total': 0
    }
    
    try:
        from sqlalchemy import text
        from sqlalchemy.exc import SQLAlchemyError
        
        # SQL to update lowercase 'present' to 'Present' and return count
        present_sql = text("UPDATE attendance SET status = 'Present' WHERE status = 'present'")
        result = db.session.execute(present_sql)
        fixed_counts['present'] = result.rowcount
        
        # SQL to update lowercase 'absent' to 'Absent' and return count
        absent_sql = text("UPDATE attendance SET status = 'Absent' WHERE status = 'absent'")
        result = db.session.execute(absent_sql)
        fixed_counts['absent'] = result.rowcount
        
        # SQL to update lowercase 'late' to 'Late' and return count
        late_sql = text("UPDATE attendance SET status = 'Late' WHERE status = 'late'")
        result = db.session.execute(late_sql)
        fixed_counts['late'] = result.rowcount
        
        # Calculate total fixed count
        fixed_counts['total'] = fixed_counts['present'] + fixed_counts['absent'] + fixed_counts['late']
        
        # Commit the changes
        db.session.commit()
        
        # print(f"Fixed {fixed_counts['total']} attendance records with incorrect case:")
        # print(f"  - Present: {fixed_counts['present']}")
        # print(f"  - Absent: {fixed_counts['absent']}") 
        # print(f"  - Late: {fixed_counts['late']}")
        
        # Verify the current status counts in database (includes both fixed and already correct records)
        from sqlalchemy import func
        present_count = db.session.query(func.count(Attendance.id)).filter(Attendance.status == 'Present').scalar()
        absent_count = db.session.query(func.count(Attendance.id)).filter(Attendance.status == 'Absent').scalar()
        late_count = db.session.query(func.count(Attendance.id)).filter(Attendance.status == 'Late').scalar()
        
        # print(f"Total records by status after fix:")
        # print(f"  - Present: {present_count}")
        # print(f"  - Absent: {absent_count}")
        # print(f"  - Late: {late_count}")
        
        return fixed_counts
        
    except SQLAlchemyError as e:
        db.session.rollback()
        print(f"Error fixing attendance status values: {str(e)}")
        return fixed_counts

# Don't run fix automatically on import - it will be called from within the app context in app.py
print("Attendance status fix function is ready to be called from within an app context.")

class Company(db.Model):
    __tablename__ = 'company'
    id = db.Column(db.String(6), primary_key=True)  
    company_id = db.synonym('id')  
    name = db.Column(db.String(100), nullable=False)
    contact = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Enum('Active', 'Inactive', name='company_is_active_enum'), nullable=False, default='Active', server_default='Active')
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    archive_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now(), onupdate=db.func.now())

class LoginAttempt(db.Model):
    __tablename__ = 'login_attempt'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    ip_address = db.Column(db.String(45), nullable=False)  # IPv6 can be up to 45 chars
    email = db.Column(db.String(100), nullable=False)
    attempt_count = db.Column(db.Integer, default=0)
    last_attempt = db.Column(db.DateTime, default=datetime.utcnow)
    lockout_until = db.Column(db.DateTime, nullable=True)
    
    @classmethod
    def get_attempts(cls, ip_address, email):
        """Get the current attempt record or create a new one"""
        attempt = cls.query.filter_by(ip_address=ip_address, email=email).first()
        if not attempt:
            attempt = cls(ip_address=ip_address, email=email)
            db.session.add(attempt)
            db.session.commit()
        return attempt
    
    def increment(self, max_attempts=5, lockout_minutes=15):
        """Increment attempt count and lock if needed"""
        self.attempt_count += 1
        self.last_attempt = datetime.utcnow()
        
        # Lock if max attempts reached
        if self.attempt_count >= max_attempts:
            self.lockout_until = datetime.utcnow() + timedelta(minutes=lockout_minutes)
        
        db.session.commit()
        return self.attempt_count
    
    def reset(self):
        """Reset attempt counter on successful login"""
        self.attempt_count = 0
        self.lockout_until = None
        db.session.commit()
    
    def is_locked(self):
        """Check if the account is locked"""
        if not self.lockout_until:
            return False
        
        # If lockout period has passed, reset
        if datetime.utcnow() > self.lockout_until:
            self.attempt_count = 0
            self.lockout_until = None
            db.session.commit()
            return False
            
        return True
    
    def get_remaining_attempts(self, max_attempts=5):
        """Get remaining attempts before lockout"""
        return max(0, max_attempts - self.attempt_count)
    
    def get_lockout_remaining_minutes(self):
        """Get remaining lockout time in minutes"""
        if not self.lockout_until:
            return 0
            
        delta = self.lockout_until - datetime.utcnow()
        minutes = max(0, int(delta.total_seconds() / 60) + 1)
        return minutes
