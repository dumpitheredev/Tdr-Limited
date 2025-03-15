from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from flask_login import UserMixin

# Initialize SQLAlchemy
db = SQLAlchemy()

# User model for instructors/administrators
class User(db.Model, UserMixin):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='instructor')  # instructor, admin
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    classes = db.relationship('Class', backref='instructor', lazy=True)
    
    def __repr__(self):
        return f'<User {self.username}>'

# Student model
class Student(db.Model):
    __tablename__ = 'students'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(20), unique=True, nullable=False)  # School ID
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    attendances = db.relationship('Attendance', backref='student', lazy=True)
    enrollments = db.relationship('Enrollment', backref='student', lazy=True)
    
    def __repr__(self):
        return f'<Student {self.student_id}>'

# Class model
class Class(db.Model):
    __tablename__ = 'classes'
    
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.String(20), unique=True, nullable=False)  # Like MATH101
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    term = db.Column(db.String(50), nullable=True)  # Fall 2023, etc.
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    attendances = db.relationship('Attendance', backref='class', lazy=True)
    enrollments = db.relationship('Enrollment', backref='class', lazy=True)
    
    def __repr__(self):
        return f'<Class {self.class_id}>'

# Enrollment model (many-to-many relationship between students and classes)
class Enrollment(db.Model):
    __tablename__ = 'enrollments'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    enrollment_date = db.Column(db.Date, default=datetime.now)
    status = db.Column(db.String(20), default='active')  # active, dropped, completed
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    def __repr__(self):
        return f'<Enrollment {self.student_id} in {self.class_id}>'

# Attendance model
class Attendance(db.Model):
    __tablename__ = 'attendances'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False)  # present, absent, late
    comment = db.Column(db.Text, nullable=True)
    archived = db.Column(db.Boolean, default=False)
    archived_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Define a unique constraint to prevent duplicate attendance records
    __table_args__ = (
        db.UniqueConstraint('student_id', 'class_id', 'date', name='uix_attendance'),
    )
    
    def __repr__(self):
        return f'<Attendance {self.student_id} in {self.class_id} on {self.date}>'