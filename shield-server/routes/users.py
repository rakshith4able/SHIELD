from flask import Blueprint, request, jsonify,current_app
from firebase_admin import auth
from functools import wraps
from datetime import datetime,timezone
from firebase_service import db
from firebase_admin.firestore import FieldFilter 
import json
from threading import Timer


users_bp = Blueprint('users', __name__)

def verify_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'message': 'No token provided'}), 401
        
        token = auth_header.split('Bearer ')[1]
        try:
            decoded_token = auth.verify_id_token(token)
            request.user = decoded_token
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'message': 'Invalid token'}), 401
            
    return decorated_function

@users_bp.route('/user/me', methods=['GET'])
@verify_token
def get_current_user():
    # Extract user ID from the token
    user_id = request.user['uid']

    # Retrieve the user's data from Firestore (replace with your actual Firestore query)
    user_ref = db.collection('users').document(user_id)
    user_data = user_ref.get()

    if not user_data.exists:
        return jsonify({"message": "User not found"}), 404

    user_data = user_data.to_dict()

    return jsonify({
        "id": user_id,
        "email": user_data['email'],
        "name": user_data.get('name'),
        "photoURL": user_data.get('photoURL'),
        "isFaceTrained": user_data.get('isFaceTrained'),
        "isValidated": user_data.get('isValidated'),
        "canAccessSecureRoute":user_data.get('canAccessSecureRoute'),
        "role":user_data.get('role')
    })

@users_bp.route('/user/me', methods=['PUT'])
@verify_token
def update_current_user():
    # Extract user ID from the token
    user_id = request.user['uid']
    
    # Get the data to update
    data = request.get_json()

    # Validate the input (e.g., ensure email is not missing)
    email = data.get('email')
    if email:
        if not email.lower().endswith('@gmail.com'):
            return jsonify({'message': 'Only Gmail addresses are allowed'}), 400
    
    # Update the current user's profile in Firestore
    user_ref = db.collection('users').document(user_id)
    user_data = user_ref.get()

    if not user_data.exists:
        return jsonify({"message": "User not found"}), 404

    # Update user fields based on the provided data
    user_ref.update({
        'name': data.get('name', user_data.get('name')),
        'photoURL': data.get('photoURL', user_data.get('photoURL')),
        'email': email or user_data.get('email'),
        'updatedAt': datetime.now(timezone.utc)
    })

    return jsonify({"message": "User profile updated successfully"})

@users_bp.route('/users', methods=['GET'])
@verify_token
def get_users():
    if request.user.get('role') != 'admin':
        return jsonify({'message': 'Permission denied. Admin role required.'}), 403
    try:
        users_ref = db.collection('users').where(filter=FieldFilter("role", "==", 'user'))
        users = []
        for doc in users_ref.stream():
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            users.append(user_data)
        return jsonify(users)
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@users_bp.route('/users', methods=['POST'])
@verify_token
def create_user():
    if request.user.get('role') != 'admin':
        return jsonify({'message': 'Permission denied. Admin role required.'}), 403
    try:
        data = request.get_json()
        email = data.get('email')

        # Validate required email field
        if not email:
            return jsonify({'message': 'Email is required'}), 400
        if not email.lower().endswith('@gmail.com'):
            return jsonify({'message': 'Only Gmail addresses are allowed'}), 400

        # Check if a user with this email already exists in Firestore
        existing_users = db.collection('users').where(filter=FieldFilter('email', '==', email)).get()
        if existing_users:
            return jsonify({'message': 'Email already exists'}), 400

        # Generate a unique ID for the user
        user_id = db.collection('users').document().id

        # Prepare user data
        user_data = {
            'id': user_id,
            'name': None,           
            'photoURL': None,       
            'email': email,
            'role': 'user',           
            'isFaceTrained': False, 
            'isValidated': False,   
            'canAccessSecureRoute':False,
            'createdAt': datetime.now(timezone.utc),  
            'updatedAt': datetime.now(timezone.utc)   
        }

        # Store user data in Firestore
        user_ref = db.collection('users').document(user_id)
        user_ref.set(user_data)

        return jsonify({'message': 'User created successfully', 'user': user_data}), 201
    except Exception as e:
        return jsonify({'message': str(e)}), 500
    
    
@users_bp.route('/users/<id>', methods=['DELETE'])
@verify_token
def delete_user(id):
    if request.user.get('role') != 'admin':
        return jsonify({'message': 'Permission denied. Admin role required.'}), 403

    try:
        # Log the user ID received in the URL for debugging purposes
        current_app.logger.info(f"Attempting to delete user with Firestore document ID: {id}")

        # Search Firestore for user by Firestore document ID
        user_ref = db.collection('users').where(filter=FieldFilter('id', '==', id)).limit(1)
        user_docs = user_ref.get()

        if not user_docs:
            return jsonify({'message': 'User not found in Firestore'}), 404

        # Get Firestore user data and email
        user_data = user_docs[0].to_dict()
        email = user_data.get('email')

        # Attempt to delete the user from Firebase Authentication
        try:
            firebase_user = auth.get_user(id)
            # If the user exists in Firebase Authentication, delete them from Firebase
            auth.delete_user(firebase_user.uid)
            current_app.logger.info(f"User with UID {id} deleted from Firebase Authentication.")
        except auth.UserNotFoundError:
            # If the user does not exist in Firebase Authentication, log and continue
            current_app.logger.info(f"User with UID {id} not found in Firebase Authentication, skipping deletion.")

        # Delete the user from Firestore
        db.collection('users').document(user_docs[0].id).delete()
        current_app.logger.info(f"User with Firestore document ID {id} and email {email} deleted successfully.")

        return jsonify({'message': f'User {email} deleted successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error during user deletion: {str(e)}")
        return jsonify({'message': str(e)}), 500

@users_bp.route('/set_secure_access/<string:user_id>', methods=['PATCH'])
@verify_token
def set_secure_access(user_id):
    try:
        # Reference to the user document
        user_ref = db.collection('users').document(user_id)

        # Update `canAccessSecureRoute` to True
        user_ref.update({"canAccessSecureRoute": True})

        # Function to reset `canAccessSecureRoute` to False
        def reset_access():
            user_ref.update({"canAccessSecureRoute": False})

        # Schedule the reset after 30 seconds
        Timer(30.0, reset_access).start()

        return jsonify({"message": f"Access granted for user {user_id} for 30 seconds"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
