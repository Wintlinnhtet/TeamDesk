from flask import Blueprint, Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.utils import secure_filename
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Create Blueprint
announce_bp = Blueprint('announce', __name__, url_prefix='/api')



# MongoDB setup
MONGO_URI = "mongodb+srv://root:12345@cluster-1.6obokol.mongodb.net/"
client = MongoClient(MONGO_URI)
db = client['team-desk']  # replace with your DB name
announcement_collection = db['announcement']

# Folder to save uploaded images
UPLOAD_FOLDER = "uploaded_images"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@announce_bp.route('/api/announcement', methods=['POST'])
def create_announcement():
    message = request.form.get('message', '')
    send_to = request.form.get('sendTo', 'member')  # default to 'member'

    # Handle image upload
    image = request.files.get('image', None)
    image_filename = None
    if image:
        filename = secure_filename(image.filename)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        image_filename = f"{timestamp}_{filename}"
        image.save(os.path.join(app.config['UPLOAD_FOLDER'], image_filename))

    # Map frontend role to database value
    if send_to == 'all':
        send_to_db = 'member'
    elif send_to == 'team_leader':
        send_to_db = 'leader'
    else:
        send_to_db = 'member'

    announcement_data = {
        "message": message,
        "image": image_filename,
        "sendTo": send_to_db,
        "createdAt": datetime.utcnow()
    }

    announcement_collection.insert_one(announcement_data)
    return jsonify({"success": True, "data": announcement_data}), 201

if __name__ == '__main__':
    app.run(debug=True)
