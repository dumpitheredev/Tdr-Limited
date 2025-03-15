from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import ProgrammingError, OperationalError
import pymysql
import os

# Register MySQL driver
pymysql.install_as_MySQLdb()

print("Starting database table creation...")

# Create a Flask app instance specifically for this script
app = Flask(__name__)

# Updated connection string with simple password that works
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://attendance_user:SimplePassword123@localhost/attendance_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Create the SQLAlchemy instance
db = SQLAlchemy(app)

# Import models after db is defined but before create_all
from models import User, Student, Class, Enrollment, Attendance

# Now create the tables
with app.app_context():
    try:
        db.create_all()
        print("✓ Tables created successfully!")
    except (ProgrammingError, OperationalError) as e:
        print(f"! Error: {e}")
        print("Some tables may already exist. This is normal if you've run this before.")

print("Finished database setup process.")
