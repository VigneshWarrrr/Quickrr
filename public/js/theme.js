async function applySavedTheme() {
    try {
        const response = await fetch("/api/auth/preferences", { credentials: "same-origin" });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Could not load theme (${response.status}).`);
        }
        document.body.dataset.theme = result.theme === "dark" ? "dark" : "light";
    } catch (error) {
        console.error("Could not load the saved theme:", error);
    }
}

applySavedTheme();
