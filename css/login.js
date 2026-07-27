console.log("Modo Login detectado: Saltando verificaciones del panel principal.");
console.warn("--> ATENCIÓN: El archivo externo login.js SÍ se está leyendo.");

// Función global asegurada para el overlay de carga
window.toggleLoading = function(show) {
    var loader = document.getElementById('loading-overlay');
    if (loader) {
        if (show) {
            loader.classList.remove('opacity-0', 'pointer-events-none');
            loader.classList.add('opacity-100');
        } else {
            loader.classList.remove('opacity-100');
            loader.classList.add('opacity-0', 'pointer-events-none');
        }
    }
};

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
            if (eyeOpen) eyeOpen.style.display = 'none';
            if (eyeClosed) eyeClosed.style.display = 'block';
        } else {
            passInput.type = 'password';
            if (eyeOpen) eyeOpen.style.display = 'block';
            if (eyeClosed) eyeClosed.style.display = 'none';
        }
    },

    // Función para procesar el inicio de sesión
    ejecutarLogin: async function () {
        // 1. Activamos el spinner de carga inmediatamente al hacer clic
        if (typeof toggleLoading === 'function') {
            toggleLoading(true);
        }

        var usuarioInput = document.getElementById('login-user');
        var passwordInput = document.getElementById('login-pass');
        var errorLabel = document.getElementById('login-error');

        var usuario = usuarioInput ? usuarioInput.value : '';
        var password = passwordInput ? passwordInput.value : '';

        if (!usuario || !password) {
            // Si faltan datos, apagamos el spinner de inmediato antes de salir
            if (typeof toggleLoading === 'function') {
                toggleLoading(false);
            }

            if (errorLabel) {
                errorLabel.innerText = "Por favor llena todos los campos.";
                errorLabel.classList.remove('hidden');
            } else {
                alert("Por favor llena todos los campos.");
            }
            return;
        }

        try {
            // Llama a la API global de app.js
            var res = await FetchAPI("login", { usuario: usuario, password: password });

            if (res && res.success) {
                localStorage.setItem('session_user', res.usuario);
                localStorage.setItem('session_userName', res.userName);

                if (errorLabel) {
                    errorLabel.classList.add('hidden');
                }

                // Damos un respiro visible de 600ms con el spinner activo antes de cambiar de página
                setTimeout(() => {
                    window.location.href = "./index.html";
                }, 600);

            } else {
                // Si el servidor rechaza las credenciales, apagamos el spinner
                if (typeof toggleLoading === 'function') {
                    toggleLoading(false);
                }

                var msg = res && res.message ? res.message : "Usuario o contraseña incorrectos.";
                if (errorLabel) {
                    errorLabel.innerText = msg;
                    errorLabel.classList.remove('hidden');
                }
            }
        } catch (err) {
            // Si ocurre un error de red, apagamos el spinner
            if (typeof toggleLoading === 'function') {
                toggleLoading(false);
            }

            console.error("Error en la petición de login:", err);
            alert("Hubo un problema al conectar con el servidor.");
        }
    }
};

// Lo registramos en la ventana global
window.AuthModule = AuthModule;
console.log("--> login.js cargado y AuthModule listo para usarse.");

// Y al final colocas el escuchador
document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('btn-toggle-pass');
    if (btn) {
        btn.addEventListener('click', AuthModule.togglePasswordVisibility);
        console.log("--> Evento asignado correctamente a btn-toggle-pass");
    }
});