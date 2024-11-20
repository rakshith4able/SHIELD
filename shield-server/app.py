from flask import Flask,request,jsonify
from flask_socketio import SocketIO, emit,disconnect
import cv2
import numpy as np
import base64
import os
from flask_cors import CORS
from PIL import Image
import pickle
from firebase_admin import auth, firestore
from functools import wraps
import logging
from firebase_service import db
from firebase_admin.firestore import FieldFilter,SERVER_TIMESTAMP
import json

app = Flask(__name__)
# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Log level (e.g., DEBUG, INFO, WARNING, ERROR)
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)

# Create a logger for the app
app.logger.setLevel(logging.INFO)

CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type", "Authorization"],
        "max_age": 3600,
     
    }
})


socketio = SocketIO(app, cors_allowed_origins="*")

from routes.users import users_bp
app.register_blueprint(users_bp)

# Ensure the dataset and trainer directories exist
for dir in ['dataset', 'trainer']:
    if not os.path.exists(dir):
        os.makedirs(dir)

# Dictionary to track frames per user
user_frame_count = {}

face_detector = cv2.CascadeClassifier('./haarcascade_frontalface_default.xml')

# Use LBPH Face Recognizer for better performance with incremental learning
recognizer = cv2.face.LBPHFaceRecognizer_create()

# Global variable to store user IDs and names
user_data = {}
filename=None



def verify_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            decoded_token = auth.verify_id_token(token)
            return f(decoded_token, *args, **kwargs)
        except Exception as e:
            return jsonify({'message': 'Invalid token'}), 401
    
    return decorated_function

@app.route('/verify-user', methods=['POST'])
def verify_user():
    data = request.get_json()
    if not data or 'token' not in data:
        return jsonify({'authorized': False}), 400

    try:
        # Verify the Firebase token
        decoded_token = auth.verify_id_token(data['token'])
        user_email = decoded_token['email']
        firebase_uid = decoded_token['uid']

        # Check if the user exists in Firestore
        users_ref = db.collection('users')
        user_doc = users_ref.where('email', '==', user_email).limit(1).get()

        if not len(user_doc):
            # If user doesn't exist in Firestore, do not add to Firebase Auth
            return jsonify({
                'authorized': False,
                'message': 'User does not exist in Firestore. User not added to Firebase Authentication.'
            }), 404

        # If user exists, retrieve user data
        user_data = user_doc[0].to_dict()

        # Get the Firestore document reference and ID
        old_user_ref = user_doc[0].reference
        old_user_id = user_doc[0].id

        # Update Firestore document fields
        old_user_ref.update({
            'isValidated': True,  # Change from False to True
            'name': decoded_token.get('name', user_data.get('name', '')),  # Set fullName if available
            'photoURL': decoded_token.get('picture', user_data.get('photoURL', '')),  # Update photoURL if available
            'updatedAt': firestore.SERVER_TIMESTAMP  # Set updated timestamp
        })
         
        # Set custom claims for the user in Firebase Authentication (only first time)
        if not user_data.get('isValidated', False):
            # Set custom claims for the user in Firebase Authentication
            user_role = user_data.get('role', 'user')  # Get role from Firestore
            auth.set_custom_user_claims(firebase_uid, {'role': user_role})

        # Sync Firestore document ID with Firebase UID
        if old_user_id != firebase_uid:
            # Create a new document with Firebase UID as the document ID
            new_user_ref = users_ref.document(firebase_uid)

            # Copy all the data from the old document to the new one
            new_user_ref.set({
                **user_data,
                'uid': firebase_uid,  # Ensure the new document has the correct UID
                'id': firebase_uid  # Sync Firestore document ID with Firebase UID
            })

            # Delete the old document to avoid duplication
            old_user_ref.delete()

        return jsonify({
            'authorized': True,
            'role': user_data.get('role', 'user'),
            'isNewUser': False
        })

    except Exception as e:
        return jsonify({
            'authorized': False,
            'message': str(e)
        }), 401
        
