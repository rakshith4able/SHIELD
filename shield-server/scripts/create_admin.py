import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin.firestore import FieldFilter 
from datetime import datetime, timezone

# Initialize Firebase Admin SDK
cred = credentials.Certificate("../firebase_service.json")
firebase_admin.initialize_app(cred)

# Firestore reference
db = firestore.client()

def create_user(email):
    try:
        # Check if the user already exists in the 'users' collection
        docs = (db.collection("users").where(filter=FieldFilter("email", "==", email)).stream())
        existing_user = None
        for doc in docs:
            existing_user = doc.to_dict()
            break 
        if existing_user:
            print(f"User with email {email} already exists.")
            print(existing_user)
            return None

        # User document data
        user_data = {
            "id": None,  # Will remain None unless explicitly set
            "name": None,  # Default value
            "photoURL": None,  # Default value
            "email": email,  # User's email
            "role": "admin",  # Admin role by default
            "isFaceTrained": False,  # Default value
            "isValidated": False,  # Default value
            "createdAt": datetime.now(timezone.utc),  # Timestamp for creation
            "updatedAt": datetime.now(timezone.utc),  # Timestamp for updates
        }

        # Add user to Firestore 'users' collection
        user_ref = db.collection("users").document()
        user_data["id"] = user_ref.id  # Set the Firestore document ID as user ID
        user_ref.set(user_data)

        print(f"User created successfully with ID: {user_ref.id}")
        return user_ref.id

    except Exception as e:
        print(f"Error creating user: {e}")
        return None

# Example usage
email = "rakshithraj.gp@gmail.com"
create_user(email)
