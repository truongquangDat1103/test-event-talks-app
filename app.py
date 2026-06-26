import os
from flask import Flask, jsonify, render_template, request
from feed_parser import get_releases

app = Flask(__name__)

# Route to serve the main frontend page
@app.route('/')
def index():
    return render_template('index.html')

# API endpoint to fetch parsed releases
@app.route('/api/releases')
def api_releases():
    # Check if frontend wants to bypass cache and force-refresh
    bypass_cache = request.args.get('refresh', 'false').lower() == 'true'
    
    releases, last_fetched, cached, error = get_releases(bypass_cache=bypass_cache)
    
    response_data = {
        'success': not error or len(releases) > 0,
        'releases': releases,
        'last_fetched': last_fetched,
        'cached': cached,
        'error': error
    }
    
    return jsonify(response_data)

if __name__ == '__main__':
    # Run Flask app on port 5000 in debug mode
    # Using 127.0.0.1 (localhost) is default and standard
    app.run(host='127.0.0.1', port=5000, debug=True)
