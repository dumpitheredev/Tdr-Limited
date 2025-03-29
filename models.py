from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

# Initialize SQLAlchemy
db = SQLAlchemy()

# User model for instructors/administrators
class User(db.Model, UserMixin):
    __tablename__ = 'user'
    id = db.Column(db.String(6), primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'Administrator', 'Instructor', 'Student'
    date_of_birth = db.Column(db.Date)
    company_id = db.Column(db.String(6), db.ForeignKey('company.company_id'))
    is_active = db.Column(db.Boolean, default=True)
    profile_img = db.Column(db.String(100), default='profile.png')

    # Relationships
    company = db.relationship('Company', backref='users')
    enrollments = db.relationship('Enrollment', backref='student', lazy=True)
    classes_taught = db.relationship('Class', backref='instructor', lazy=True)
    attendance_records = db.relationship('Attendance', backref='student', lazy=True)

    def __repr__(self):
        return f'<User {self.username}>'

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
    company_id = db.Column(db.String(6), db.ForeignKey('company.company_id'), nullable=False)
    enrollment_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum('Active', 'Pending', 'Completed'), default='Active')
    is_archived = db.Column(db.Boolean, default=False)
    archive_date = db.Column(db.Date)

    def __repr__(self):
        return f'<Enrollment {self.student_id} in {self.class_id}>'

# Attendance model
class Attendance(db.Model):
    __tablename__ = 'attendance'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.String(6), db.ForeignKey('user.id'), nullable=False)
    class_id = db.Column(db.String(6), db.ForeignKey('class.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum('Present', 'Absent', 'Late'), nullable=False)
    comments = db.Column(db.Text)
    is_archived = db.Column(db.Boolean, default=False)
    archive_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Attendance {self.student_id} in {self.class_id} on {self.date}>'

# Helper function to fix existing attendance records with lowercase status values
def fix_attendance_status_values():
    """
    Utility function to fix any existing lowercase attendance status values.
    This should be run once to correct any data issues.
    """
    try:
        from sqlalchemy import text
        from sqlalchemy.exc import SQLAlchemyError
        
        # SQL to update lowercase 'present' to 'Present'
        present_sql = text("UPDATE attendance SET status = 'Present' WHERE status = 'present'")
        
        # SQL to update lowercase 'absent' to 'Absent'
        absent_sql = text("UPDATE attendance SET status = 'Absent' WHERE status = 'absent'")
        
        # SQL to update lowercase 'late' to 'Late'
        late_sql = text("UPDATE attendance SET status = 'Late' WHERE status = 'late'")
        
        # Execute the updates
        db.session.execute(present_sql)
        db.session.execute(absent_sql)
        db.session.execute(late_sql)
        
        # Commit the changes
        db.session.commit()
        
        print("Successfully updated attendance status values to proper case.")
        
        # Verify the changes
        from sqlalchemy import func
        present_count = db.session.query(func.count(Attendance.id)).filter(Attendance.status == 'Present').scalar()
        absent_count = db.session.query(func.count(Attendance.id)).filter(Attendance.status == 'Absent').scalar()
        late_count = db.session.query(func.count(Attendance.id)).filter(Attendance.status == 'Late').scalar()
        
        print(f"Records with status 'Present': {present_count}")
        print(f"Records with status 'Absent': {absent_count}")
        print(f"Records with status 'Late': {late_count}")
        
    except SQLAlchemyError as e:
        db.session.rollback()
        print(f"Error fixing attendance status values: {str(e)}")

class Company(db.Model):
    __tablename__ = 'company'
    company_id = db.Column(db.String(6), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    contact = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='Active')