def authenticated_only(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if not request.args.get('token'):
            disconnect()
            return False
        
        try:
            # Verify the Firebase token
            token = request.args.get('token')
            decoded_token = auth.verify_id_token(token)
            
            # Get user info from Firestore
            user_ref = db.collection('users').where('email', '==', decoded_token['email']).limit(1).get()
            
            if not len(user_ref):
                disconnect()
                return False
            
            # Add user info to the request context
            request.user = {
                'email': decoded_token['email'],
                'uid': decoded_token['uid'],
                'role': user_ref[0].to_dict().get('role', 'user')
            }
            
            return f(*args, **kwargs)
        except:
            disconnect()
            return False
    return wrapped

def authenticated_only_socketio(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        # Get the token from the connection's query params using the Flask request
        token = request.args.get('token')
        if not token:
            print("Token is missing, disconnecting socket")
            disconnect()
            return False

        try:
            # Verify the Firebase token
            decoded_token = auth.verify_id_token(token)
            
            # Get user info from Firestore
            user_ref = db.collection('users').where('email', '==', decoded_token['email']).limit(1).get()
            
            if not len(user_ref):
                print("User not found in Firestore, disconnecting socket")
                disconnect()
                return False

            # Attach user info to the socket session (use socketio.session for session storage)
            # This will be available throughout the socket connection
            request.user = {
                'email': decoded_token['email'],
                'uid': decoded_token['uid'],
                'role': user_ref[0].to_dict().get('role', 'user')
            }
         
            # Call the original function
            return f(*args, **kwargs)

        except Exception as e:
            print(f"Error verifying token: {str(e)}")
            disconnect()
            return False

    return wrapped

def load_user_data():
    global user_data
    # Ensure the trainer directory exists
    if not os.path.exists('trainer'):
        os.makedirs('trainer')  # Create the directory if it doesn't exist
        
    if os.path.exists('trainer/user_data.pkl'):
        with open('trainer/user_data.pkl', 'rb') as f:
            user_data = pickle.load(f)
    else:
        user_data = {}

def save_user_data():
    # Ensure the trainer directory exists
    if not os.path.exists('trainer'):
        os.makedirs('trainer')  # Create the directory if it doesn't exist
        
    with open('trainer/user_data.pkl', 'wb') as f:
        pickle.dump(user_data, f)


def process_frame(image_data, face_id):
    """Process a single frame for face detection and save it."""
    try:
        # Decode the base64 image
        encoded_data = image_data.split(',')[1]
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Invalid image data")

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Detect faces with improved parameters
        faces = face_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(120, 120),  # Increased minimum face size for better quality
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        if len(faces) != 1:
            return None, None, "Please ensure exactly one face is visible in the frame"

        face_data = []
        user_folder = f"dataset/{face_id}"
        os.makedirs(user_folder, exist_ok=True)

        x, y, w, h = faces[0]
        # Add padding to the face region
        padding = 20
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(w + 2 * padding, img.shape[1] - x)
        h = min(h + 2 * padding, img.shape[0] - y)

        face_data.append({
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h)
        })

        # Apply histogram equalization for better contrast
        face_roi = gray[y:y+h, x:x+w]
        face_roi = cv2.equalizeHist(face_roi)

        # Save the processed face image
        existing_images = len(os.listdir(user_folder))
        filename = f"{user_folder}/{face_id}.{existing_images + 1}.jpg"
        cv2.imwrite(filename, face_roi)

        return face_data, filename, None

    except Exception as e:
        app.logger.error(f"Error processing frame: {str(e)}")
        return None, None, str(e)
    
def train_model_incrementally(new_face_id):
    """Train the face recognition model with improved error handling and validation."""
    global user_data
    
    try:
        new_face_samples = []
        new_face_labels = []
        label_id = len(user_data)
        
        user_folder = f"dataset/{new_face_id}"
        if not os.path.exists(user_folder):
            raise ValueError(f"No training data found for user {new_face_id}")

        # Process all images for the new face
        for image_file in os.listdir(user_folder):
            if not image_file.endswith(('.jpg', '.jpeg', '.png')):
                continue
                
            image_path = os.path.join(user_folder, image_file)
            face_array = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
            
            if face_array is None:
                continue
                
            faces = face_detector.detectMultiScale(
                face_array,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(120, 120)
            )
            
            for (x, y, w, h) in faces:
                face_roi = face_array[y:y+h, x:x+w]
                # Resize to ensure consistent size
                face_roi = cv2.resize(face_roi, (200, 200))
                new_face_samples.append(face_roi)
                new_face_labels.append(label_id)

        if not new_face_samples:
            raise ValueError("No valid face samples found in the training data")

        # Update user data and save
        user_data[str(label_id)] = new_face_id
        save_user_data()

        # Train or update the model
        if len(user_data) == 1:
            recognizer.train(new_face_samples, np.array(new_face_labels))
        else:
            recognizer.update(new_face_samples, np.array(new_face_labels))

        # Save the updated model
        recognizer.save('trainer/trainer.yml')
        
        return len(user_data)

    except Exception as e:
        app.logger.error(f"Error training model: {str(e)}")
        raise

@socketio.on('connect')
@authenticated_only_socketio
def handle_connect(data):

    if not request.args.get('token'):
        disconnect()
        return False
    
    try:
        token = request.args.get('token')
        decoded_token = auth.verify_id_token(token)
        return True
    except:
        disconnect()
        return False

@socketio.on('upload_image')
@authenticated_only_socketio
def handle_upload(data):
    """Handle image upload with improved validation and error handling."""
    try:
        image_data = data['image']
        face_id = data['face_id']

        if not image_data or not face_id:
            emit('frame_error', {'message': 'Invalid request data'})
            return

        if face_id not in user_frame_count:
            user_frame_count[face_id] = 0

        face_data, filename, error = process_frame(image_data, face_id)
        
        if error:
            emit('frame_error', {'message': error})
            return

        if not face_data or not filename:
            emit('frame_error', {'message': 'Failed to process frame'})
            return

        user_frame_count[face_id] += 1
        
        # Calculate quality metrics
        frames_needed = 100  # Reduced from 120 for better efficiency
        current_progress = (user_frame_count[face_id] / frames_needed) * 100

        emit('frame_captured', {
            'faces': face_data,
            'status': f"Captured frame {user_frame_count[face_id]}/{frames_needed}",
            'progress': current_progress
        })

        if user_frame_count[face_id] >= frames_needed:
            emit('capture_completed', {'status': "Capture completed. Starting training..."})
            
            try:
                trained_faces = train_model_incrementally(face_id)
                
                # Log successful training
                db.collection('trained_faces').add({
                    'face_id': face_id,
                    'trained_by': request.user['email'],
                    'trained_at': firestore.SERVER_TIMESTAMP,
                    'frame_count': frames_needed,
                    'status': 'success'
                })

                emit('training_completed', {
                    'status': f"Training completed successfully. {trained_faces} faces trained.",
                    'trained_faces': trained_faces
                })
                
            except Exception as e:
                emit('training_error', {
                    'status': "Training failed",
                    'error': str(e)
                })
                
            finally:
                user_frame_count[face_id] = 0

    except Exception as e:
        app.logger.error(f"Error handling upload: {str(e)}")
        emit('error', {'message': str(e)})

def verify_face(face_roi, username):
    """Verify a face with improved confidence calculation."""
    try:
        # Ensure consistent size
        face_roi = cv2.resize(face_roi, (200, 200))
        
        # Apply preprocessing
        face_roi = cv2.equalizeHist(face_roi)
        
        # Get prediction
        label_id, confidence = recognizer.predict(face_roi)
        
        # Convert confidence to percentage (0-100 scale)
        confidence = round(100 - confidence, 2)
        
        # Get recognized name
        recognized_name = user_data.get(str(label_id), "Unknown")
        
        # Calculate name similarity
        name_similarity = (
            username.lower() in recognized_name.lower() or
            recognized_name.lower() in username.lower()
        )
        
        return {
            'name': recognized_name,
            'confidence': confidence,
            'name_match': name_similarity
        }
        
    except Exception as e:
        app.logger.error(f"Face verification error: {str(e)}")
        return None


def log_authorization_attempt(user_email, recognized_name, confidence, authorized):
    try:
        db.collection('authorization_logs').add({
            'user_email': user_email,
            'recognized_as': recognized_name,
            'confidence': confidence,
            'authorized': authorized,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'ip_address': request.remote_addr
        })
    except Exception as e:
        app.logger.error(f"Error logging authorization attempt: {e}")

@socketio.on('recognize_face')
@authenticated_only_socketio
def handle_recognition(data):
    """Handle face recognition with improved error handling and verification."""
    try:
        image_data = data['image']
        username = data.get('username', '').lower()

        if not image_data or not username:
            raise ValueError("Invalid request data")

        # Decode and process image
        encoded_data = image_data.split(',')[1]
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Invalid image data")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(120, 120)
        )

        recognition_results = []
        
        for (x, y, w, h) in faces:
            face_roi = gray[y:y+h, x:x+w]
            
            if face_roi.size == 0:
                continue

            result = verify_face(face_roi, username)
            if result:
                recognition_results.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                    **result
                })

        emit('recognition_result', {
            'faces': recognition_results,
            'status': 'Processing completed'
        })

    except Exception as e:
        app.logger.error(f"Recognition error: {str(e)}")
        emit('error', {'message': str(e)})

