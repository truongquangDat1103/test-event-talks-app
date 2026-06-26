# BigQuery Release Hub

A premium, modern web dashboard built with **Python Flask** and plain **HTML5, CSS3, and JavaScript (ES6)**. It aggregates Google BigQuery release notes from the official Atom XML feed, parses them into searchable and filterable cards, and features an interactive Twitter share composer with live post previews.

## 📁 Project Structure

- `app.py`: Flask application server and REST API.
- `feed_parser.py`: XML Atom feed parser, text cleaner, and local caching module.
- `requirements.txt`: Python package dependencies.
- `templates/index.html`: Dashboard template containing layouts and the X share modal.
- `static/css/style.css`: Sleek glassmorphic dark-theme styles, badges, and animations.
- `static/js/app.js`: API fetching, card rendering, filtering/search, and Twitter compose state.

## 🚀 Quick Start

1. Ensure Python 3.8+ is installed.
2. Initialize and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the application:
   ```bash
   python app.py
   ```
5. Open your browser and navigate to **http://127.0.0.1:5000**.
