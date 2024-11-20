import firebase_admin
from firebase_admin import credentials,firestore

# Initialize Firebase Admin
cred = credentials.Certificate('./firebase_service.json')
firebase_admin.initialize_app(cred)
db = firestore.client()