@socketio.on('get_final_authorization')
@authenticated_only_socketio
def get_final_authorization(data):
    """Make final authorization decision with improved security checks."""
    try:
        recognized_faces = data.get('recognizedFaces', [])
        username = data.get('username', '').lower()
        
        if not recognized_faces or not username:
            raise ValueError("Invalid request data")

        # Find best match
        best_match = max(recognized_faces, key=lambda x: x['confidence'])
        
        # Enhanced authorization criteria
        authorized = (
            len(recognized_faces) == 1 and  # Exactly one face detected
            best_match['confidence'] >= 50 and  # Higher confidence threshold
            best_match['name_match'] and  # Name must match
            best_match['name'] != "Unknown"  # Must be a known user
        )

        # Log the authorization attempt
        log_authorization_attempt(
            user_email=request.user['email'],
            recognized_name=best_match['name'],
            confidence=best_match['confidence'],
            authorized=authorized
        )

        emit('final_authorization', {
            'status': 'Authorized' if authorized else 'Unauthorized',
            'recognizedAs': best_match['name'] if authorized else None,
            'confidence': best_match['confidence'],
            'reason': get_authorization_reason(authorized, best_match)
        })

    except Exception as e:
        app.logger.error(f"Authorization error: {str(e)}")
        emit('final_authorization', {
            'status': 'Unauthorized',
            'error': str(e)
        })

def get_authorization_reason(authorized, match):
    """Get detailed reason for authorization decision."""
    if authorized:
        return "Face successfully verified with high confidence"
    
    if match['confidence'] < 60:
        return "Confidence too low for secure verification"
    if not match['name_match']:
        return "Name mismatch"
    if match['name'] == "Unknown":
        return "Unknown face"
    return "Multiple verification criteria not met"
        
if __name__ == '__main__':
    load_user_data()
    if os.path.exists('trainer/trainer.yml'):
        recognizer.read('./trainer/trainer.yml')
 
    socketio.run(app, debug=True, port=5000,use_reloader=True)