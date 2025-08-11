from flask import Flask, request, jsonify
from flask_cors import CORS
from database import db
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app, resources={
    r"/signup": {"origins": "http://localhost:5173"},
    r"/signin": {"origins": "http://localhost:5173"}
})

users_collection = db["users"]

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    print("📩 Received data:", data)

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    confirm_password = data.get("confirmPassword")
    phone = data.get("phone")

    # Validation
    if not name or not email or not password or not confirm_password or not phone:
        return jsonify({"error": "All fields are required"}), 400
    if password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    # Check if user exists
    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 400
    
    # Hash the password before storing
    hashed_password = generate_password_hash(password)

    # Save user
    user_data = {
        "name": name,
        "email": email,
        "password": hashed_password,  # Store hashed passwords in production!
        "phone": phone,
        "role": "member"  # set default role
    }
    users_collection.insert_one(user_data)

    return jsonify({"message": "Registered successfully!"}), 201






@app.route("/signin", methods=["POST"])
def signin():
    data = request.get_json()
    print("📩 Received data:", data)
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    # If passwords are stored hashed:
    if not check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Successful login
    return jsonify({"message": "Signin successful", "user": {"name": user.get("name"), "email": user.get("email"), "role": user.get("role")}})

if __name__ == "__main__":
    app.run(port=5000, debug=True, use_reloader=False)
