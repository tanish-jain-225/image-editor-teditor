// Wait for the DOM to fully load before initializing
document.addEventListener('DOMContentLoaded', function () {

    const COMPRESSED_TARGET_SIZE_MB = 4;
    const MAX_FILE_SIZE_MB = 10;

    const operationsConfig = {
        cpng: { label: "Convert to PNG", fields: [] },
        cjpg: { label: "Convert to JPG", fields: [] },
        cgray: { label: "Convert to Grayscale", fields: [] },
        resize: {
            label: "Resize",
            fields: [
                { name: "width", label: "Width (px)", type: "number", placeholder: "e.g., 800", required: true },
                { name: "height", label: "Height (px)", type: "number", placeholder: "e.g., 600", required: true }
            ]
        },
        rotate: {
            label: "Rotate",
            fields: [
                { name: "angle", label: "Rotation Angle (°)", type: "number", placeholder: "e.g., 90", required: true }
            ]
        },
        crop: {
            label: "Crop",
            fields: [
                { name: "x", label: "X Coordinate", type: "number", placeholder: "e.g., 100", required: true },
                { name: "y", label: "Y Coordinate", type: "number", placeholder: "e.g., 100", required: true },
                { name: "crop_width", label: "Crop Width (px)", type: "number", placeholder: "e.g., 400", required: true },
                { name: "crop_height", label: "Crop Height (px)", type: "number", placeholder: "e.g., 300", required: true }
            ]
        },
        brightness_contrast: {
            label: "Brightness & Contrast",
            fields: [
                { name: "brightness", label: "Brightness (0.0 to 2.0)", type: "number", placeholder: "1.0 (normal)", step: "0.1", required: true },
                { name: "contrast", label: "Contrast (0.0 to 2.0)", type: "number", placeholder: "1.0 (normal)", step: "0.1", required: true }
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
                { name: "blur_radius", label: "Blur Radius (px)", type: "number", placeholder: "e.g., 5", required: true }
            ]
        },
        sharpen: { label: "Sharpen", fields: [] },
        invert: { label: "Invert Colors", fields: [] },
        // Add more operations here
        // Example - { label: "Operation Name", fields: [{ name: "field_name", label: "Field Label", type: "text", placeholder: "Field Placeholder", required: true }] }
    };

    const form = document.getElementById('editor-form');
    const notifier = document.getElementById('notifier');

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
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p>Processing image, please wait...</p>
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
                if (field.placeholder) input.placeholder = field.placeholder;
                if (field.step) input.step = field.step;
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
            clearNotifier();

            const errors = validateForm();
            if (errors.length > 0) {
                showErrors(errors);
                return;
            }

            const file = document.getElementById('file').files[0];
            const compressedFile = await compressImage(file);
            if (!compressedFile) return;

            const formData = new FormData(form);
            formData.set('file', compressedFile, compressedFile.name);

            setProcessingState(true);  // Disable button and show loader

            try {
                const response = await fetch('/edit', { method: 'POST', body: formData });

                if (response.ok) {
                    const blob = await response.blob();
                    downloadBlob(blob, 'edited_image.png');
                    showSuccess();
                } else {
                    showErrors(["Failed to process image."]);
                }
            } catch {
                showErrors(["Error occurred while processing the image."]);
            } finally {
                setProcessingState(false);  // Re-enable button and hide loader
            }
        });
    }

    function setProcessingState(isProcessing) {
        const button = form.querySelector('button[type="submit"]');
        const loader = document.getElementById('loader');

        button.disabled = isProcessing;
        loader.style.display = isProcessing ? 'block' : 'none';
    }

    function validateForm() {
        const errors = [];
        const file = document.getElementById('file').files[0];
        const operation = document.getElementById('operation').value;

        if (!file) {
            errors.push("Please select a file.");
        } else {
            if (!['image/png', 'image/jpeg'].includes(file.type)) {
                errors.push("Only PNG and JPG files are allowed.");
            }
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                errors.push(`File size must be under ${MAX_FILE_SIZE_MB}MB.`);
            }
        }

        if (!operation) errors.push("Please select an operation.");

        (operationsConfig[operation]?.fields || []).forEach(field => {
            const input = form.querySelector(`[name="${field.name}"]`);
            if (field.required && (!input || input.value.trim() === '')) {
                errors.push(`${field.label} is required.`);
            }
        });

        return errors;
    }

    async function compressImage(file) {
        const options = { maxSizeMB: COMPRESSED_TARGET_SIZE_MB, maxWidthOrHeight: 2000, useWebWorker: true };
        try {
            return await imageCompression(file, options);
        } catch {
            showErrors(["Image compression failed."]);
            return null;
        }
    }

    function showErrors(errors) { notifier.innerHTML = `<div><span class='text-danger'>Image process failed!</span> <a href="/" class="text-decoration-none">Try Again</a></div>`; }
    function showSuccess() { notifier.innerHTML = `<div><span class='text-success'>Image processed successfully!</span> <a href="/" class="text-decoration-none">Process Another</a></div>`; }
    function clearNotifier() { notifier.innerHTML = ''; }
    function downloadBlob(blob, filename) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); }
});
