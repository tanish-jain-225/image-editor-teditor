import os
import io
import traceback
from flask import Flask, render_template, request, send_file, jsonify
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.urandom(24)

# Preserve transparency for PNGs
def preserve_alpha(original, processed):
    if original.mode == 'RGBA':
        r, g, b, a = original.split()
        processed.putalpha(a)
    return processed

# Route for home page
@app.route('/')
def index():
    return render_template('index.html')

# Health check endpoint
@app.route('/health')
def health_check():
    return jsonify(status='healthy', service='Teditor Backend', pillow_version=Image.__version__)

# Error handlers
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

# Image processing function
def process_image(image, operation, form):
    try:
        if operation == 'cgray':
            return image.convert('L')
        elif operation == 'resize':
            width, height = int(form.get('width', '')), int(form.get('height', ''))
            if width <= 0 or height <= 0:
                raise ValueError("Resize dimensions must be positive.")
            return image.resize((width, height))
        elif operation == 'rotate':
            angle = float(form.get('angle', ''))
            return image.rotate(angle, expand=True)
        elif operation == 'brightness_contrast':
            brightness, contrast = float(form.get('brightness', '')), float(form.get('contrast', ''))
            if not (0.0 <= brightness <= 2.0) or not (0.0 <= contrast <= 2.0):
                raise ValueError("Brightness and contrast must be between 0.0 and 2.0.")
            image = ImageEnhance.Brightness(image).enhance(brightness)
            return ImageEnhance.Contrast(image).enhance(contrast)
        elif operation == 'crop':
            x, y, crop_width, crop_height = map(int, [form.get('x', ''), form.get('y', ''), form.get('crop_width', ''), form.get('crop_height', '')])
            if x < 0 or y < 0 or crop_width <= 0 or crop_height <= 0 or x + crop_width > image.width or y + crop_height > image.height:
                raise ValueError("Invalid crop dimensions.")
            return image.crop((x, y, x + crop_width, y + crop_height))
        elif operation == 'flip':
            flip_type = form.get('flip_type', '').strip().lower()
            if flip_type == 'vertical':
                return image.transpose(Image.FLIP_TOP_BOTTOM)
            elif flip_type == 'horizontal':
                return image.transpose(Image.FLIP_LEFT_RIGHT)
            raise ValueError(f"Invalid flip type '{flip_type}'")
        elif operation == 'blur':
            radius = float(form.get('blur_radius', ''))
            if radius < 0:
                raise ValueError("Blur radius must be positive.")
            return image.filter(ImageFilter.GaussianBlur(radius))
        elif operation == 'sharpen':
            return image.filter(ImageFilter.SHARPEN)
        elif operation == 'invert':
            if image.mode not in ['RGB', 'RGBA']:
                image = image.convert('RGBA')
            if image.mode == 'RGBA':
                r, g, b, a = image.split()
                inverted_rgb = ImageOps.invert(Image.merge("RGB", (r, g, b)))
                return Image.merge("RGBA", (*inverted_rgb.split(), a))
            else:
                return ImageOps.invert(image)
        else:
            raise ValueError(f"Unknown operation: {operation}")
    except ValueError as e:
        raise ValueError(str(e))

# Endpoint to edit images
@app.route('/edit', methods=['POST'])
def edit_image():
    try:
        uploaded_file = request.files.get('file')
        if not uploaded_file or uploaded_file.filename == '':
            raise ValueError("No file uploaded")

        image = Image.open(uploaded_file.stream)
        operation = request.form.get('operation')
        if not operation:
            raise ValueError("No operation specified")

        new_filename = request.form.get('new_name', uploaded_file.filename)
        original_format = image.format  # Keep original format
        processed_image = process_image(image, operation, request.form)

        # Preserve alpha channel if necessary
        if original_format == 'PNG':
            processed_image = preserve_alpha(image, processed_image)

        # Save the processed image
        img_io = io.BytesIO()
        processed_image.save(img_io, format=original_format)
        img_io.seek(0)

        return send_file(img_io, mimetype=f'image/{original_format.lower()}', as_attachment=True, download_name=new_filename, conditional=True)

    except ValueError as ve:
        app.logger.warning(f"Value error: {ve}")
        return handle_value_error(ve)
    except Exception as e:
        app.logger.error(f"Unexpected error: {e}")
        app.logger.error(traceback.format_exc())
        return handle_internal_error(e)

# Run Flask app
if __name__ == '__main__':
    app.run(debug=True)
