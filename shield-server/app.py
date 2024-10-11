from flask import Flask
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import base64
import os
from flask_cors import CORS
from PIL import Image
import traceback
import pickle
import time

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Ensure the dataset and trainer directories exist
for dir in ['dataset', 'trainer']:
    if not os.path.exists(dir):
        os.makedirs(dir)

# Dictionary to track frames per user
user_frame_count = {}

face_detector = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')

# Use LBPH Face Recognizer for better performance with incremental learning
recognizer = cv2.face.LBPHFaceRecognizer_create()

# Global variable to store user IDs and names
user_data = {}
filename=None

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
    # Decode the base64 image
    encoded_data = image_data.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces = face_detector.detectMultiScale(gray, 1.3, 5)

    face_data = []
    # Define the folder path for the user's images
    user_folder = f"dataset/{face_id}"
    os.makedirs(user_folder, exist_ok=True)

    for (x, y, w, h) in faces:
        face_data.append({
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h)
        })

        # Save the captured image into the user's folder
        existing_images = len(os.listdir(user_folder))
        filename = f"{user_folder}/{face_id}.{existing_images + 1}.jpg"
   
        cv2.imwrite(filename, gray[y:y+h, x:x+w])

    return face_data, filename

def train_model_incrementally(new_face_id):
    global user_data
    
    new_face_samples = []
    new_face_labels = []
    
    # Process new face images
    user_folder = f"dataset/{new_face_id}"
    for image_file in os.listdir(user_folder):
        image_path = os.path.join(user_folder, image_file)
        face_image = Image.open(image_path).convert('L')
        face_array = np.array(face_image, 'uint8')
        
        faces = face_detector.detectMultiScale(face_array)
        
        for (x, y, w, h) in faces:
            new_face_samples.append(face_array[y:y+h, x:x+w])
            new_face_labels.append(len(user_data))  # Assign a new label
    
    # Update user data
    user_data[len(user_data)] = new_face_id
    save_user_data()
    
    # If it's the first face, train the model from scratch
    if len(user_data) == 1:
        recognizer.train(new_face_samples, np.array(new_face_labels))
    else:
        # Update the existing model incrementally
        recognizer.update(new_face_samples, np.array(new_face_labels))
    
    # Save the updated model
    recognizer.save('trainer/trainer.yml')
    
    return len(user_data)

@socketio.on('upload_image')
def handle_upload(data):
    image_data = data['image']
    face_id = data['face_id']

    if face_id not in user_frame_count:
        user_frame_count[face_id] = 0

    face_data, filename = process_frame(image_data, face_id)
    user_frame_count[face_id] += 1

    emit('frame_captured', {
        'faces': face_data,
        'status': f"Captured frame {user_frame_count[face_id]}/120",
        'progress': (user_frame_count[face_id] / 120) * 100
    })

    if user_frame_count[face_id] >= 120:
        emit('capture_completed', {'status': "Capture completed. Starting training..."})
        trained_faces = train_model_incrementally(face_id)
        emit('training_completed', {
            'status': f"Training completed. {trained_faces} faces trained.",
            'trained_faces': trained_faces
        })
        user_frame_count[face_id] = 0



@socketio.on('recognize_face')
def handle_recognition(data):
    image_data = data['image']
    username = data['username']

    # Decode the base64 image
    encoded_data = image_data.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Detect faces
    faces = face_detector.detectMultiScale(gray, 1.3, 5)

    recognition_results = []
    confidence_threshold = 70  # Lowered for better matching

    for (x, y, w, h) in faces:
        # Perform face recognition
        id_, confidence = recognizer.predict(gray[y:y+h, x:x+w])

        # Assign a name based on the ID
        name = user_data.get(id_, "Unknown")
        confidence = round(100 - confidence, 2)

        recognition_results.append({
            "x": int(x),
            "y": int(y),
            "width": int(w),
            "height": int(h),
            "name": name,
            "confidence": confidence
        })

    # Emit recognition results immediately
    emit('recognition_result', {'faces': recognition_results, 'status': 'Processing'})

@socketio.on('get_final_authorization')
def get_final_authorization(data):
    recognized_faces = data['recognizedFaces']
    username = data['username'].lower()
    
    authorized = False
    recognized_name = ""
    highest_confidence = 0
    
    
    for face in recognized_faces:
        if face['confidence'] > highest_confidence:
            highest_confidence = face['confidence']
            recognized_name = face['name']
    
  
    # Check if the recognized name matches the username (case-insensitive)
    if highest_confidence > 50 and (username in recognized_name.lower() or recognized_name.lower() in username):
        authorized = True
    
    print(recognized_faces,highest_confidence,username,recognized_name)
    if authorized:
        emit('final_authorization', {'status': 'Authorized', 'recognizedAs': recognized_name})
    else:
        emit('final_authorization', {'status': 'Unauthorized'})

if __name__ == '__main__':
    load_user_data()
    if os.path.exists('trainer/trainer.yml'):
        recognizer.read('trainer/trainer.yml')
    socketio.run(app, debug=True, port=5000)