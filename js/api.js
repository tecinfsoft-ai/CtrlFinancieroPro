// --- ENVIAR DATOS A APPS SCRIPT ---
async function FetchAPI(action, extraData = {}) {
    toggleLoading(true);
    // 1. Preparamos el objeto con la acción y los datos extra
    const payload = {
        action: action,
        ...extraData
    };
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                // Forzamos explícitamente texto plano para evadir el preflight
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload),
            redirect: 'follow' // Crucial para Google Apps Script
        });

        // 2. Intentamos parsear la respuesta
        const data = await response.json();

        /*if (!data.success) {
            alert("Error: " + (data.message || "Sin mensaje de error"));
        }*/
        return data;

    } catch (error) {
        console.error("Error en la petición:", error);
        // Este alert es justo el que estabas viendo en tu pantalla
        alert("Error de conexión con Google Sheets.");
        return { success: false };
    } finally {
        toggleLoading(false);
    }
}

async function inicializarSincronizacion() {
    const state = window.AppState;
    const loader = document.getElementById('loader');

    // 1. Carga Rápida (Local)
    const guardado = localStorage.getItem('financiero_state');
    if (guardado) {
        try {
            const cache = JSON.parse(guardado);
            state.movimientos = cache.movimientos || [];
            state.categorias = cache.categorias || [];
            // Si hay datos en caché, ocultamos el loader de inmediato
            if (loader) loader.style.display = 'none'; 
        } catch (e) { console.error("Error cache:", e); }
    }

    // 2. Sincronización (Red) - SIN BLOQUEAR
    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            if (data && data.movimientos) {
                
                // 🔥 LIMPIEZA AUTOMÁTICA DE FECHAS AL RECIBIRLAS DE LA RED
                data.movimientos.forEach(m => {
                    if (m.fecha) {
                        let fechaStr = String(m.fecha).trim();
                        if (fechaStr.includes('GMT') || fechaStr.includes('May') || fechaStr.includes('Sun') || fechaStr.length > 15) {
                            let d = new Date(fechaStr);
                            if (!isNaN(d)) {
                                let yyyy = d.getUTCFullYear();
                                let mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                                let dd = String(d.getUTCDate()).padStart(2, '0');
                                m.fecha = `${yyyy}-${mm}-${dd}`;
                            }
                        }
                    }
                });
                // ⬆️ FIN DE LA LIMPIEZA ⬆️

                state.movimientos = data.movimientos;
                state.categorias = data.categorias;
                state.cargado = true;
                localStorage.setItem('financiero_state', JSON.stringify(state));
                refrescarVistaActual(); // Refresca solo cuando llegan los datos nuevos
            }
        })
        .catch(err => console.error("Error red:", err))
        .finally(() => {
            if (loader) loader.style.display = 'none'; // Quitamos el cartel al terminar
        });
}