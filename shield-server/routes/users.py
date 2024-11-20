from flask import Blueprint, request, jsonify,current_app
from firebase_admin import auth
from functools import wraps
from datetime import datetime
from firebase_service import db

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

@users_bp.route('/users', methods=['GET'])
@verify_token
def get_users():
    try:
        users_ref = db.collection('users')
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

        if not email:
            return jsonify({'message': 'Email is required'}), 400
            
        if not email.lower().endswith('@gmail.com'):
            return jsonify({'message': 'Only Gmail addresses are allowed'}), 400

        # Create user in Firebase Authentication
        user = auth.create_user(
            email=email,
            email_verified=False
        )

        # Store additional user data in Firestore
        user_ref = db.collection('users').document(user.uid)
        user_ref.set({
            'email': email,
            'createdAt': datetime.utcnow().isoformat(),
        })

        return jsonify({'message': 'User created successfully'}), 201
    except auth.EmailAlreadyExistsError:
        return jsonify({'message': 'Email already exists'}), 400
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

