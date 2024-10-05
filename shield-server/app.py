from flask import Flask
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import base64
import os
from flask_cors import CORS


app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")


# Ensure the dataset directory exists
if not os.path.exists('dataset'):
    os.makedirs('dataset')
    
# Dictionary to track frames per user
user_frame_count = {}

face_detector = cv2.CascadeClassifier('haarcascade_frontalface_default.xml')

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

    return face_data

@socketio.on('upload_image')
def handle_upload(data):
    image_data = data['image']
    face_id = data['face_id']

    # Initialize frame count for the user if not already set
    if face_id not in user_frame_count:
        user_frame_count[face_id] = 0

    # Process the frame
    face_data = process_frame(image_data, face_id)
    
    # Increment the frame count for the user
    user_frame_count[face_id] += 1

    # Send back the face detection data (rectangle overlay)
    emit('frame_captured', {'faces': face_data})

    # Check if 30 frames have been captured for this user
    if user_frame_count[face_id] >= 30:
        emit('frame_captured', {'completed': True})
        # Optionally reset the frame count for this user, if needed for future sessions
        user_frame_count[face_id] = 0


if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)