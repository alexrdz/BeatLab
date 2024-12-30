from flask import Flask, render_template, jsonify, send_from_directory
import os
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = "music-sequencer-key"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/presets')
def get_presets():
    preset_path = os.path.join(app.static_folder, 'samples')
    presets = {}

    # Create samples directory if it doesn't exist
    if not os.path.exists(preset_path):
        os.makedirs(preset_path)

    # Categories of samples
    categories = ['drums', 'bass', 'melody', 'fx']

    for category in categories:
        category_path = os.path.join(preset_path, category)
        if not os.path.exists(category_path):
            os.makedirs(category_path)

        # Get all audio files in the category
        if os.path.exists(category_path):
            presets[category] = [
                f for f in os.listdir(category_path) 
                if f.endswith(('.wav', '.mp3', '.ogg'))
            ]

    return jsonify(presets)

@app.route('/static/samples/<category>/<filename>')
def serve_sample(category, filename):
    return send_from_directory(os.path.join(app.static_folder, 'samples', category), filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)