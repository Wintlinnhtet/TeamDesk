from pymongo import MongoClient
import certifi

# MongoDB Atlas connection
MONGO_URI = "mongodb+srv://root:12345@cluster-1.6obokol.mongodb.net/"
DB_NAME = "team-desk"

# client = MongoClient(MONGO_URI)
# db = client[DB_NAME]

try:
    client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client[DB_NAME]
    print("✅ Connected to MongoDB!")
    print("📂 Available collections:", db.list_collection_names())
except Exception as e:
    print("❌ MongoDB connection failed!")
    print("Error:", e)
    # --- add this to the bottom of src/backend/database.py ---
def get_db():
    """Return the shared MongoDB database handle."""
    return db
