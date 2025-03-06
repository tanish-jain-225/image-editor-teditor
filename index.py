import os
import io
import traceback
from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from werkzeug.utils import secure_filename

# Initialize Flask app
app = Flask(__name__)
# Secret key for session security (used if sessions/cookies needed)
app.secret_key = os.urandom(24)

# Allowed file extensions for uploads
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
ALLOWED_FORMATS = {'PNG', 'JPEG', 'JPG'}
DEFAULT_FORMAT = 'PNG'  # Default output format if no format is specified


# Helper function to validate file extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# Normalize file format to PIL-compatible format
def normalize_format(format_str):
    format_str = format_str.upper()
    return 'JPEG' if format_str == 'JPG' else format_str


# Preserve alpha transparency if the image supports it
def preserve_alpha(original, processed):
    if original.mode == 'RGBA':
        r, g, b, a = original.split()
        processed.putalpha(a)
    return processed


# Serve static files (e.g., images, robots.txt, ads.txt)
@app.route('/images/<filename>')
def serve_image(filename):
    return send_from_directory('static/images', filename)


@app.route('/<filename>')
def serve_static(filename):
    return send_from_directory('static/', filename)


@app.route('/robots.txt')
def serve_robots():
    return send_from_directory(app.root_path, 'robots.txt')


@app.route('/ads.txt')
def serve_ads():
    return send_from_directory(app.root_path, 'ads.txt')


# Home page route
@app.route('/')
def index():
    return render_template('index.html')


# Health check endpoint (useful for monitoring tools like Kubernetes)
@app.route('/health')
def health_check():
    return jsonify(status='healthy', service='Teditor Backend', pillow_version=Image.__version__)


# Global error handlers for better debugging
@app.errorhandler(400)
def handle_bad_request(e):
    return jsonify({"error": "Bad Request", "details": str(e)}), 400


@app.errorhandler(500)
def handle_internal_error(e):
    app.logger.error(traceback.format_exc())
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500


@app.errorhandler(ValueError)
def handle_value_error(e):
    return jsonify({"error": str(e)}), 400


# Core function to process the image based on operation
def process_image(image, operation, form):
    if operation == 'cpng':
        return image, 'PNG'  # Force PNG conversion

    elif operation == 'cgray':
        return image.convert('L'), None  # Convert to grayscale

    elif operation == 'resize':
        width, height = int(form.get('width', 0)), int(form.get('height', 0))
        if width <= 0 or height <= 0:
            raise ValueError("Invalid resize dimensions")
        return image.resize((width, height)), None

    elif operation == 'rotate':
        angle = int(form.get('angle', 0))
        return image.rotate(angle, expand=True), None

    elif operation == 'brightness_contrast':
        brightness = float(form.get('brightness', 1.0))
        contrast = float(form.get('contrast', 1.0))
        image = ImageEnhance.Brightness(image).enhance(brightness)
        return ImageEnhance.Contrast(image).enhance(contrast), None

    elif operation == 'crop':
        x, y = int(form.get('x', 0)), int(form.get('y', 0))
        crop_width, crop_height = int(form.get('crop_width', 0)), int(
            form.get('crop_height', 0))

        # Validate crop dimensions
        if x < 0 or y < 0 or crop_width <= 0 or crop_height <= 0:
            raise ValueError("Invalid crop dimensions")
        if x + crop_width > image.width or y + crop_height > image.height:
            raise ValueError("Crop dimensions exceed image size")

        return image.crop((x, y, x + crop_width, y + crop_height)), None

    elif operation == 'flip':
        flip_type = form.get('flip_type', '').strip().lower()
        if flip_type == 'vertical':
            return image.transpose(Image.FLIP_TOP_BOTTOM), None
        elif flip_type == 'horizontal':
            return image.transpose(Image.FLIP_LEFT_RIGHT), None
        raise ValueError(f"Invalid flip type '{flip_type}'")

    elif operation == 'blur':
        radius = float(form.get('blur_radius', 5))
        return image.filter(ImageFilter.GaussianBlur(radius)), None

    elif operation == 'sharpen':
        return image.filter(ImageFilter.SHARPEN), None

    elif operation == 'invert':
        # Ensure correct mode for invert operation
        if image.mode not in ['RGB', 'RGBA']:
            image = image.convert('RGBA')
        if image.mode == 'RGBA':
            r, g, b, a = image.split()
            inverted_rgb = ImageOps.invert(Image.merge("RGB", (r, g, b)))
            return Image.merge("RGBA", (*inverted_rgb.split(), a)), None
        else:
            return ImageOps.invert(image), None
    # Add new operations here
    # elif operation == 'new_operation':
    #    return image, None

    else:
        raise ValueError(f"Unknown operation: {operation}")


# Main endpoint to edit images
@app.route('/edit', methods=['POST'])
def edit_image():
    try:
        # Get uploaded file from the form
        uploaded_file = request.files.get('file')
        if not uploaded_file or uploaded_file.filename == '':
            raise ValueError("No file uploaded")

        # Validate file extension
        if not allowed_file(uploaded_file.filename):
            raise ValueError("Invalid file type. Allowed: PNG, JPG, JPEG")

        # Load image using PIL
        image = Image.open(uploaded_file.stream)

        # Get the requested operation (e.g., resize, rotate, etc.)
        operation = request.form.get('operation')
        if not operation:
            raise ValueError("No operation specified")

        # Process the image
        processed_image, forced_format = process_image(
            image, operation, request.form)

        # Set output format (either forced by operation or default PNG)
        file_format = forced_format if forced_format else DEFAULT_FORMAT

        # JPEG requires RGB mode (no transparency), so convert if necessary
        if file_format == 'JPEG' and processed_image.mode != 'RGB':
            processed_image = processed_image.convert('RGB')

        # Prepare image for download (send directly as response)
        img_io = io.BytesIO()
        processed_image.save(img_io, file_format)
        img_io.seek(0)

        return send_file(
            img_io,
            mimetype=f'image/{file_format.lower()}',
            as_attachment=True,
            download_name=f'edited_image.{file_format.lower()}'
        )

    except ValueError as ve:
        app.logger.warning(f"Value error: {ve}")
        return handle_value_error(ve)

    except Exception as e:
        app.logger.error(f"Unexpected error: {e}")
        app.logger.error(traceback.format_exc())
        return handle_internal_error(e)


# Run app
if __name__ == '__main__':
    app.run(debug=True)  # Set debug=False in production
