from flask import Blueprint, request, jsonify,current_app
from firebase_admin import auth
from functools import wraps
from datetime import datetime,timezone
from firebase_service import db
from firebase_admin.firestore import FieldFilter 
import json


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
            if decoded_token.get('role') != 'admin':
                return jsonify({'message': 'Permission denied. Admin role required.'}), 403
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'message': 'Invalid token'}), 401
            
    return decorated_function

@users_bp.route('/users', methods=['GET'])
@verify_token
def get_users():
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
            'createdAt': datetime.now(timezone.utc),  
            'updatedAt': datetime.now(timezone.utc)   
        }

        # Store user data in Firestore
        user_ref = db.collection('users').document(user_id)
        user_ref.set(user_data)

        return jsonify({'message': 'User created successfully', 'user': user_data}), 201
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@users_bp.route('/users', methods=['DELETE'])
@verify_token
def delete_user(user_id):
    try:
        # Delete from Firebase Authentication
        auth.delete_user(user_id)
        
        # Delete from Firestore
        db.collection('users').document(user_id).delete()
        
        return jsonify({'message': 'User deleted successfully'}), 200
    except auth.UserNotFoundError:
        return jsonify({'message': 'User not found'}), 404
    except Exception as e:
        return jsonify({'message': str(e)}), 500

