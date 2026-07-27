// ========================================================
// MÓDULO DE AUTENTICACIÓN
// ========================================================
var AuthModule = {

    // Función para ver/ocultar la contraseña
    togglePasswordVisibility: function () {
        var passInput = document.getElementById('login-pass');
        var eyeOpen = document.getElementById('eye-open');
        var eyeClosed = document.getElementById('eye-closed');

        if (!passInput) return;

        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            passInput.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    },

    // Función para procesar el inicio de sesión
    ejecutarLogin: async function (event) {
        if (event) event.preventDefault();

        var usuario = document.getElementById('login-user').value;
        var password = document.getElementById('login-pass').value;

        if (!usuario || !password) {
            alert("Por favor llena todos los campos.");
            return;
        }

        try {
            var res = await FetchAPI("login", { user: usuario, pass: password });

            if (res && res.success) {
                // Guardamos la sesión
                localStorage.setItem('session_user', res.usuario || res.user);
                localStorage.setItem('session_userName', res.userName || "Usuario");
                localStorage.setItem('isLoggedIn', 'true');

                // 🔥 AQUÍ SE CUMPLE TU REGLA AL 100%:
                // Forzamos que la sección inicial sea 'home' obligatoriamente tras iniciar sesión
                localStorage.setItem('ultima_seccion', 'home');

                // ¡DESBLOQUEAMOS LA REDIRECCIÓN!
                window.location.href = "./index.html";
            } else {
                var msg = res && res.message ? res.message : "Usuario o contraseña incorrectos.";
                var errorLabel = document.getElementById('error-label');

                if (errorLabel) {
                    errorLabel.innerText = msg;
                    errorLabel.classList.remove('hidden');
                } else {
                    alert(msg);
                }
            }
        } catch (err) {
            console.error("Error en la petición de login:", err);
            alert("Hubo un problema al conectar con el servidor.");
        }
    }
};

// Lo registramos en la ventana global
window.AuthModule = AuthModule;

// 2. Y al final colocas el escuchador
document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('btn-toggle-pass');
    if (btn) {
        btn.addEventListener('click', AuthModule.togglePasswordVisibility);
    }
});