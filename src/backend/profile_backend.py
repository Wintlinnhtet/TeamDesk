from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pymongo import MongoClient
from gridfs import GridFS
from bson import ObjectId
import os
from werkzeug.utils import secure_filename
import io
import base64
import certifi  # Needed for SSL connection to Atlas
from flask import Blueprint

# Create a blueprint for profile routes
profile_bp = Blueprint('profile', __name__)

# MongoDB Atlas connection
try:
    # Updated connection string with proper parameters
    connection_string = 'mongodb+srv://root:12345@cluster-1.6obokol.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-1'
    
    # Connect with SSL certificate verification
    client = MongoClient(connection_string, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=10000)
    
    # Test the connection
    client.server_info()
    
    db = client['team-desk']  # Database name
    users_collection = db['users']  # Collection for user data
    print("Connected to MongoDB Atlas successfully")
    
    # Initialize GridFS for file storage
    fs = GridFS(db)
    
except Exception as e:
    print(f"Could not connect to MongoDB Atlas: {e}")
    print("Using fallback in-memory storage")
    # Fallback to in-memory storage if MongoDB is not available
    users_collection = None
    fs = None

# Fallback user data if MongoDB is not available
fallback_user = {
    "name": "Kim Jee Yumm",
    "role": "UI/UX Design Engineer",
    "location": "North Korea, Communist",
    "firstName": "Kim",
    "email": "Kimjee215@gmail.com",
    "jobRole": "Team Manager",
    "country": "North Korea",
    "postalCode": "ERT 2354",
    "profileImageId": None,
    "_id": "fallback_user_id"  # Add this field
}

@profile_bp.route('/api/profile', methods=['GET', 'OPTIONS'])
def profile_get():
    """Get user profile data"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        print("DEBUG: Using fallback user data")
        
        # Force use fallback data for now (bypass MongoDB)
        user = fallback_user.copy()
        
        # Add URL for profile image if exists
        if user.get('profileImageId'):
            user['profileImageUrl'] = f'http://localhost:5000/api/profile-image/{user["profileImageId"]}'
        else:
            user['profileImageUrl'] = None
        
        print(f"DEBUG: Returning user data: {user}")
        return jsonify(user)
        
    except Exception as e:
        print(f"ERROR in get_profile: {str(e)}")
        print(f"ERROR Type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error"}), 500

@profile_bp.route('/api/profile', methods=['PUT', 'OPTIONS'])
def profile_update():
    """Update user profile data"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Update fallback user data
        for key, value in data.items():
            if key in fallback_user and key not in ['_id', 'profileImageId', 'profileImageUrl']:
                fallback_user[key] = value
        
        # Return updated user
        updated_user = fallback_user.copy()
        if updated_user.get('profileImageId'):
            updated_user['profileImageUrl'] = f'http://localhost:5000/api/profile-image/{updated_user["profileImageId"]}'
        else:
            updated_user['profileImageUrl'] = None
            
        return jsonify({"message": "Profile updated successfully", "user": updated_user})
    except Exception as e:
        print(f"Error in update_profile: {e}")
        return jsonify({"error": "Server error"}), 500

@profile_bp.route('/api/upload-profile-image', methods=['POST', 'OPTIONS'])
def upload_profile_image():
    """Handle profile image upload and store in GridFS"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        print("DEBUG: File upload started")
        if 'profileImage' not in request.files:
            print("DEBUG: No file in request")
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['profileImage']
        print(f"DEBUG: File received: {file.filename}")
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # For now, use fallback since we're bypassing MongoDB
        file_data = file.read()
        fallback_user['profileImageData'] = base64.b64encode(file_data).decode('utf-8')
        fallback_user['profileImageType'] = file.content_type
        fallback_user['profileImageId'] = "fallback_image"
        
        return jsonify({
            "message": "File uploaded successfully", 
            "fileId": "fallback_image",
            "imageUrl": "http://localhost:5000/api/profile-image/fallback_image"
        })
    except Exception as e:
        print(f"ERROR in upload: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Server error"}), 500

@profile_bp.route('/api/profile-image/<file_id>', methods=['GET', 'OPTIONS'])
def get_profile_image(file_id):
    """Retrieve profile image from GridFS or fallback"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        if file_id == "fallback_image" and 'profileImageData' in fallback_user:
            # Return fallback image
            image_data = base64.b64decode(fallback_user['profileImageData'])
            return send_file(
                io.BytesIO(image_data),
                mimetype=fallback_user.get('profileImageType', 'image/jpeg')
            )
        else:
            return jsonify({"error": "Image not found"}), 404
    except Exception as e:
        print(f"Error in get_profile_image: {e}")
        return jsonify({"error": "Image not found"}), 404

@profile_bp.route('/api/profile/health', methods=['GET'])
def profile_health_check():
    """Health check endpoint for profile functionality"""
    return jsonify({"status": "ok", "message": "Profile API is working"})