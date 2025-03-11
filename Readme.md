# Image Editor Teditor

## Overview
Image Editor Teditor is a web-based application that allows users to edit images with various tools and filters. This project is deployed using Flask and Vercel.

## File Structure
Ensure the file structure is as follows:
- `static/` - Contains static files like CSS, JavaScript, and images.
- `templates/index.html` - The main HTML file served by Flask.
- `index.py` - The main Flask application file.
- `vercel.json` - Configuration file for Vercel deployment.
- `requirements.txt` - List of Python dependencies.

## Deployment on Vercel

### Step 1: Create a Git Repository
Create a new repository on GitHub and push your project files to it.

### Step 2: Prepare Your Files
Ensure your project has the following structure:
```
/static
/templates
  └── index.html
index.py
vercel.json
requirements.txt
```

### Step 3: Flask Application
In `index.py`, ensure you have the following code to serve `index.html`:
```python
from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    app.run()
```

### Step 4: Vercel Configuration
Create a `vercel.json` file with the following content:
```json
{
  "version": 2,
  "builds": [
    { "src": "index.py", "use": "@vercel/python" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "index.py" }
  ]
}
```

### Step 5: Install Dependencies
List all your dependencies in `requirements.txt`:
```
Flask==2.0.1
```

### Step 6: Deploy to Vercel
1. Log in to Vercel and create a new project.
2. Link your GitHub repository to Vercel.
3. Vercel will automatically detect the `vercel.json` file and deploy your project.

## Usage
Once deployed, you can access your application via the Vercel link provided. Use the link to start the app anywhere and anytime.
