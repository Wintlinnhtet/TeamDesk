import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta ,timezone
from fastapi import FastAPI
from dateutil.parser import isoparse
from backend.database import get_db
from flask import  Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from backend.database import db
from datetime import datetime,timedelta,timezone
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

import os,time,sys
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) 

PARENT_DIR = os.path.dirname(BASE_DIR) 

     
# --- uploads config (ONE place only) ---



if PARENT_DIR not in sys.path:

    sys.path.insert(0, PARENT_DIR)

proj_col=get_db()["projects"]
noti_col=get_db()["notifications"]
users_col=get_db()["users"]
from bson import ObjectId


app = Flask(__name__)
# Sending Email

def send_welcome_email(email, position):
    smtp_server = "smtp.gmail.com"
    smtp_port = 465
    sender_email = os.getenv("SMTP_EMAIL", "yephay123@gmail.com")
    sender_password = os.getenv("SMTP_PASSWORD", "hijgcbmcfivzteyi")

    message = MIMEMultipart("alternative")
    message["Subject"] = f"Welcome to Our Team - {position} Position"
    message["From"] = sender_email
    message["To"] = email

    html = f"""
    <html>
    <body>
        <h2>Welcome to Our Team!</h2>
        <p>We're excited to have you join us as a <strong>{position}</strong>.</p>
        <p>Your account has been successfully created with email: {email}</p>
        <p>We'll be in touch soon with more details about your onboarding process.</p>
        <br>
        <p>Best regards,<br>Your Team</p>
    </body>
    </html>
    """
    message.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, email, message.as_string())
        print(f"✅ Welcome email sent to {email}")
    except Exception as e:
        print(f"❌ Failed to send welcome email to {email}: {e}")

@app.route('/add-member', methods=['POST'])
def add_newmember():
    data = request.get_json()
    email = data['email']
    position = data['position']
    send_welcome_email(email, position)
    return jsonify({"message": "Member added successfully"})


#///////////////////////////////////
# =====================
# 2. DEADLINE REMINDERS
# =====================
def send_deadline_email(to_email, project_name, deadline):
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    sender_email = os.getenv("SMTP_EMAIL", "yephay123@gmail.com")
    sender_password = os.getenv("SMTP_PASSWORD", "rebwdogkklzbvpeh")

    message = MIMEMultipart("alternative")
    message["Subject"] = f"Reminder: {project_name} deadline in 7 days"
    message["From"] = sender_email
    message["To"] = to_email

    html = f"""
    <html>
    <body>
        <h2>⏰ Project Deadline Reminder</h2>
        <p>Hello,</p>
        <p>The project <b>{project_name}</b> is due on <b>{deadline}</b> (7 days from today).</p>
        <p>Please make sure all tasks are on track!</p>
        <br>
        <p>Best regards,<br>Project Manager</p>
    </body>
    </html>
    """
    message.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, message.as_string())
        print(f"✅ Deadline reminder sent to {to_email}")
    except Exception as e:
        print(f"❌ Failed to send deadline reminder: {e}")




def check_deadlines():
    now_utc = datetime.now(timezone.utc)
    within_start = now_utc
    within_end = now_utc + timedelta(days=7, hours=23, minutes=59, seconds=59)
    exact_start = now_utc + timedelta(days=7)
    exact_end = exact_start + timedelta(days=1) - timedelta(seconds=1)

    for project in proj_col.find():
        end_at = project.get("end_at")
        try:
            if isinstance(end_at, str):
                end_at = isoparse(end_at)
        except ValueError:
            print(f"❌ Invalid end_at for project {project.get('name')}: {end_at}")
            continue

        if end_at < now_utc:
            continue  # skip past deadlines
        if project.get("status") == "complete":
            continue  # skip completed projects

        # Determine reminder type
        if exact_start <= end_at <= exact_end:
            reminder_type = "exactly 7 days"
        elif within_start <= end_at <= within_end:
            reminder_type = "within 7 days"
        else:
            continue  # skip if not in either window

        project_name = project.get("name")
        project_deadline_str = end_at.strftime("%Y-%m-%d %H:%M UTC")
        project_id = str(project.get("_id"))
        member_ids = project.get("member_ids", [])

        for member_id in member_ids:
            user = users_col.find_one({"_id": ObjectId(member_id), "email": {"$exists": True}})
            if not user:
                continue
            member_email = user["email"]

            send_deadline_email(member_email, project_name, project_deadline_str)
            print(f"📧 Reminder ({reminder_type}) sent to {member_email} for project '{project_name}'")

            noti_col.insert_one({
                "project_id": project_id,
                "member_id": member_id,
                "email": member_email,
                "sent_at": datetime.utcnow(),
                "message": f"Deadline reminder ({reminder_type}) for project '{project_name}'"
            })


# =====================
# 3. SCHEDULER
# =====================
scheduler = BackgroundScheduler()
scheduler.add_job(check_deadlines, "cron", hour=9, minute=0)  # Daily at 09:00 UTC
scheduler.start()
print("✅ Scheduler started - deadline reminders active")