from flask import Flask, request, jsonify
from flask_cors import CORS
from database import db
from werkzeug.security import generate_password_hash, check_password_hash
from bson.objectid import ObjectId

app = Flask(__name__)

# === CHANGE THIS to the server PC's LAN IP shown by Vite as "Network" ===
SERVER_IP = "192.168.1.9"   # <-- put your LAN IP here (e.g., 192.168.x.x)

# Allow both localhost (dev) and your LAN origin (other devices)
FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    f"http://{SERVER_IP}:5137",   # Vite on LAN
]

CORS(
    app,
    resources={r"/*": {"origins": FRONTEND_ORIGINS}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
)

users_collection = db["users"]

# --- health check for quick testing from other devices ---
@app.get("/ping")
def ping():
    return jsonify({"ok": True, "from": "flask"})

# -------------------- ADD MEMBER --------------------
@app.route("/add-member", methods=["POST"])
def add_member():
    data = request.get_json()
    print("📩 Received data:", data)

    email = data.get("email")
    position = data.get("position")

    # Validation
    if not email or not position:
        return jsonify({"error": "All fields are required"}), 400

    # Default password (hashed) — demo only
    hashed_password = generate_password_hash("12345")

    # Save user
    user_data = {
        "email": email,
        "position": position,
        "password": hashed_password,
        "role": "member"
    }
    users_collection.insert_one(user_data)

    return jsonify({"message": "Member added successfully!"}), 201

# -------------------- GET USER --------------------
@app.route("/get-user/<user_id>", methods=["GET"])
def get_user(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Return only necessary fields
        return jsonify({
            "name": user.get("name", ""),
            "dob": user.get("dob", ""),
            "phone": user.get("phone", ""),
            "address": user.get("address", ""),
            "email": user.get("email", "")
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------- UPDATE USER --------------------
@app.route("/update-user/<user_id>", methods=["PATCH"])
def update_user(user_id):
    data = request.get_json()
    name = data.get("name")
    dob = data.get("dob")
    phone = data.get("phone")
    address = data.get("address")
    password = data.get("password")

    if not name or not dob or not phone or not address or not password:
        return jsonify({"error": "All fields are required"}), 400

    hashed_password = generate_password_hash(password)

    try:
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "name": name,
                "dob": dob,
                "phone": phone,
                "address": address,
                "password": hashed_password
            }}
        )
        if result.modified_count == 0:
            return jsonify({"error": "Update failed"}), 400

        return jsonify({"message": "Profile updated successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------- SIGN IN --------------------
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

    if not check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "message": "Signin successful",
        "user": {"_id": str(user["_id"]), "name": user.get("name"), "email": user.get("email"), "role": user.get("role")}
    })

# -------------------- bind to LAN --------------------
if __name__ == "__main__":
    # IMPORTANT: 0.0.0.0 lets other devices on the same network reach it
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
