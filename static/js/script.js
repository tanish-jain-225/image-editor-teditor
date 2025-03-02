const operationSelect = document.getElementById("operation");
const form = document.getElementById("editor-form");
const RESET_TIMER = 5000; // 5 seconds interval before Resetting the page

form.addEventListener("submit", (event) => {
    const file = document.getElementById("file").files[0];
    if (file && file.size > 10 * 1024 * 1024) {
        event.preventDefault();
        alert("File size exceeds 10MB limit.");
        window.location.href = "/";
    } else {
        setTimeout(() => (window.location.href = "/"), RESET_TIMER);
    }
});

operationSelect.addEventListener("change", () => {
    document
        .querySelectorAll(".additional-options")
        .forEach((opt) => opt.classList.remove("show-options"));
    const selectedOptions = document.getElementById(
        `${operationSelect.value}-options`
    );
    if (selectedOptions) selectedOptions.classList.add("show-options");
});
