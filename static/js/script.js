document.addEventListener('DOMContentLoaded', function () {
    const COMPRESSED_TARGET_SIZE_MB = 4;  // Target size after compression
    const MAX_WIDTH = 5000;               // Max allowed width
    const MAX_HEIGHT = 5000;              // Max allowed height

    const operationsConfig = {
        cpng: { label: "Convert to PNG", fields: [] },
        cgray: { label: "Convert to Grayscale", fields: [] },
        resize: {
            label: "Resize", fields: [
                { name: "width", label: "Width (px)", type: "text", required: true },
                { name: "height", label: "Height (px)", type: "text", required: true }
            ]
        },
        rotate: {
            label: "Rotate", fields: [
                { name: "angle", label: "Rotation Angle (deg)", type: "text", required: true }
            ]
        },
        crop: {
            label: "Crop", fields: [
                { name: "x", label: "X Coordinate", type: "text", required: true },
                { name: "y", label: "Y Coordinate", type: "text", required: true },
                { name: "crop_width", label: "Crop Width (px)", type: "text", required: true },
                { name: "crop_height", label: "Crop Height (px)", type: "text", required: true }
            ]
        },
        brightness_contrast: {
            label: "Brightness & Contrast", fields: [
                { name: "brightness", label: "Brightness (0.0 to 2.0)", type: "text", required: true },
                { name: "contrast", label: "Contrast (0.0 to 2.0)", type: "text", required: true }
            ]
        },
        flip: {
            label: "Flip", fields: [
                { name: "flip_type", label: "Flip Direction", type: "select", options: ["Horizontal", "Vertical"], required: true }
            ]
        },
        blur: {
            label: "Blur", fields: [
                { name: "blur_radius", label: "Blur Radius (px)", type: "text", required: true }
            ]
        },
        sharpen: { label: "Sharpen", fields: [] },
        invert: { label: "Invert Colors", fields: [] }
    };

    const form = document.getElementById('editor-form');
    const notifier = document.getElementById('notifier');
    let abortController = null;

    initializeForm();

    function initializeForm() {
        form.innerHTML = `
            <input type="file" id="file" name="file" accept="image/*" class="form-control mb-3" required>
            <select id="operation" name="operation" class="form-select mb-3" required>
                <option value="">Select Operation</option>
            </select>
            <div id="dynamic-options"></div>
            <button type="submit" class="btn btn-success">Download</button>
            <div id="loader" style="display:none; margin-top:10px; text-align:center;">
                <div class="spinner-border text-primary" role="status"></div>
                <p style="color:black;">Processing image, please wait...</p>
                <button type="button" id="cancel-button" class="btn btn-danger btn-sm">Cancel</button>
            </div>
        `;
        populateOperationDropdown();
        attachEventListeners();
    }

    function populateOperationDropdown() {
        const operationSelect = document.getElementById('operation');
        Object.entries(operationsConfig).forEach(([key, config]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = config.label;
            operationSelect.appendChild(option);
        });
        operationSelect.addEventListener('change', () => renderDynamicFields(operationSelect.value));
    }

    function renderDynamicFields(operationKey) {
        const container = document.getElementById('dynamic-options');
        container.innerHTML = '';
        (operationsConfig[operationKey]?.fields || []).forEach(field => {
            const wrapper = document.createElement('div');
            wrapper.classList.add('mb-3');
            const label = document.createElement('label');
            label.textContent = field.label;
            const input = document.createElement(field.type === 'select' ? 'select' : 'input');
            input.name = field.name;
            input.classList.add('form-control');

            if (field.type === 'select') {
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.toLowerCase();
                    option.textContent = opt;
                    input.appendChild(option);
                });
            } else {
                input.type = field.type;
            }

            if (field.required) input.required = true;
            wrapper.append(label, input);
            container.appendChild(wrapper);
        });
    }

    function attachEventListeners() {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            showMessage('', '');

            const file = document.getElementById('file').files[0];
            if (!file) return showMessage('error', 'Please select a file.');

            const uniqueFilename = generateUniqueFilename(file.name);
            const compressedFile = await compressImage(file);
            if (!compressedFile) return;

            const formData = new FormData(form);
            formData.set('file', compressedFile, uniqueFilename);
            formData.set('new_name', uniqueFilename);

            setProcessingState(true);

            try {
                const response = await fetch('/edit', { method: 'POST', body: formData });
                if (response.ok) {
                    const blob = await response.blob();
                    downloadBlob(blob, uniqueFilename);
                    showMessage('success', 'Image processed successfully!');
                } else {
                    showMessage('error', 'Failed to process image.');
                }
            } catch (error) {
                showMessage('error', 'Network error occurred.');
            } finally {
                setProcessingState(false);
            }
        });
    }

    function showMessage(type, message) {
        let link = '';

        if (type === 'success') {
            link = ' <a href="/" class="text-decoration-none">Process Another</a>';
        } else if (type === 'error') {
            link = ' <a href="/" class="text-decoration-none">Try Again</a>';
        }

        const color = type === 'success' ? 'green' : (type === 'error' ? 'red' : 'black');

        notifier.innerHTML = type ? `<span style="color:${color};">${message}${link}</span>` : '';
    }

    function setProcessingState(isProcessing) {
        const loader = document.getElementById('loader');
        const submitButton = form.querySelector('button[type="submit"]');

        if (isProcessing) {
            loader.style.display = 'block';
            submitButton.disabled = true;

            abortController = new AbortController();

            const cancelButton = document.getElementById('cancel-button');
            cancelButton.onclick = () => {
                abortController.abort();
                setProcessingState(false);
                showMessage('error', 'Image processing aborted by user.');
            };
        } else {
            loader.style.display = 'none';
            submitButton.disabled = false;
            abortController = null;
        }
    }


    function generateUniqueFilename(originalName) {
        const id = crypto.randomUUID();
        const extension = originalName.split('.').pop();
        return `${originalName.replace(/\.[^/.]+$/, '')}_${id}.${extension}`;
    }

    function downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }


    async function getImageDimensions(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = URL.createObjectURL(file);
        });
    }

    async function resizeWithPica(file, maxWidth, maxHeight) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();

        let { width, height } = img;
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        return new Promise(resolve => canvas.toBlob(resolve, file.type));
    }

    async function compressImage(file) {
        try {
            const dimensions = await getImageDimensions(file);
            console.log("Original Size:", (file.size / 1024 / 1024).toFixed(2), "MB");
            console.log("Original Dimensions:", dimensions.width, "x", dimensions.height);

            if (dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT) {
                console.log("Resizing...");
                file = await resizeWithPica(file, MAX_WIDTH, MAX_HEIGHT);
            }

            if (file.size > COMPRESSED_TARGET_SIZE_MB * 1024 * 1024) {
                console.log("Compressing...");
                file = await imageCompression(file, { maxSizeMB: COMPRESSED_TARGET_SIZE_MB, useWebWorker: true });
            }

            return file;
        } catch {
            showMessage('error', 'Image processing failed.');
            return null;
        }
    }
});
