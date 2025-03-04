document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('editor-form');
    const MAX_FILE_SIZE_MB = 10;
    const COMPRESSED_TARGET_SIZE_MB = 4; // target file size for Vercel safety
    const MAX_REQUESTS = 5;
    const TIME_WINDOW = 60 * 1000; // 1 minute

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
        invert: { label: "Invert Colors", fields: [] }
    };

    initializeForm();

    function initializeForm() {
        form.innerHTML = `
            <input type="file" id="file" name="file" accept="image/*" class="form-control mb-3" required>
            <select id="operation" name="operation" class="form-select mb-3" required>
                <option value="">Select Operation</option>
            </select>
            <div id="dynamic-options"></div>
            <button type="submit" class="btn btn-primary">Submit</button>
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

        operationSelect.addEventListener('change', () => {
            renderDynamicFields(operationSelect.value);
        });
    }

    function renderDynamicFields(operationKey) {
        const dynamicOptionsContainer = document.getElementById('dynamic-options');
        dynamicOptionsContainer.innerHTML = '';

        (operationsConfig[operationKey]?.fields || []).forEach(field => {
            const fieldWrapper = document.createElement('div');
            fieldWrapper.classList.add('mb-3');

            const label = document.createElement('label');
            label.textContent = field.label;
            label.classList.add('form-label');
            label.setAttribute('for', field.name);

            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.classList.add('form-select');
                input.name = field.name;
                field.options.forEach(optionValue => {
                    const option = document.createElement('option');
                    option.value = optionValue.toLowerCase();
                    option.textContent = optionValue;
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

            fieldWrapper.appendChild(label);
            fieldWrapper.appendChild(input);
            dynamicOptionsContainer.appendChild(fieldWrapper);
        });
    }

    async function compressImage(file) {
        const options = {
            maxSizeMB: COMPRESSED_TARGET_SIZE_MB,
            maxWidthOrHeight: 2000,
            useWebWorker: true
        };

        try {
            return await imageCompression(file, options);
        } catch (error) {
            alert("Image compression failed. Please try a smaller file.");
            throw error;
        }
    }

    function attachEventListeners() {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const fileInput = document.getElementById('file');
            const file = fileInput.files[0];

            if (!file) return alert("Please upload an image.");
            if (!['image/png', 'image/jpeg'].includes(file.type)) return alert("Only PNG and JPG are allowed.");
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return alert("File exceeds 10MB limit.");
            if (!validateRequiredFields()) return alert("Please fill out all required fields.");
            if (!checkRateLimit()) return alert("Rate limit exceeded. Wait a minute.");

            try {
                const compressedFile = await compressImage(file);

                const formData = new FormData(form);
                formData.set('file', compressedFile, compressedFile.name);

                const response = await fetch('/edit', { method: 'POST', body: formData });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'edited_image.png';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                } else {
                    alert("Failed to process image.");
                }
            } catch (error) {
                console.error("Image processing error:", error);
                alert("An error occurred. Please try again.");
            }
        });
    }

    function validateRequiredFields() {
        const selectedOperation = document.getElementById('operation').value;
        const fields = operationsConfig[selectedOperation]?.fields || [];
        return fields.every(field => {
            const input = form.querySelector(`[name="${field.name}"]`);
            return !field.required || (input && input.value.trim() !== "");
        });
    }

    function checkRateLimit() {
        const now = Date.now();
        const requests = JSON.parse(localStorage.getItem('requests') || '[]')
            .filter(timestamp => now - timestamp < TIME_WINDOW);

        requests.push(now);
        localStorage.setItem('requests', JSON.stringify(requests));
        return requests.length <= MAX_REQUESTS;
    }
});
