console.log("Modo Login detectado: Saltando verificaciones del panel principal.");
console.warn("--> ATENCIÓN: El archivo externo login.js SÍ se está leyendo.");
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
    ejecutarLogin: async function () {
        var usuarioInput = document.getElementById('login-user');
        var passwordInput = document.getElementById('login-pass');
        var errorLabel = document.getElementById('login-error');

        var usuario = usuarioInput ? usuarioInput.value : '';
        var password = passwordInput ? passwordInput.value : '';

        if (!usuario || !password) {
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
                window.location.href = "./index.html";
            } else {
                var msg = res && res.message ? res.message : "Usuario o contraseña incorrectos.";
                if (errorLabel) {
                    errorLabel.innerText = msg;
                    errorLabel.classList.remove('hidden');
                } else {
                    //alert(msg);
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
console.log("--> login.js cargado y AuthModule listo para usarse.");

// 2. Y al final colocas el escuchador
document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('btn-toggle-pass');
    if (btn) {
        btn.addEventListener('click', AuthModule.togglePasswordVisibility);
        console.log("--> Evento asignado correctamente a btn-toggle-pass");
    }
});