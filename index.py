import os
import io
from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
from PIL import Image, ImageEnhance, ImageFilter
from werkzeug.utils import secure_filename

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.urandom(24)  # Random secret key for session management (not strictly needed here)

# App configuration
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # Max file size: 10MB
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}  # Allowed file extensions
ALLOWED_FORMATS = ['PNG', 'JPEG', 'JPG']  # Supported output formats
DEFAULT_FORMAT = 'PNG'  # Default output format
MAX_WIDTH, MAX_HEIGHT = 4000, 4000  # Max image dimensions


# Helper function to validate file extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# Serve static images (optional, for assets if needed)
@app.route('/images/<filename>')
def serve_image(filename):
    return send_from_directory('static/images', filename)


# Serve robots.txt (for SEO purposes if needed)
@app.route('/robots.txt')
def serve_robots():
    return send_from_directory(app.root_path, 'robots.txt')


# Serve ads.txt (for ads.txt if needed)
@app.route('/ads.txt')
def serve_ads():
    return send_from_directory(app.root_path, 'ads.txt')


# Home route - renders main HTML page
@app.route('/')
def index():
    return render_template('index.html')


# Handle 400 errors - bad requests
@app.errorhandler(400)
def handle_bad_request(e):
    return jsonify({"error": "Bad Request", "details": str(e)}), 400


# Handle 500 errors - internal server errors
@app.errorhandler(500)
def handle_internal_error(e):
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500


# Core image processing function
def process_image(image, operation, form):
    """
    Applies the selected operation to the image.
    Returns a tuple (processed_image, forced_format) where forced_format is used
    when an operation mandates a particular file format (like PNG conversion).
    """
    if operation == 'cpng':
        return image, 'PNG'

    elif operation == 'cjpg':
        return image, 'JPEG'

    elif operation == 'cgray':
        return image.convert('L'), None  # Convert to grayscale

    elif operation == 'resize':
        width = int(form.get('width', 0))
        height = int(form.get('height', 0))
        if width <= 0 or height <= 0:
            raise ValueError("Invalid resize dimensions")
        return image.resize((width, height)), None

    elif operation == 'rotate':
        angle = int(form.get('angle', 0))
        return image.rotate(angle, expand=True), None

    elif operation == 'brightness_contrast':
        brightness = float(form.get('brightness', 1.0))
        contrast = float(form.get('contrast', 1.0))
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(brightness)
        enhancer = ImageEnhance.Contrast(image)
        return enhancer.enhance(contrast), None

    elif operation == 'crop':
        x, y = int(form.get('x', 0)), int(form.get('y', 0))
        crop_width = int(form.get('crop_width', 0))
        crop_height = int(form.get('crop_height', 0))

        # Check for valid crop dimensions
        if x < 0 or y < 0 or crop_width <= 0 or crop_height <= 0:
            raise ValueError("Invalid crop dimensions")
        if x + crop_width > image.width or y + crop_height > image.height:
            raise ValueError("Crop dimensions exceed image size")

        return image.crop((x, y, x + crop_width, y + crop_height)), None

    elif operation == 'flip':
        flip_type = form.get('flip_type')
        if flip_type == 'vertical':
            return image.transpose(Image.FLIP_TOP_BOTTOM), None
        elif flip_type == 'horizontal':
            return image.transpose(Image.FLIP_LEFT_RIGHT), None
        else:
            raise ValueError("Invalid flip type")

    elif operation == 'blur':
        radius = float(form.get('blur_radius', 5))
        return image.filter(ImageFilter.GaussianBlur(radius=radius)), None

    elif operation == 'sharpen':
        return image.filter(ImageFilter.SHARPEN), None

    elif operation == 'invert':
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        return Image.eval(image, lambda x: 255 - x), None
    
    # Add your custom operations here 
    # elif operation == 'custom_op':
    #     # Custom operation logic
    #     return processed_image, None

    else:
        # Catch any unsupported operations
        raise ValueError(f"Unknown operation: {operation}")


# Image editing endpoint (main processing logic)
@app.route('/edit', methods=['POST'])
def edit_image():
    uploaded_file = request.files.get('file')

    # Validate file existence and extension
    if not uploaded_file or uploaded_file.filename == '':
        return jsonify({"error": "No file uploaded"}), 400

    if not allowed_file(uploaded_file.filename):
        return jsonify({"error": "Invalid file type. Allowed: PNG, JPG, JPEG"}), 400

    filename = secure_filename(uploaded_file.filename)

    # Open the image and validate size
    try:
        image = Image.open(uploaded_file.stream)
        if image.width > MAX_WIDTH or image.height > MAX_HEIGHT:
            return jsonify({"error": f"Image dimensions exceed {MAX_WIDTH}x{MAX_HEIGHT}"}), 400
    except Exception:
        return jsonify({"error": "Invalid image file"}), 400

    # Get operation and output format
    operation = request.form.get('operation')
    file_format = request.form.get('file_format', DEFAULT_FORMAT).upper()

    # Normalize JPG to JPEG (PIL uses JPEG)
    file_format = 'JPEG' if file_format == 'JPG' else file_format

    if file_format not in ALLOWED_FORMATS:
        return jsonify({"error": f"Unsupported file format: {file_format}"}), 400

    try:
        # Process the image with the specified operation
        processed_image, forced_format = process_image(image, operation, request.form)

        # If the operation mandates a specific format (e.g., PNG conversion), override
        if forced_format:
            file_format = forced_format

        # Save processed image to a BytesIO stream
        img_io = io.BytesIO()
        processed_image.save(img_io, file_format)
        img_io.seek(0)

        # Set correct MIME type for response
        mimetype = {
            'PNG': 'image/png',
            'JPEG': 'image/jpeg'
        }.get(file_format, f'image/{file_format.lower()}')

        # Send file back as a downloadable attachment
        return send_file(
            img_io,
            mimetype=mimetype,
            as_attachment=True,
            download_name=f'edited_image.{file_format.lower()}'
        )

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": "Image processing failed", "details": str(e)}), 500


# Optional healthcheck endpoint
@app.route('/health')
def health_check():
    return jsonify(status='healthy', service='Teditor Backend')


# Run the Flask app
if __name__ == "__main__":
    app.run(debug=True)
