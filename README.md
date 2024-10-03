# S.H.I.E.L.D.

**Secure Human Identification using Enhanced Liveness Detection**

## Overview

S.H.I.E.L.D. is a secure access control system that aims to use real-time facial recognition for allowing only authorized users to access restricted areas. The system is being built with a Flask backend and a Next.js frontend. Currently, face data collection through sockets and OpenCV has been implemented as a foundational step toward real-time facial recognition.

## Current Implementation Stage

- **Face Data Collection**: Implemented face data collection using **OpenCV** for capturing video frames and **sockets** for transmitting data in real-time.

---

## Project Structure

### Backend: Flask

The backend is responsible for handling face data collection and, later, user management and authorization through facial recognition.

#### Libraries:

- **OpenCV**: For capturing and processing video frames.
- **Flask-SocketIO**: For handling real-time socket communication between the client and server.

#### Current Functionalities:

1. **Real-time Face Data Collection**: Captures video frames via OpenCV and sends them through socket connections.

---

## Future Implementation Plan

### Backend (Upcoming):

- **Facial Recognition**: Implement the LPBH algorithm to train and recognize faces based on the collected data.
- **Google Sign-In**: Add Google Sign-In functionality for authentication.
- **User Management**: Enable the admin to manage authorized users (name, email, photos) in the system.

### Frontend (Upcoming):

- **Firebase Authentication**: Integrate Firebase for handling user login and authorization.
- **Video Capture for Authentication**: Capture live video from the user's device for authentication purposes.

---

## Installation and Setup

### Backend (Flask):

1. Clone the repository and navigate to `shield-server` (assuming it's structured this way).
   ```bash
   git clone <repo-url>
   cd shield-server
   ```
