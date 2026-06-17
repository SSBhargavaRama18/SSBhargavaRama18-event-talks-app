# BigQuery Release Notes Hub & X Composer

A premium web dashboard that parses the official Google Cloud BigQuery release notes, classifies updates into granular cards, and provides an interactive interface to customize, compose, and draft announcements to post on Twitter/X or simulate internally.

Built using **Python Flask** on the backend and vanilla **HTML5, CSS3, and JavaScript (ES6)** on the frontend.

---

## ✨ Features

- **Live BigQuery Feed parsing**: Fetches and parses the official BigQuery Atom feed XML in real time.
- **Granular Update Splitter**: Google Cloud releases are typically aggregated by date. The frontend dynamically parses the entry markup to split aggregated updates into standalone cards categorized as `Feature`, `Announcement`, `Issue`, or `Deprecation`.
- **Tone Customization Engine**: Select a card and format your tweet draft automatically using **Technical 🤖**, **Excited 🎉**, **Punchy ⚡**, or **Formal 💼** styling templates.
- **Mock Twitter/X Composer & Preview Card**: Features an interactive editor with:
  - SVG-based circular progress gauge for the 280-character limit.
  - Live preview mockup card mimicking X/Twitter's dark mode UI, complete with a BigQuery link card attachment.
- **Simulated X Feed**: Post drafts to a virtual live feed inside the app. Engage with posts via interactive **Likes** ❤️ and **Retweets** 🔁 that persist in-memory on the backend.
- **Automatic Offline Recovery**: Falls back to offline mock datasets if the Google Cloud feed server is down or if there is no internet connection.

---

## 🛠️ Tech Stack

- **Backend**: Python 3 (Flask)
- **Frontend**: HTML5, Vanilla CSS3 (Custom properties, grid, flexbox, keyframes), JavaScript (ES6, DOMParser API, Fetch API, standard SVGs)
- **XML Parsing**: Python standard library `xml.etree.ElementTree`

---

## 📁 Repository Structure

```text
├── app.py                  # Main Flask backend, XML parser, and simulated DB APIs
├── requirements.txt        # Python dependencies
├── .gitignore              # Ignored files (caches, environments, IDE setups)
├── templates/
│   └── index.html          # Semantic HTML dashboard template
└── static/
    ├── css/
    │   └── styles.css      # Core styles, glassmorphic layout, glowing badges, animations
    └── js/
        └── app.js          # DOM splitter parser, tone composer, and state binders
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Python 3** installed:
```bash
python --version
```

### Installation
1. Clone this repository (or navigate to the workspace directory).
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application
Start the Flask development server:
```bash
python app.py
```

The server will initialize on port 5000:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 💡 How to Use

1. **Browse**: Open the dashboard to see latest timeline notes. Use the search bar to query keywords, or filter by clicking category tags (Features, Announcements, Issues).
2. **Sync**: Click **Refresh** in the header to sync with Google Cloud's live feed at any time.
3. **Draft**: Click the **Share** button on any update card. This loads it directly into the composer.
4. **Tune**: Select a tone (e.g., *Excited*) to reformulate the text template automatically.
5. **Publish / Simulate**:
   - Click **Post on X** to open a new tab with a pre-populated Twitter/X Intent window ready to publish.
   - Click **Simulate** to post it to the internal simulated feed, where you can like and retweet posts to watch the engagement counters scale!
