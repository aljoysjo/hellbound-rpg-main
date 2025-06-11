from flask import Flask, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route('/api/healthcheck', methods=['GET'])
def healthcheck():
    return jsonify({
        'status': 'healthy',
        'message': 'Simple Flask server is running',
        'openai_key_set': bool(os.environ.get('OPENAI_API_KEY'))
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)