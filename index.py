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
    try:
        if operation == 'cpng':
            return image, 'PNG'  # Force PNG conversion

        elif operation == 'cgray':
            return image.convert('L'), None  # Convert to grayscale

        elif operation == 'resize':
            try:
                width = int(form.get('width', ''))
                height = int(form.get('height', ''))
            except ValueError:
                raise ValueError("Resize dimensions must be valid numbers.")

            if width <= 0 or height <= 0:
                raise ValueError("Resize dimensions must be positive.")

            return image.resize((width, height)), None

        elif operation == 'rotate':
            try:
                angle = float(form.get('angle', ''))
            except ValueError:
                raise ValueError("Rotation angle must be a valid number.")

            return image.rotate(angle, expand=True), None

        elif operation == 'brightness_contrast':
            try:
                brightness = float(form.get('brightness', ''))
                contrast = float(form.get('contrast', ''))
            except ValueError:
                raise ValueError(
                    "Brightness and contrast must be valid numbers.")

            if not (0.0 <= brightness <= 2.0):
                raise ValueError("Brightness must be between 0.0 and 2.0.")
            if not (0.0 <= contrast <= 2.0):
                raise ValueError("Contrast must be between 0.0 and 2.0.")

            image = ImageEnhance.Brightness(image).enhance(brightness)
            return ImageEnhance.Contrast(image).enhance(contrast), None

        elif operation == 'crop':
            try:
                x = int(form.get('x', ''))
                y = int(form.get('y', ''))
                crop_width = int(form.get('crop_width', ''))
                crop_height = int(form.get('crop_height', ''))
            except ValueError:
                raise ValueError("Crop values must be valid numbers.")

            if x < 0 or y < 0 or crop_width <= 0 or crop_height <= 0:
                raise ValueError("Invalid crop dimensions.")
            if x + crop_width > image.width or y + crop_height > image.height:
                raise ValueError("Crop dimensions exceed image size.")

            return image.crop((x, y, x + crop_width, y + crop_height)), None

        elif operation == 'flip':
            flip_type = form.get('flip_type', '').strip().lower()
            if flip_type == 'vertical':
                return image.transpose(Image.FLIP_TOP_BOTTOM), None
            elif flip_type == 'horizontal':
                return image.transpose(Image.FLIP_LEFT_RIGHT), None
            raise ValueError(f"Invalid flip type '{flip_type}'")

        elif operation == 'blur':
            try:
                radius = float(form.get('blur_radius', ''))
            except ValueError:
                raise ValueError("Blur radius must be a valid number.")

            if radius < 0:
                raise ValueError("Blur radius must be positive.")

            return image.filter(ImageFilter.GaussianBlur(radius)), None

        elif operation == 'sharpen':
            return image.filter(ImageFilter.SHARPEN), None

        elif operation == 'invert':
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
        #    return image.new_operation(), None

        else:
            raise ValueError(f"Unknown operation: {operation}")

    except ValueError as e:
        return {"error": str(e)}


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

        # Retrieve the unique filename from the request
        new_filename = request.form.get('new_name', uploaded_file.filename)  # Default to original if missing
        file_format = new_filename.split('.')[-1]  # Extract format from the frontend filename

        # Process the image
        processed_image, forced_format = process_image(image, operation, request.form)

        # If forced format is applied, adjust the filename
        if forced_format:
            new_filename = f"{new_filename.rsplit('.', 1)[0]}.{forced_format.lower()}"

        # JPEG requires RGB mode (no transparency), so convert if necessary
        if file_format.lower() == 'jpeg' and processed_image.mode != 'RGB':
            processed_image = processed_image.convert('RGB')

        # Prepare image for download (send directly as response)
        img_io = io.BytesIO()
        processed_image.save(img_io, file_format.upper())
        img_io.seek(0)

        return send_file(
            img_io,
            mimetype=f'image/{file_format.lower()}',
            as_attachment=True,
            download_name=new_filename  # Ensure it matches frontend
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
