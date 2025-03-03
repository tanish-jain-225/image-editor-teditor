document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('editor-form');

    // ===========================
    // Centralized Operation Configuration
    // ===========================
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
                {
                    name: "flip_type",
                    label: "Flip Direction",
                    type: "select",
                    options: ["Horizontal", "Vertical"],
                    required: true
                }
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

    // ===========================
    // Initial Form Setup
    // ===========================
    function initializeForm() {
        form.innerHTML = `
            <div class="mb-3">
                <label for="file" class="form-label">Select an Image to Edit</label>
                <input type="file" class="form-control" id="file" name="file" required />
            </div>

            <div class="mb-3">
                <label for="operation" class="form-label">Choose an Operation</label>
                <select class="form-select" id="operation" name="operation" required>
                    <option value="" disabled selected>Select Operation</option>
                </select>
            </div>

            <div id="dynamic-options" class="mt-3"></div>

            <button type="submit" class="btn btn-success w-100 mt-4">Download Image</button>
        `;

        populateOperationDropdown();
        attachEventListeners();
    }

    // ===========================
    // Populate Operations Dropdown
    // ===========================
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

    // ===========================
    // Dynamic Field Rendering
    // ===========================
    function renderDynamicFields(operationKey) {
        const dynamicOptionsContainer = document.getElementById('dynamic-options');
        dynamicOptionsContainer.innerHTML = '';

        const fields = operationsConfig[operationKey]?.fields || [];

        fields.forEach(field => {
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

    // ===========================
    // Form Submission Handling
    // ===========================
    function attachEventListeners() {
        form.addEventListener('submit', (event) => {
            const file = document.getElementById('file').files[0];

            if (file && file.size > 10 * 1024 * 1024) {
                event.preventDefault();
                alert("File size exceeds 10MB limit.");
                return;
            }

            if (!validateRequiredFields()) {
                event.preventDefault();
                alert("Please fill out all required fields.");
                return;
            }
        });
    }

    // ===========================
    // Field Validation
    // ===========================
    function validateRequiredFields() {
        const selectedOperation = document.getElementById('operation').value;
        const fields = operationsConfig[selectedOperation]?.fields || [];

        return fields.every(field => {
            if (field.required) {
                const input = form.querySelector(`[name="${field.name}"]`);
                return input && input.value.trim() !== "";
            }
            return true;
        });
    }

    // Initialize everything
    initializeForm();
});
