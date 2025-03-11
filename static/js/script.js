document.addEventListener('DOMContentLoaded', function () {
    // Configuration settings
    const COMPRESSED_TARGET_SIZE = 4 * 1024 * 1024; // 4MB in bytes (max allowed size for compression)
    const MAX_WIDTH = 5000;               // Maximum image width allowed
    const MAX_HEIGHT = 5000;              // Maximum image height allowed

    // Defines available image operations and their input fields
    const operationsConfig = {
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
        invert: { label: "Invert Colors", fields: [] },
        blur: {
            label: "Blur",
            fields: [
                { name: "blur_radius", label: "Blur Radius (px)", type: "text", required: true }
            ]
        },
        sharpen: {
            label: "Sharpen",
            fields: [
                { name: "sharpen_intensity", label: "Sharpen Intensity (px)", type: "text", required: true }
            ]
        }, 
        // Add new operations here
        // Example:
        // new_operation: { label: "Operation Label", fields: [{ name: "field_name", label: "Field Label", type: "text", required: true }] }
    };

    const form = document.getElementById('editor-form');
    const notifier = document.getElementById('notifier');

    // Initializes form UI components
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

    // Populates the dropdown menu with available operations
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

    // Dynamically generates input fields based on selected operation
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
            const processedFile = await processImage(file);
            if (!processedFile) return;

            const formData = new FormData(form);
            formData.set('file', processedFile, uniqueFilename);
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

    async function processImage(file) {
        let processedFile = file;
        processedFile = await resizeWithPica(processedFile);
        processedFile = await compressImage(processedFile);
        return processedFile;
    }

    async function resizeWithPica(file) {
        const dimensions = await getImageDimensions(file);

        if (dimensions.width <= MAX_WIDTH && dimensions.height <= MAX_HEIGHT) {
            return file;
        }

        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();

        let { width, height } = dimensions;
        const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const picaInstance = window.pica();
        const resizedBlob = await picaInstance.toBlob(canvas, file.type, 0.9);

        return new File([resizedBlob], file.name, { type: file.type });
    }

    async function compressImage(file) {
        try {
            const originalSize = await getImageSize(file);
            if (originalSize <= COMPRESSED_TARGET_SIZE) return file;

            const compressedFile = await imageCompression(file, {
                maxSizeMB: COMPRESSED_TARGET_SIZE / (1024 * 1024),
                maxWidthOrHeight: MAX_WIDTH,
                useWebWorker: true
            });

            return compressedFile;
        } catch (error) {
            showMessage('error', 'Image compression failed.');
            return null;
        }
    }

    function showMessage(type, message) {
        const color = type === 'success' ? 'green' : type === 'error' ? 'red' : 'black';
        let actionLink = type === "error"
            ? `<a href="/" style="color:blue;">Try Again</a>`
            : `<a href="/" style="color:blue;">Process Another</a>`;

        notifier.innerHTML = `<span style="color:${color};">${message} ${actionLink}</span>`;
    }
});
