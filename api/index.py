from flask import Flask, render_template, request, redirect, flash, send_file
import os
from PIL import Image
import io

app = Flask(__name__)

# Set a secret key for sessions/flash messages
app.secret_key = 'super secret key'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/edit', methods=['POST'])
def edit_image():
    try:
        # Get the uploaded file and operation choice
        uploaded_file = request.files.get('file')
        operation = request.form.get('operation')

        if not uploaded_file:
            flash("No file uploaded.", "danger")
            return redirect('/')

        # Open the uploaded image
        image = Image.open(uploaded_file.stream)

        # Perform the selected operation
        img_io = io.BytesIO()

        if operation == 'cpng':  # Convert to PNG
            image.save(img_io, 'PNG')
        elif operation == 'cjpg':  # Convert to JPG
            image.save(img_io, 'JPEG')
        elif operation == 'cgray':  # Convert to Grayscale
            image = image.convert('L')
            image.save(img_io, 'PNG')
        elif operation == 'resize':  # Resize
            width = int(request.form.get('width'))
            height = int(request.form.get('height'))
            image = image.resize((width, height))
            image.save(img_io, 'PNG')
        elif operation == 'rotate':  # Rotate
            angle = int(request.form.get('angle'))
            image = image.rotate(angle)
            image.save(img_io, 'PNG')
        elif operation == 'brightness_contrast':  # Brightness & Contrast
            brightness = float(request.form.get('brightness'))
            contrast = float(request.form.get('contrast'))
            from PIL import ImageEnhance
            enhancer = ImageEnhance.Brightness(image)
            image = enhancer.enhance(brightness)
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(contrast)
            image.save(img_io, 'PNG')
        elif operation == 'crop':  # Crop
            x = int(request.form.get('x'))
            y = int(request.form.get('y'))
            crop_width = int(request.form.get('crop_width'))
            crop_height = int(request.form.get('crop_height'))
            image = image.crop((x, y, x + crop_width, y + crop_height))
            image.save(img_io, 'PNG')
        elif operation == 'flip':  # Flip
            flip_type = int(request.form.get('flip_type'))
            if flip_type == 0:  # Vertical
                image = image.transpose(Image.FLIP_TOP_BOTTOM)
            elif flip_type == 1:  # Horizontal
                image = image.transpose(Image.FLIP_LEFT_RIGHT)
            image.save(img_io, 'PNG')
        elif operation == 'blur':  # Apply Blur
            from PIL import ImageFilter
            image = image.filter(ImageFilter.GaussianBlur(radius=5))
            image.save(img_io, 'PNG')
        elif operation == 'sharpen':  # Sharpen Image
            from PIL import ImageFilter
            image = image.filter(ImageFilter.SHARPEN)
            image.save(img_io, 'PNG')
        elif operation == 'invert':  # Invert Colors
            image = Image.eval(image, lambda x: 255 - x)
            image.save(img_io, 'PNG')
        elif operation == 'threshold':  # Apply Threshold
            threshold = int(request.form.get('threshold'))
            image = image.convert('L')
            image = image.point(lambda p: p > threshold and 255)
            image.save(img_io, 'PNG')
        else:
            flash("Invalid operation.", "danger")
            return redirect('/')

        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')
    except Exception as e:
        flash(f"An error occurred: {str(e)}", "danger")
        return redirect('/')

if __name__ == "__main__":
    app.run()
