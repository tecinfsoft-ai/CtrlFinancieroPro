// ========================================================
// MÓDULO DE AUTENTICACIÓN
// ========================================================
var AuthModule = {

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

    ejecutarLogin: async function () {
        if (window._loginEnProceso) return;
        window._loginEnProceso = true;

        var usuario = document.getElementById('login-user').value;
        var password = document.getElementById('login-pass').value;

        if (!usuario || !password) {
            alert("Por favor llena todos los campos.");
            window._loginEnProceso = false;
            return;
        }

        // 1. Activamos el spinner EXCLUSIVAMENTE al presionar ingresar en el login
        if (typeof toggleLoading === 'function') {
            toggleLoading(true);
        }

        // 2. Damos un respiro explícito de 50ms para obligar al navegador a renderizar el overlay
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            var res = await FetchAPI("login", { user: usuario, pass: password });

            if (res && res.success) {
                localStorage.setItem('session_user', res.usuario || res.user);
                localStorage.setItem('session_userName', res.userName || "Usuario");
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('ultima_seccion', 'home');

                // 📥 Descargamos los datos iniciales una sola vez antes de saltar al home
                if (typeof inicializarSincronizacion === 'function') {
                    await inicializarSincronizacion();
                }

                // Mantenemos el spinner visible un momento antes de cambiar de página
                setTimeout(() => {
                    window.location.href = "./index.html";
                }, 600);
            } else {
                if (typeof toggleLoading === 'function') {
                    toggleLoading(false);
                }
                var msg = res && res.message ? res.message : "Usuario o contraseña incorrectos.";
                alert(msg);
                window._loginEnProceso = false;
            }
        } catch (err) {
            if (typeof toggleLoading === 'function') {
                toggleLoading(false);
            }
            console.error("Error atrapado en el login:", err);
            alert("Error al conectar con el servidor. Revisa la consola.");
            window._loginEnProceso = false;
        }
    }
};

window.AuthModule = AuthModule;

// Limpieza de carga al iniciar la pantalla de acceso
document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }

    var btnToggle = document.getElementById('btn-toggle-pass');
    if (btnToggle) {
        btnToggle.addEventListener('click', AuthModule.togglePasswordVisibility);
    }
});