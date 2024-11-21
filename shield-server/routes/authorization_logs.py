from flask import Blueprint, jsonify, request
from firebase_admin import firestore

db = firestore.client()  # Firestore client
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.route('/authorization_logs', methods=['GET'])
def get_authorization_logs():
    """
    Fetch all authorization logs or filter them based on query parameters.
    Query params supported:
    - email (Filter by user_email)
    - authorized (Filter by authorized status)
    """
    try:
        logs_ref = db.collection('authorization_logs')
        query_params = request.args

        # Apply filters based on query params
        if 'email' in query_params:
            logs_ref = logs_ref.where('user_email', '==', query_params['email'])
        if 'authorized' in query_params:
            authorized = query_params['authorized'].lower() == 'true'
            logs_ref = logs_ref.where('authorized', '==', authorized)

        logs = []
        for doc in logs_ref.stream():
            log_data = doc.to_dict()
            log_data['id'] = doc.id  # Include document ID for frontend reference
            logs.append(log_data)

        return jsonify(logs), 200
    except Exception as e:
        return jsonify({'message': str(e)}), 500