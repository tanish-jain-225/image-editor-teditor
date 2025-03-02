import os
import io

from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
from PIL import Image, ImageEnhance, ImageFilter

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Limit uploads size to 10MB
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB

# Allowed formats and default
ALLOWED_FORMATS = ['PNG', 'JPEG', 'JPG']
DEFAULT_FORMAT = 'PNG'  # Fallback format if none provided

# Maximum allowed image dimensions (to avoid memory issues)
MAX_WIDTH = 4000
MAX_HEIGHT = 4000

# Serve robots.txt for ads and search engine crawlers
@app.route('/robots.txt')
def serve_robots_txt():
    return send_from_directory(os.path.join(app.root_path), 'robots.txt')

# Serve ads.txt for verification of ad sellers
@app.route('/ads.txt')
def serve_ads_txt():
    return send_from_directory(os.path.join(app.root_path), 'ads.txt')


@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad Request", "details": str(e)}), 400


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal Server Error", "details": str(e)}), 500


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/edit', methods=['POST'])
def edit_image():
    uploaded_file = request.files.get('file')
    if not uploaded_file or uploaded_file.filename == '':
        return jsonify({"error": "No file uploaded"}), 400

    operation = request.form.get('operation')

    try:
        image = Image.open(uploaded_file.stream)

        # Cap the image dimensions (protection against excessive memory usage)
        if image.width > MAX_WIDTH or image.height > MAX_HEIGHT:
            return jsonify({"error": f"Image dimensions exceed {MAX_WIDTH}x{MAX_HEIGHT}"}), 400

    except Exception:
        return jsonify({"error": "Invalid image file"}), 400

    # Handle file format (normalize 'JPG' to 'JPEG')
    file_format = request.form.get('file_format', DEFAULT_FORMAT).upper()
    file_format = 'JPEG' if file_format == 'JPG' else file_format

    if file_format not in ALLOWED_FORMATS:
        return jsonify({"error": f"Unsupported file format: {file_format}"}), 400

    img_io = io.BytesIO()

    try:
        # Core processing logic (operations)
        if operation == 'cpng':
            file_format = 'PNG'

        elif operation == 'cjpg':
            file_format = 'JPEG'

        elif operation == 'cgray':
            image = image.convert('L')

        elif operation == 'resize':
            width = int(request.form.get('width', 0))
            height = int(request.form.get('height', 0))
            if width <= 0 or height <= 0:
                return jsonify({"error": "Invalid width or height"}), 400
            image = image.resize((width, height))

        elif operation == 'rotate':
            angle = int(request.form.get('angle', 0))
            image = image.rotate(angle, expand=True)

        elif operation == 'brightness_contrast':
            brightness = float(request.form.get('brightness', 1.0))
            contrast = float(request.form.get('contrast', 1.0))
            image = ImageEnhance.Brightness(image).enhance(brightness)
            image = ImageEnhance.Contrast(image).enhance(contrast)

        elif operation == 'crop':
            x = int(request.form.get('x', 0))
            y = int(request.form.get('y', 0))
            crop_width = int(request.form.get('crop_width', 0))
            crop_height = int(request.form.get('crop_height', 0))

            if x < 0 or y < 0 or crop_width <= 0 or crop_height <= 0:
                return jsonify({"error": "Invalid crop dimensions"}), 400
            if x + crop_width > image.width or y + crop_height > image.height:
                return jsonify({"error": "Crop dimensions exceed image size"}), 400

            image = image.crop((x, y, x + crop_width, y + crop_height))

        elif operation == 'flip':
            flip_type = request.form.get('flip_type')
            if flip_type == 'vertical':
                image = image.transpose(Image.FLIP_TOP_BOTTOM)
            elif flip_type == 'horizontal':
                image = image.transpose(Image.FLIP_LEFT_RIGHT)
            else:
                return jsonify({"error": "Invalid flip type"}), 400

        elif operation == 'blur':
            radius = float(request.form.get('blur_radius', 5))
            image = image.filter(ImageFilter.GaussianBlur(radius=radius))

        elif operation == 'sharpen':
            image = image.filter(ImageFilter.SHARPEN)

        elif operation == 'invert':
            if image.mode != 'RGB':
                image = image.convert('RGB')
            image = Image.eval(image, lambda x: 255 - x)

        else:
            return jsonify({"error": "Invalid operation"}), 400

        # Save processed image to BytesIO buffer
        image.save(img_io, file_format)
        img_io.seek(0)

        # Return the processed file as attachment
        return send_file(
            img_io,
            mimetype=f'image/{file_format.lower()}',
            as_attachment=True,
            download_name=f'edited_image.{file_format.lower()}'
        )

    except Exception as e:
        return jsonify({"error": "Image processing failed", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
