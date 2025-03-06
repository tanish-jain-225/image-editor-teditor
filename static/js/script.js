document.addEventListener('DOMContentLoaded', function () {
    const COMPRESSED_TARGET_SIZE_MB = 4;        // Target size after compression
    const MAX_FILE_SIZE_MB = 10;                 // Max file size limit
    const MAX_WIDTH = 5000;                       // Max image width allowed
    const MAX_HEIGHT = 5000;                      // Max image height allowed

    // Config for different image operations
    const operationsConfig = {
        cpng: { label: "Convert to PNG", fields: [] },
        cgray: { label: "Convert to Grayscale", fields: [] },
        resize: {
            label: "Resize", fields: [
                { name: "width", label: "Width (px)", type: "number", required: true },
                { name: "height", label: "Height (px)", type: "number", required: true }
            ]
        },
        rotate: {
            label: "Rotate", fields: [
                { name: "angle", label: "Rotation Angle (°)", type: "number", required: true }
            ]
        },
        crop: {
            label: "Crop", fields: [
                { name: "x", label: "X Coordinate", type: "number", required: true },
                { name: "y", label: "Y Coordinate", type: "number", required: true },
                { name: "crop_width", label: "Crop Width (px)", type: "number", required: true },
                { name: "crop_height", label: "Crop Height (px)", type: "number", required: true }
            ]
        },
        brightness_contrast: {
            label: "Brightness & Contrast", fields: [
                { name: "brightness", label: "Brightness (0.0 to 2.0)", type: "number", step: "0.1", required: true },
                { name: "contrast", label: "Contrast (0.0 to 2.0)", type: "number", step: "0.1", required: true }
            ]
        },
        flip: {
            label: "Flip", fields: [
                { name: "flip_type", label: "Flip Direction", type: "select", options: ["Horizontal", "Vertical"], required: true }
            ]
        },
        blur: { label: "Blur", fields: [{ name: "blur_radius", label: "Blur Radius (px)", type: "number", required: true }] },
        sharpen: { label: "Sharpen", fields: [] },
        invert: { label: "Invert Colors", fields: [] }
    };

    const form = document.getElementById('editor-form');
    const notifier = document.getElementById('notifier');
    let abortController = null;  // To handle cancellation

    initializeForm();

    // Initialize form elements and event listeners
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

    // Handle cancellation of processing
    function setProcessingState(isProcessing) {
        const loader = document.getElementById('loader');
        const submitButton = form.querySelector('button[type="submit"]');
    
        if (isProcessing) {
            loader.style.display = 'block';
            submitButton.disabled = true;
    
            // Setup abort controller for cancellation
            abortController = new AbortController();
    
            // Attach cancel button click event
            const cancelButton = document.getElementById('cancel-button');
            cancelButton.onclick = () => {
                abortController.abort();  // Trigger fetch abort
                setProcessingState(false);  // Reset processing state
                showMessage('error', 'Image processing aborted by user.');  // Show aborted message with link
            };
        } else {
            loader.style.display = 'none';
            submitButton.disabled = false;
            abortController = null;  // Clear abort controller when not processing
        }
    }
    


    // Populate the operations dropdown
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

    // Render operation-specific input fields dynamically
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
                if (field.step) input.step = field.step;
            }

            if (field.required) input.required = true;
            wrapper.append(label, input);
            container.appendChild(wrapper);
        });
    }

    // Attach event listeners
    function attachEventListeners() {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            showMessage('', '');

            const errors = await validateForm();
            if (errors.length > 0) {
                handleCustomError('formValidationError', errors.join(' '));
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
                    showMessage('success', 'Image processed successfully!');
                } else {
                    handleCustomError('serverError', 'Failed to process image');
                }
            } catch (error) {
                handleCustomError(error.name === 'AbortError' ? 'abortError' : 'networkError', error.message);
            } finally {
                setProcessingState(false);
            }
        });
    }

    // Validate form inputs including image resolution check
    async function validateForm() {
        const file = document.getElementById('file').files[0];

        // Check if file is selected
        if (!file) {
            showMessage('error', "Please select a file.");
            return false;  // Fail fast
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            showMessage('error', `File must be under ${MAX_FILE_SIZE_MB}MB.`);
            return false;  // Fail fast
        }

        // Check dimensions
        const dimensions = await getImageDimensions(file);
        if (dimensions.width > MAX_WIDTH || dimensions.height > MAX_HEIGHT) {
            showMessage('error', `Image dimensions must not exceed ${MAX_WIDTH}x${MAX_HEIGHT} pixels.`);
            return false;  // Fail fast
        }

        // Check if operation is selected
        if (!document.getElementById('operation').value) {
            showMessage('error', "Please select an operation.");
            return false;  // Fail fast
        }

        // If all checks pass, return true
        return true;
    }


    // Get image dimensions
    function getImageDimensions(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = URL.createObjectURL(file);
        });
    }

    // Compress image using browser library
    async function compressImage(file) {
        try {
            return await imageCompression(file, { maxSizeMB: COMPRESSED_TARGET_SIZE_MB, useWebWorker: true });
        } catch {
            handleCustomError('compressionError', 'Image compression failed');
            return null;
        }
    }

    function showMessage(type, message) {
        let link = '';

        // Add appropriate link based on message type
        if (type === 'success') {
            link = ' <a href="/" class="text-decoration-none">Process Another</a>';
        } else {
            link = ' <a href="/" class="text-decoration-none">Try Again</a>';
        }

        // Only show the message if there's a type (error or success)
        notifier.innerHTML = type ? `<span class='text-${type}'>${message}${link}</span>` : '';
    }


    function handleCustomError(type, message) {
        showMessage('danger', `${type}: ${message}`);
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
});
