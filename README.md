# S.H.I.E.L.D.

**Secure Human Identification using Enhanced Liveness Detection**

## Overview

S.H.I.E.L.D. is a secure access control system that leverages real-time facial recognition to grant access only to authorized users. The system integrates a Flask backend and a Next.js frontend, using real-time face data collection via sockets and OpenCV to capture frames for facial recognition.

## Current Implementation Stage

- **Face Data Collection**: Implemented face data collection using **OpenCV** for capturing video frames and **sockets** for transmitting data in real-time.

## Project Structure

```
S.H.I.E.L.D/
│
├── shield-client/         # Next.js frontend
│   ├── pages/             # Frontend pages and routes
│   ├── components/        # React components
│   ├── public/            # Static assets like images
│   └── ...
├── shield-server/         # Flask backend
│   ├── app.py             # Main backend server logic
│   ├── requirements.txt   # Python dependencies
│   ├── .venv/             # Python virtual environment
│   └── dataset/           # Collected face data
└── setup.py               # Python script for project setup
```

## Future Implementation Plan

### Backend (Upcoming):

- **Facial Recognition**: Implement the LPBH algorithm to train and recognize faces based on the collected data.
- **Google Sign-In**: Add Google Sign-In functionality for authentication.
- **User Management**: Enable the admin to manage authorized users (name, email, photos) in the system.

### Frontend (Upcoming):

- **Firebase Authentication**: Integrate Firebase for handling user login and authorization.
- **Video Capture for Authentication**: Capture live video from the user's device for authentication purposes.

## Installation and Setup

### Requirements

- Python 3.x
- Node.js and npm
- OpenCV
- Flask-SocketIO

### Setup and run the project with `setup.py`

To install all necessary dependencies and set up the project, follow these steps (this needs to be done only **once**):

1. Clone the repository and navigate to the root of the `S.H.I.E.L.D.` directory:
   ```bash
   git clone <repo-url>
   cd SHIELD
   ```
2. Run the initial setup script:
   ```bash
   python setup.py
   ```
   This script will:

- Install npm dependencies in the shield-client folder.
- Set up a Python virtual environment, activate it, and install all required Python packages in the shield-server folder.
- The script starts the both the server and client in development mode.
- This will:
  - Start the Next.js frontend using npm run dev in the shield-client folder.
  - Activate the Python virtual environment and start the Flask backend using Flask run in the shield-server folder.
