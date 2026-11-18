document.getElementById("loginForm").addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const email = document.getElementById("email").value.trim();

        const password = document.getElementById("password").value;

        const role = document.getElementById("role").value;

        try {

            const response = await fetch("/api/auth/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "same-origin",

                body: JSON.stringify({
                    email,
                    password,
                    role
                })

            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);
            }

            location.href = data.redirect;

        } catch (error) {

            alert(error.message);

        }

    }
);