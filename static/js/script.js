document.addEventListener('DOMContentLoaded', function () {
    const COMPRESSED_TARGET_SIZE_MB = 4;        // Target size after compression
    const MAX_FILE_SIZE_MB = 10;                 // Max file size limit
    const MAX_WIDTH = 5000;                       // Max image width allowed
    const MAX_HEIGHT = 5000;                      // Max image height allowed

    const operationsConfig = {
        cpng: {
            label: "Convert to PNG",
            fields: []
        },
        cgray: {
            label: "Convert to Grayscale",
            fields: []
        },
        resize: {
            label: "Resize",
            fields: [
                { name: "width", label: "Width (px)", type: "number", required: true },
                { name: "height", label: "Height (px)", type: "number", required: true }
            ]
        },
        rotate: {
            label: "Rotate",
            fields: [
                { name: "angle", label: "Rotation Angle (°)", type: "number", required: true }
            ]
        },
        crop: {
            label: "Crop",
            fields: [
                { name: "x", label: "X Coordinate", type: "number", required: true },
                { name: "y", label: "Y Coordinate", type: "number", required: true },
                { name: "crop_width", label: "Crop Width (px)", type: "number", required: true },
                { name: "crop_height", label: "Crop Height (px)", type: "number", required: true }
            ]
        },
        brightness_contrast: {
            label: "Brightness & Contrast",
            fields: [
                { name: "brightness", label: "Brightness (0.0 to 2.0)", type: "number", step: "0.1", required: true },
                { name: "contrast", label: "Contrast (0.0 to 2.0)", type: "number", step: "0.1", required: true }
            ]
        },
        flip: {
            label: "Flip",
            fields: [
                { name: "flip_type", label: "Flip Direction", type: "select", options: ["Horizontal", "Vertical"], required: true }
            ]
        },
        blur: {
            label: "Blur",
            fields: [
                { name: "blur_radius", label: "Blur Radius (px)", type: "number", required: true }
            ]
        },
        sharpen: {
            label: "Sharpen",
            fields: []
        },
        invert: {
            label: "Invert Colors",
            fields: []
        }
    };


    const form = document.getElementById('editor-form');
    const notifier = document.getElementById('notifier');
    let abortController = null;  // To handle cancellation

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

            const valid = await validateForm();
            if (!valid) return;  // Stop on first error

            const file = document.getElementById('file').files[0];
            const compressedFile = await compressImage(file);
            if (!compressedFile) return;

            const formData = new FormData(form);
            formData.set('file', compressedFile, compressedFile.name);

            setProcessingState(true);

            try {
                const response = await fetchWithTimeout('/edit', { method: 'POST', body: formData });
                if (response.ok) {
                    const blob = await response.blob();
                    downloadBlob(blob, 'edited_image.png');
                    showMessage('success', 'Image processed successfully!');
                } else {
                    showMessage('error', 'Failed to process image.');
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    showMessage('error', 'Image processing aborted by user.');
                } else {
                    showMessage('error', 'Network error occurred.');
                }
            } finally {
                setProcessingState(false);
            }
        });
    }

    async function validateForm() {
        const file = document.getElementById('file').files[0];
        if (!file) {
            showMessage('error', 'Please select a file.');
            return false;
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            showMessage('error', `File must be under ${MAX_FILE_SIZE_MB}MB.`);
            return false;
        }

        const dimensions = await getImageDimensions(file);
        if (dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT) {
            showMessage('error', `Image dimensions must not exceed ${MAX_WIDTH}x${MAX_HEIGHT} pixels.`);
            return false;
        }

        if (!document.getElementById('operation').value) {
            showMessage('error', 'Please select an operation.');
            return false;
        }

        return true;
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

    function downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    async function fetchWithTimeout(url, options) {
        options.signal = (abortController = new AbortController()).signal;
        return await fetch(url, options);
    }

    async function getImageDimensions(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = URL.createObjectURL(file);
        });
    }

    async function compressImage(file) {
        try {
            return await imageCompression(file, { maxSizeMB: COMPRESSED_TARGET_SIZE_MB, useWebWorker: true });
        } catch {
            showMessage('error', 'Image compression failed.');
            return null;
        }
    }
});
