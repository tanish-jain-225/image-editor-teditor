document.addEventListener('DOMContentLoaded', function () {
    const COMPRESSED_TARGET_SIZE_MB = 4;
    const MAX_FILE_SIZE_MB = 10;
    const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

    const operationsConfig = {
        cpng: { label: "Convert to PNG", fields: [] },
        cjpg: { label: "Convert to JPG", fields: [] },
        cgray: { label: "Convert to Grayscale", fields: [] },
        resize: { label: "Resize", fields: [{ name: "width", label: "Width (px)", type: "number", required: true }, { name: "height", label: "Height (px)", type: "number", required: true }] },
        rotate: { label: "Rotate", fields: [{ name: "angle", label: "Rotation Angle (°)", type: "number", required: true }] },
        crop: { label: "Crop", fields: [{ name: "x", label: "X Coordinate", type: "number", required: true }, { name: "y", label: "Y Coordinate", type: "number", required: true }, { name: "crop_width", label: "Crop Width (px)", type: "number", required: true }, { name: "crop_height", label: "Crop Height (px)", type: "number", required: true }] },
        brightness_contrast: { label: "Brightness & Contrast", fields: [{ name: "brightness", label: "Brightness (0.0 to 2.0)", type: "number", step: "0.1", required: true }, { name: "contrast", label: "Contrast (0.0 to 2.0)", type: "number", step: "0.1", required: true }] },
        flip: { label: "Flip", fields: [{ name: "flip_type", label: "Flip Direction", type: "select", options: ["Horizontal", "Vertical"], required: true }] },
        blur: { label: "Blur", fields: [{ name: "blur_radius", label: "Blur Radius (px)", type: "number", required: true }] },
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
                <p>Processing image, please wait...</p>
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
            label.setAttribute('for', field.name);
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.classList.add('form-select');
                input.name = field.name;
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.toLowerCase();
                    option.textContent = opt;
                    input.appendChild(option);
                });
            } else {
                input = document.createElement('input');
                input.type = field.type;
                input.classList.add('form-control');
                input.name = field.name;
            }
            if (field.required) input.required = true;
            wrapper.appendChild(label);
            wrapper.appendChild(input);
            container.appendChild(wrapper);
        });
    }

    function attachEventListeners() {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            showMessage('', '');
            const errors = validateForm();
            if (errors.length > 0) {
                showMessage('error', errors.join(' '));
                return;
            }
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
                    showMessage('success', 'Image processed successfully! <a href="/" class="text-decoration-none">Process Another</a>');
                } else {
                    showMessage('error', 'Failed to process image. <a href="/" class="text-decoration-none">Try Again</a>');
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    showMessage('error', 'Image processing was cancelled by the user. <a href="/" class="text-decoration-none">Try Again</a>');
                } else {
                    showMessage('error', error.message);
                }
            } finally {
                setProcessingState(false);
            }
        });
    }

    function setProcessingState(isProcessing) {
        const submitButton = form.querySelector('button[type="submit"]');
        const loader = document.getElementById('loader');
        submitButton.disabled = isProcessing;
        loader.style.display = isProcessing ? 'block' : 'none';

        if (isProcessing) {
            abortController = new AbortController();
            document.getElementById('cancel-button').onclick = () => {
                abortController.abort();
                setProcessingState(false);
            };
        } else {
            abortController = null;
        }
    }

    function validateForm() {
        const errors = [];
        const file = document.getElementById('file').files[0];
        const operation = document.getElementById('operation').value;
        if (!file) errors.push("Please select a file.");
        if (!operation) errors.push("Please select an operation.");
        if (file && file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            errors.push(`File size must be under ${MAX_FILE_SIZE_MB}MB.`);
        }
        return errors;
    }

    async function compressImage(file) {
        try {
            return await imageCompression(file, { maxSizeMB: COMPRESSED_TARGET_SIZE_MB, useWebWorker: true });
        } catch {
            showMessage('error', 'Image compression failed.');
            return null;
        }
    }

    function showMessage(type, message) {
        notifier.innerHTML = type === 'success' ? `<span class='text-success'>${message}</span>` : 
                             type === 'error' ? `<span class='text-danger'>${message}</span>` : '';
    }

    function downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    async function fetchWithTimeout(url, options) {
        const controller = abortController || new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        options.signal = controller.signal;
        try {
            return await fetch(url, options);
        } finally {
            clearTimeout(timer);
        }
    }
});
