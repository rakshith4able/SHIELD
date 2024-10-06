from flask import Flask
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import base64
import os
from flask_cors import CORS
from PIL import Image

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


# Try to use the face module, fall back to a basic implementation if not available
try:
    recognizer = cv2.face.LBPHFaceRecognizer_create()
except AttributeError:
    print("OpenCV face module not available. Using basic implementation.")
    class BasicRecognizer:
        def __init__(self):
            self.trained_data = []
        
        def train(self, faces, labels):
            self.trained_data = list(zip(faces, labels))
        
        def write(self, filename):
            np.save(filename, self.trained_data)
        
        def read(self, filename):
            self.trained_data = np.load(filename, allow_pickle=True)
    
    recognizer = BasicRecognizer()

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

    return face_data,filename

def train_model():
    path = 'dataset'
    folder_paths = [os.path.join(path, f) for f in os.listdir(path) if os.path.isdir(os.path.join(path, f))]
    faceSamples = []
    ids = []

    for folderPath in folder_paths:
        folder_name = os.path.basename(folderPath)  # Use the folder name as the identifier

        try:
            for image_file in os.listdir(folderPath):
                full_image_path = os.path.join(folderPath, image_file)
                process_image(full_image_path, faceSamples, ids, folder_name)  # Pass folder_name as the ID
        except Exception as e:
            print(f"Error processing {folderPath}: {str(e)}")
            continue

    if not faceSamples or not ids:
        print("No faces could be processed. Training aborted.")
        return 0, "No faces could be processed. Please check the dataset folder."

    try:
        recognizer.train(faceSamples, np.array(ids))  # Train with folder names as IDs
        recognizer.write('trainer/trainer.yml')
        return len(np.unique(ids)), "Training completed successfully."
    except Exception as e:
        print(f"Error during training: {str(e)}")
        return 0, f"Error during training: {str(e)}"

def process_image(image_path, faceSamples, ids, folder_name):
    PIL_img = Image.open(image_path).convert('L')
    img_numpy = np.array(PIL_img, 'uint8')

    # Use the folder name as the identifier instead of an integer
    id = folder_name

    faces = face_detector.detectMultiScale(img_numpy)

    for (x, y, w, h) in faces:
        faceSamples.append(img_numpy[y:y+h, x:x+w])
        ids.append(id)  # Append folder name (id)

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
        'status': f"Captured frame {user_frame_count[face_id]}/30",
        'progress': (user_frame_count[face_id] / 30) * 100
    })

    if user_frame_count[face_id] >= 30:
        emit('capture_completed', {'status': "Capture completed. Starting training..."})
        trained_faces = train_model()
        emit('training_completed', {
            'status': f"Training completed. {trained_faces} faces trained.",
            'trained_faces': trained_faces
        })
        user_frame_count[face_id] = 0

@socketio.on('start_training')
def handle_training():
    emit('training_started', {'status': "Training started..."})
    try:
        trained_faces, message = train_model()
        if trained_faces > 0:
            emit('training_completed', {
                'status': f"Training completed. {trained_faces} faces trained.",
                'trained_faces': trained_faces
            })
        else:
            emit('training_error', {
                'status': f"Training failed. {message}"
            })
    except Exception as e:
        error_message = f"An unexpected error occurred: {str(e)}\n{traceback.format_exc()}"
        print(error_message)
        emit('training_error', {
            'status': "An unexpected error occurred. Please check server logs for details."
        })
        
if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)