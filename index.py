from flask import Flask, render_template, request, redirect, send_file
import os
from PIL import Image
import io

app = Flask(__name__)

app.secret_key = os.urandom(24)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/edit', methods=['POST'])
def edit_image():
    # Get the uploaded file and operation choice
    uploaded_file = request.files.get('file')
    operation = request.form.get('operation')

    # Open the uploaded image
    image = Image.open(uploaded_file.stream)

    # Perform the selected operation
    if operation == 'cpng':  # Convert to PNG
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'cjpg':  # Convert to JPG
        img_io = io.BytesIO()
        image.save(img_io, 'JPEG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/jpeg', as_attachment=True, download_name='edited_image.jpg')

    elif operation == 'cgray':  # Convert to Grayscale
        image = image.convert('L')
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'resize':  # Resize
        width = int(request.form.get('width'))
        height = int(request.form.get('height'))
        image = image.resize((width, height))
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'rotate':  # Rotate
        angle = int(request.form.get('angle'))
        image = image.rotate(angle)
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'brightness_contrast':  # Brightness & Contrast
        brightness = float(request.form.get('brightness'))
        contrast = float(request.form.get('contrast'))
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(brightness)
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(contrast)
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'crop':  # Crop
        x = int(request.form.get('x'))
        y = int(request.form.get('y'))
        crop_width = int(request.form.get('crop_width'))
        crop_height = int(request.form.get('crop_height'))
        image = image.crop((x, y, x + crop_width, y + crop_height))
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'flip':  # Flip
        flip_type = int(request.form.get('flip_type'))
        if flip_type == 0:  # Vertical
            image = image.transpose(Image.FLIP_TOP_BOTTOM)
        elif flip_type == 1:  # Horizontal
            image = image.transpose(Image.FLIP_LEFT_RIGHT)
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'blur':  # Apply Blur
        from PIL import ImageFilter
        image = image.filter(ImageFilter.GaussianBlur(radius=5))
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'sharpen':  # Sharpen Image
        from PIL import ImageFilter
        image = image.filter(ImageFilter.SHARPEN)
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    elif operation == 'invert':  # Invert Colors
        image = Image.eval(image, lambda x: 255 - x)
        img_io = io.BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='edited_image.png')

    return redirect('/')


if __name__ == "__main__":
    app.run(debug=False)