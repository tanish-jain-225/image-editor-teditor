import os
import io
from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Flask Limiter
limiter = Limiter(get_remote_address, app=app)

# Constants
MAX_SIZE_IMAGE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
MAX_WIDTH, MAX_HEIGHT = 4000, 4000
ALLOWED_FORMATS = {'PNG', 'JPEG', 'JPG'}
RATE_LIMIT = "5 per minute"
DEFAULT_FORMAT = 'PNG'
app.config['MAX_CONTENT_LENGTH'] = MAX_SIZE_IMAGE


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def normalize_format(format_str):
    format_str = format_str.upper()
    return 'JPEG' if format_str == 'JPG' else format_str


def preserve_alpha(original, processed):
    if original.mode == 'RGBA':
        r, g, b, a = original.split()
        processed.putalpha(a)
    return processed


@app.route('/images/<filename>')
def serve_image(filename):
    return send_from_directory('static/images', filename)


@app.route('/robots.txt')
def serve_robots():
    return send_from_directory(app.root_path, 'robots.txt')


@app.route('/ads.txt')
def serve_ads():
    return send_from_directory(app.root_path, 'ads.txt')


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/health')
def health_check():
    return jsonify(status='healthy', service='Teditor Backend', pillow_version=Image.__version__)


@app.errorhandler(400)
def handle_bad_request(e):
    return jsonify({"error": "Bad Request", "details": str(e)}), 400


@app.errorhandler(500)
def handle_internal_error(e):
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500


@app.errorhandler(ValueError)
def handle_value_error(e):
    return jsonify({"error": str(e)}), 400


def process_image(image, operation, form):
    if operation == 'cpng':
        return image, 'PNG'

    elif operation == 'cjpg':
        return image, 'JPEG'

    elif operation == 'cgray':
        return image.convert('L'), None

    elif operation == 'resize':
        width, height = int(form.get('width', 0)), int(form.get('height', 0))
        if width <= 0 or height <= 0:
            raise ValueError("Invalid resize dimensions")
        return image.resize((width, height)), None

    elif operation == 'rotate':
        angle = int(form.get('angle', 0))
        return image.rotate(angle, expand=True), None

    elif operation == 'brightness_contrast':
        brightness, contrast = float(form.get('brightness', 1.0)), float(form.get('contrast', 1.0))
        image = ImageEnhance.Brightness(image).enhance(brightness)
        return ImageEnhance.Contrast(image).enhance(contrast), None

    elif operation == 'crop':
        x, y = int(form.get('x', 0)), int(form.get('y', 0))
        crop_width, crop_height = int(form.get('crop_width', 0)), int(form.get('crop_height', 0))

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
        if image.mode != 'RGB':
            image = image.convert('RGB')
        return ImageOps.invert(image), None

    raise ValueError(f"Unknown operation: {operation}")


@app.route('/edit', methods=['POST'])
@limiter.limit(RATE_LIMIT)
def edit_image():
    uploaded_file = request.files.get('file')
    if not uploaded_file or uploaded_file.filename == '':
        raise ValueError("No file uploaded")

    if not allowed_file(uploaded_file.filename):
        raise ValueError("Invalid file type. Allowed: PNG, JPG, JPEG")

    image = Image.open(uploaded_file.stream)
    if image.width > MAX_WIDTH or image.height > MAX_HEIGHT:
        raise ValueError(f"Image dimensions exceed {MAX_WIDTH}x{MAX_HEIGHT}")

    operation = request.form.get('operation')
    file_format = normalize_format(request.form.get('file_format', DEFAULT_FORMAT))
    if file_format not in ALLOWED_FORMATS:
        raise ValueError(f"Unsupported file format: {file_format}")

    processed_image, forced_format = process_image(image, operation, request.form)
    if forced_format:
        file_format = forced_format

    if file_format == 'JPEG' and processed_image.mode != 'RGB':
        processed_image = processed_image.convert('RGB')

    img_io = io.BytesIO()
    processed_image.save(img_io, file_format)
    img_io.seek(0)

    return send_file(img_io, mimetype=f'image/{file_format.lower()}', as_attachment=True,
                     download_name=f'edited_image.{file_format.lower()}')


if __name__ == '__main__':
    app.run()
