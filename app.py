import os
import cv2
import numpy as np

from flask import Flask, render_template, request, flash
from werkzeug.utils import secure_filename

# Flask app setup
app = Flask(__name__)

# Secret key for sessions and flash messages
app.secret_key = 'super secret key'

# Define the directories for uploads and static files
app.config['UPLOAD_FOLDER'] = "uploads"
app.config['STATIC_FOLDER'] = "static"

# Ensure the necessary directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['STATIC_FOLDER'], exist_ok=True)

# Allowed image extensions
ALLOWED_EXTENSIONS = {'gif', 'webp', 'png', 'jpg', 'jpeg'}


def allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def process_image(filename, operation, params=None):
    """Process the uploaded image based on the specified operation."""
    # Build the path to the uploaded image
    img_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    # Read the image using OpenCV
    img = cv2.imread(img_path)

    # Check if the image was successfully read
    if img is None:
        raise ValueError("File could not be opened as an image.")

    # Initialize processed image path
    base_filename = filename.rsplit('.', 1)[0]
    processed_img_path = f"static/{base_filename}_{operation}.jpg"

    # Perform the selected operation
    if operation == "cgray":
        img_processed = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    elif operation == "cwebp":
        processed_img_path = f"static/{base_filename}.webp"
        img_processed = img
    elif operation == "cjpg":
        img_processed = img
    elif operation == "cpng":
        processed_img_path = f"static/{base_filename}.png"
        img_processed = img
    elif operation == "resize":
        width, height = params
        img_processed = cv2.resize(img, (width, height))
    elif operation == "rotate":
        angle = params
        (h, w) = img.shape[:2]
        center = (w // 2, h // 2)
        rotation_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        img_processed = cv2.warpAffine(img, rotation_matrix, (w, h))
    elif operation == "brightness_contrast":
        brightness, contrast = params
        img_processed = cv2.convertScaleAbs(img, alpha=contrast, beta=brightness)
    elif operation == "watermark":
        watermark_text = params
        font = cv2.FONT_HERSHEY_SIMPLEX
        text_size = cv2.getTextSize(watermark_text, font, 1, 2)[0]
        text_x = img.shape[1] - text_size[0] - 10
        text_y = img.shape[0] - 10
        img_processed = img.copy()
        cv2.putText(img_processed, watermark_text, (text_x, text_y), font, 1, (255, 255, 255), 2, cv2.LINE_AA)
    elif operation == "crop":
        x, y, w, h = params
        img_processed = img[y:y+h, x:x+w]
    elif operation == "flip":
        flip_type = params
        img_processed = cv2.flip(img, flip_type)
    elif operation == "blur":
        img_processed = cv2.GaussianBlur(img, (5, 5), 0)
    elif operation == "sharpen":
        sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        img_processed = cv2.filter2D(img, -1, sharpen_kernel)
    elif operation == "invert":
        img_processed = cv2.bitwise_not(img)
    elif operation == "threshold":
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, img_processed = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
    else:
        raise ValueError("Unsupported operation")

    # Save the processed image
    cv2.imwrite(processed_img_path, img_processed)
    return processed_img_path


@app.route("/")
def home():
    """Render the home page for uploading and editing images."""
    return render_template("index.html")


@app.route("/edit", methods=["POST"])
def edit():
    """Handle image upload and processing based on the selected operation."""
    if "file" not in request.files:
        flash("No file part in the request.", "error")
        return render_template("index.html")

    file = request.files["file"]

    if file.filename == '':
        flash("No selected file.", "error")
        return render_template("index.html")

    if not allowed_file(file.filename):
        flash("File type not allowed.", "error")
        return render_template("index.html")

    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)

    try:
        operation = request.form.get("operation")
        params = None

        if operation == "resize":
            width = int(request.form.get("width"))
            height = int(request.form.get("height"))
            params = (width, height)
        elif operation == "rotate":
            angle = int(request.form.get("angle"))
            params = angle
        elif operation == "brightness_contrast":
            brightness = int(request.form.get("brightness"))
            contrast = float(request.form.get("contrast"))
            params = (brightness, contrast)
        elif operation == "watermark":
            watermark_text = request.form.get("watermark_text")
            params = watermark_text
        elif operation == "crop":
            x = int(request.form.get("x"))
            y = int(request.form.get("y"))
            width = int(request.form.get("crop_width"))
            height = int(request.form.get("crop_height"))
            params = (x, y, width, height)
        elif operation == "flip":
            flip_type = int(request.form.get("flip_type"))
            params = flip_type

        processed_image_path = process_image(filename, operation, params)
        static_path = processed_image_path.replace("static/", "")

        flash(f"Your processed image is available <a href='/static/{static_path}' target='_blank'>here</a>", "success")
        return render_template("index.html")

    except Exception as e:
        flash(f"Error processing image: {str(e)}", "error")
        return render_template("index.html")


if __name__ == "__main__":
    app.run(port=5500)
    