// Run the script once the page is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('editor-form');

    // Initial basic form structure with file input and operation dropdown
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

    // ===========================
    // Operation Configuration
    // Defines the list of supported operations and their dynamic fields
    // ===========================
    const operationsConfig = {
        cpng: { label: "Convert to PNG", fields: [] },
        cjpg: { label: "Convert to JPG", fields: [] },
        cgray: { label: "Convert to Grayscale", fields: [] },
        resize: {
            label: "Resize",
            fields: [
                { name: "width", label: "Width (px)", type: "number", required: true },
                { name: "height", label: "Height (px)", type: "number", required: true },
            ],
        },
        rotate: {
            label: "Rotate",
            fields: [
                { name: "angle", label: "Rotation Angle (°)", type: "number", required: true },
            ],
        },
        crop: {
            label: "Crop",
            fields: [
                { name: "x", label: "X Coordinate", type: "number", required: true },
                { name: "y", label: "Y Coordinate", type: "number", required: true },
                { name: "width", label: "Width", type: "number", required: true },
                { name: "height", label: "Height", type: "number", required: true },
            ],
        },
        brightness_contrast: {
            label: "Brightness & Contrast",
            fields: [
                { name: "brightness", label: "Brightness (-100 to 100)", type: "number", required: true },
                { name: "contrast", label: "Contrast (-100 to 100)", type: "number", required: true },
            ],
        },
        flip: {
            label: "Flip",
            fields: [
                {
                    name: "flipDirection",
                    label: "Flip Direction",
                    type: "select",
                    options: ["Horizontal", "Vertical"],
                    required: true,
                },
            ],
        },
        blur: {
            label: "Blur",
            fields: [
                { name: "blurRadius", label: "Blur Radius (px)", type: "number", required: true },
            ],
        },
        sharpen: {
            label: "Sharpen",
            fields: [
                { name: "sharpenAmount", label: "Sharpen Amount (0-100)", type: "number", required: true },
            ],
        },
        invert: { label: "Invert Colors", fields: [] },
        // Add new operations here with their respective fields as needed
        // Example - { label: "Operation Name", fields: [ { name: "fieldName", label: "Field Label", type: "text", required: true } ] }, 
    };

    const operationSelect = document.getElementById('operation');
    const dynamicOptionsContainer = document.getElementById('dynamic-options');

    // ===========================
    // Populate Operation Dropdown
    // Loops through operationsConfig and adds them as <option> elements
    // ===========================
    Object.entries(operationsConfig).forEach(([key, { label }]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = label;
        operationSelect.appendChild(option);
    });

    // ===========================
    // Event Listener - Operation Selection
    // When the user selects an operation, render its fields dynamically
    // ===========================
    operationSelect.addEventListener('change', () => {
        const selectedOperation = operationSelect.value;
        renderDynamicFields(selectedOperation);
    });

    // ===========================
    // Render Dynamic Fields
    // Creates input fields based on selected operation's configuration
    // ===========================
    function renderDynamicFields(operation) {
        // Clear any previously rendered fields
        dynamicOptionsContainer.innerHTML = '';

        const { fields } = operationsConfig[operation] || { fields: [] };

        fields.forEach(field => {
            const fieldWrapper = document.createElement('div');
            fieldWrapper.classList.add('mb-3');

            // Create label for the field
            const label = document.createElement('label');
            label.textContent = field.label;
            label.classList.add('form-label');
            label.setAttribute('for', field.name);

            let input;

            // Handle select (dropdown) fields
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

            } else { // Handle standard input fields (text, number, etc.)
                input = document.createElement('input');
                input.type = field.type;
                input.classList.add('form-control');
                input.name = field.name;
            }

            if (field.required) input.required = true;

            // Add label and input to the DOM
            fieldWrapper.appendChild(label);
            fieldWrapper.appendChild(input);
            dynamicOptionsContainer.appendChild(fieldWrapper);
        });
    }

    // ===========================
    // Form Validation & Submission
    // Ensures all required fields are filled and file size limits are respected
    // ===========================

    const RESET_TIMER = 5000; // Reset page after 5 seconds (for UX)

    form.addEventListener("submit", (event) => {
        const file = document.getElementById("file").files[0];

        // File size check - reject files larger than 10MB
        if (file && file.size > 10 * 1024 * 1024) {
            event.preventDefault();
            alert("File size exceeds 10MB limit.");
            window.location.href = "/";
            return;
        }

        // Required fields validation
        if (!validateRequiredFields()) {
            event.preventDefault();
            alert("Please fill out all required fields for the selected operation.");
            window.location.href = "/";
            return;
        }

        // Automatically reset the form after 5 seconds
        setTimeout(() => window.location.href = "/", RESET_TIMER);
    });

    // ===========================
    // Validate Required Fields
    // Loops through required fields and ensures they are not empty
    // ===========================
    function validateRequiredFields() {
        const selectedOperation = operationSelect.value;
        const { fields } = operationsConfig[selectedOperation] || { fields: [] };

        for (const field of fields) {
            if (field.required) {
                const input = form.querySelector(`[name="${field.name}"]`);
                if (input && input.value.trim() === "") {
                    return false;
                }
            }
        }
        return true;
    }
});
