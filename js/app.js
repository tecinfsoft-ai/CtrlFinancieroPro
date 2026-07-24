// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbw7BCRmlIEhrRb_xkj57BlDi-JvAxHU94PQe8FykPsSv0LcFM9yOQpSBAxZ0Xg2hKMI/exec";
let editandoId = null;
let chartH, chartR;

// app.js
window.AppState = {
    movimientos: [],
    categorias: [],
    filtrosActuales: {
        busqueda: '',
        categoria: 'todos',
        mes: new Date().getMonth(),
        año: new Date().getFullYear()
    },
    cargado: false
};

// --- 1. INICIALIZACIÓN (Punto de entrada único) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 🛡️ CONTROL DE SESIÓN SEGURO: Si estamos en el login, no validamos sesión para evitar bucles
    if (window.location.pathname.includes('login.html')) {
        return;
    }

    // 0. VALIDACIÓN DE SEGURIDAD (Control de Sesión para index.html)
    const sesionActiva = localStorage.getItem('usuarioLogueado') || localStorage.getItem('isLoggedIn');
    if (!sesionActiva) {
        window.location.replace("login.html");
        return;
    }

    // 👤 OBTENER EL USUARIO ACTUAL (ej. 'kiara', 'soporte', etc.) para aislar su información
    const usuarioActual = (localStorage.getItem('usuarioLogueado') || 'default').toLowerCase();

    // 1. DEFINICIÓN DE TIEMPO
    const ahora = new Date();
    const hoyStr = ahora.toISOString().split('T')[0];

    // 2. ASEGURAR QUE EL ESTADO GLOBAL EXISTA
    window.AppState = window.AppState || {};
    window.AppState.filtrosActuales = window.AppState.filtrosActuales || {};

    // 3. RECUPERAR ESTADO EXCLUSIVO DEL USUARIO ACTIVO (Cache Primero con clave por usuario)
    const savedState = localStorage.getItem(`financiero_state_${usuarioActual}`);
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            if (parsed.movimientos) window.AppState.movimientos = parsed.movimientos;
            if (parsed.filtrosActuales) window.AppState.filtrosActuales = parsed.filtrosActuales;
        } catch (e) {
            console.error("Error al recuperar estado:", e);
        }
    }

    // 4. APLICAR VALORES POR DEFECTO PARA RANGOS (Aislados por usuario en sessionStorage)
    const primerDiaMesStr = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];

    if (!window.AppState.filtrosActuales.inicio) {
        window.AppState.filtrosActuales.inicio = sessionStorage.getItem(`${usuarioActual}_filtro_analisis_inicio`) || primerDiaMesStr;
    }
    if (!window.AppState.filtrosActuales.fin) {
        window.AppState.filtrosActuales.fin = sessionStorage.getItem(`${usuarioActual}_filtro_analisis_fin`) || hoyStr;
    }

    // Mantener compatibilidad si alguna sección sigue usando mes/año numéricos
    if (window.AppState.filtrosActuales.mes === undefined) {
        window.AppState.filtrosActuales.mes = ahora.getMonth();
    }
    if (window.AppState.filtrosActuales.año === undefined) {
        window.AppState.filtrosActuales.año = ahora.getFullYear();
    }

    // 5. ACTUALIZAR UI (Encabezado y Sección)
    const headerDate = document.getElementById('fecha-header');
    if (headerDate) {
        const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        headerDate.innerText = ahora.toLocaleDateString('es-MX', opciones).toUpperCase();
    }

    // Navegación persistente por usuario
    const ultimaSeccion = localStorage.getItem(`${usuarioActual}_ultima_seccion`) || 'home';
    await showSection(ultimaSeccion);

    // Activar botón nav
    const btn = document.getElementById(`nav-${ultimaSeccion}`);
    if (btn) {
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
        btn.classList.add('nav-active');
    }

    // 6. SINCRONIZAR SELECTORES Y INPUTS DE FECHA EN LA UI
    const state = window.AppState;

    const inputAnInicio = document.getElementById('an-fecha-inicio');
    const inputAnFin = document.getElementById('an-fecha-fin');
    if (inputAnInicio) inputAnInicio.value = state.filtrosActuales.inicio;
    if (inputAnFin) inputAnFin.value = state.filtrosActuales.fin;

    const inputIngresoFecha = document.getElementById('in-fecha-inicio');
    if (inputIngresoFecha && sessionStorage.getItem(`${usuarioActual}_filtro_ingresos_inicio`)) {
        inputIngresoFecha.value = sessionStorage.getItem(`${usuarioActual}_filtro_ingresos_inicio`);
    }

    const inputGastoFecha = document.getElementById('ex-fecha-inicio');
    if (inputGastoFecha && sessionStorage.getItem(`${usuarioActual}_filtro_gastos_inicio`)) {
        inputGastoFecha.value = sessionStorage.getItem(`${usuarioActual}_filtro_gastos_inicio`);
    }

    // Sincronizar selectores tradicionales
    const selectoresMes = ['in-mes', 'ex-mes', 'res-mes'];
    const selectoresAnio = ['in-año', 'ex-año', 'res-año'];

    selectoresMes.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = state.filtrosActuales.mes;
    });

    selectoresAnio.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = state.filtrosActuales.año;
    });

    const inputFecha = document.getElementById('in-fecha');
    if (inputFecha) {
        inputFecha.value = hoyStr;
    }

    // 7. EJECUTAR REFRESCO INICIAL
    refrescarVistaActual();

    // 8. SINCRONIZACIÓN EN SEGUNDO PLANO
    inicializarSincronizacion().then(() => {
        refrescarVistaActual();
    });
});

// Variable global fuera de la función
let currentLoadId = 0;
async function showSection(sectionId) {
    localStorage.setItem('ultima_seccion', sectionId);
    const container = document.getElementById('app-container');
    if (!container) return;

    const loadId = ++currentLoadId;

    // 1. UI: Feedback inmediato en el menú (sin pantalla de carga)
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    const activeBtn = document.getElementById(`nav-${sectionId}`);
    if (activeBtn) activeBtn.classList.add('nav-active');

    // 🛑 QUITAMOS el toggleLoading(true) de aquí para que las pestañas vuelen sin avisos molestos.

    try {
        // 2. Fetch del HTML de la sección
        const response = await fetch(`${sectionId}.html`);
        if (!response.ok) throw new Error("Error de carga");
        const html = await response.text();

        // 3. Control de concurrencia
        if (loadId !== currentLoadId) return;

        container.innerHTML = html;

        // 4. Renderizado final y repoblación de datos de forma local e instantánea
        requestAnimationFrame(() => {
            const userDisplayEl = document.getElementById('user-display');
            if (userDisplayEl) userDisplayEl.innerText = localStorage.getItem('session_userName') || 'Soporte';

            if (typeof inicializarFiltros === 'function') inicializarFiltros();
            if (typeof configurarEventosFiltros === 'function') configurarEventosFiltros();

            if (sectionId === 'home') {
                // 1. Restaurar filtros guardados del Home (si aplica, por ejemplo, mes y año)
                const mesGuardado = sessionStorage.getItem('filtro_home_mes');
                const anioGuardado = sessionStorage.getItem('filtro_home_anio');

                const mesHomeEl = document.getElementById('ex-mes') || document.getElementById('res-mes'); // Ajusta el ID según tu HTML
                const anioHomeEl = document.getElementById('ex-año') || document.getElementById('res-año');

                if (mesHomeEl && mesGuardado !== null) {
                    mesHomeEl.value = mesGuardado;
                    window.AppState.filtrosActuales.mes = parseInt(mesGuardado);
                }
                if (anioHomeEl && anioGuardado !== null) {
                    anioHomeEl.value = anioGuardado;
                    window.AppState.filtrosActuales.año = parseInt(anioGuardado);
                }

                inicializarFuncionesPorSeccion(sectionId);
                window.ultimaCarga = { i: -1, g: -1 };

                setTimeout(() => {
                    if (typeof actualizarGraficoDistribucion === 'function') {
                        actualizarGraficoDistribucion();
                    }
                }, 200);
            }
            else if (sectionId === 'ingresos') {
                const inicioGuardado = sessionStorage.getItem('filtro_ingresos_inicio');
                const finGuardado = sessionStorage.getItem('filtro_ingresos_fin');
                if (inicioGuardado) { document.getElementById('in-fecha-inicio').value = inicioGuardado; window.AppState.filtrosActuales.inicio = inicioGuardado; }
                if (finGuardado) { document.getElementById('in-fecha-fin').value = finGuardado; window.AppState.filtrosActuales.fin = finGuardado; }

                inicializarFuncionesPorSeccion(sectionId);
            }
            else if (sectionId === 'gastos') {
                const inicioGuardado = sessionStorage.getItem('filtro_gastos_inicio');
                const finGuardado = sessionStorage.getItem('filtro_gastos_fin');
                if (inicioGuardado) { document.getElementById('ex-fecha-inicio').value = inicioGuardado; window.AppState.filtrosActuales.inicio = inicioGuardado; }
                if (finGuardado) { document.getElementById('ex-fecha-fin').value = finGuardado; window.AppState.filtrosActuales.fin = finGuardado; }

                inicializarFuncionesPorSeccion(sectionId);
            }
            else if (sectionId === 'resumen' || sectionId === 'analisis') {
                const inicioGuardado = sessionStorage.getItem('filtro_analisis_inicio');
                const finGuardado = sessionStorage.getItem('filtro_analisis_fin');
                if (inicioGuardado) { document.getElementById('an-fecha-inicio').value = inicioGuardado; window.AppState.filtrosActuales.inicio = inicioGuardado; }
                if (finGuardado) { document.getElementById('an-fecha-fin').value = finGuardado; window.AppState.filtrosActuales.fin = finGuardado; }

                inicializarFuncionesPorSeccion(sectionId);
            }

            const movs = AppState.movimientos || [];
            const cats = AppState.categorias || [];

            const faltanMovimientos = (movs.length === 0);
            const faltanCategorias = (cats.length === 0);

            setTimeout(() => {
                // Solo si de verdad faltan datos y no se han cargado, mostramos carga de forma excepcional
                if ((faltanMovimientos || faltanCategorias) && !AppState.cargado) {
                    if (typeof toggleLoading === 'function') toggleLoading(true);
                    inicializarSincronizacion().then(() => {
                        AppState.cargado = true;
                        inicializarFuncionesPorSeccion(sectionId);
                        refrescarVistaActual();
                        if (typeof toggleLoading === 'function') toggleLoading(false);
                    });
                } else {
                    inicializarFuncionesPorSeccion(sectionId);
                    refrescarVistaActual();
                }
            }, 150);
        });

    } catch (error) {
        if (loadId === currentLoadId) {
            console.error("Error al cargar la sección:", error);
            if (typeof toggleLoading === 'function') toggleLoading(false);
        }
    }
}

// --- 3. LÓGICA DE VISTAS (EN APP.JS) ---
function inicializarFuncionesPorSeccion(sectionId) {
    const idLimpio = sectionId.replace('nav-', '');

    if (idLimpio === 'home') {
        actualizarHome();
        actualizarFechaHeader();
        window.ultimaCarga = { i: -1, g: -1 };
        actualizarGraficoDistribucion();
    }
    else if (idLimpio === 'ingresos') {
        actualizarSelectsCategorias();
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    }
    else if (idLimpio === 'gastos') {
        actualizarSelectsCategorias();
        actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    }
    else if (idLimpio === 'analisis') {
        actualizarResumen();
    }
    else if (idLimpio === 'config') {
        abrirVistaAjustesInteligente();
    }
}

function refrescarVistaActual() {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    ['res', 'ex', 'in', 'an'].forEach(pref => {
        const m = document.getElementById(`${pref}-mes`);
        const a = document.getElementById(`${pref}-año`);

        if (m && !m.value) m.value = mesActual;
        if (a && !a.value) a.value = anioActual;
    });

    try {
        let contenedorFecha = document.getElementById('header-fecha') ||
            document.getElementById('fecha-actual') ||
            document.getElementById('txt-fecha') ||
            document.getElementById('fecha-sistema');

        if (!contenedorFecha) {
            const todosLosElementos = document.querySelectorAll('p, span, div, small, h4');
            const saludoUser = Array.from(todosLosElementos).find(el => el.innerText && el.innerText.toUpperCase().includes('HOLA,'));

            if (saludoUser) {
                if (saludoUser.nextElementSibling) {
                    contenedorFecha = saludoUser.nextElementSibling;
                } else {
                    contenedorFecha = saludoUser.querySelector('span');
                }
            }
        }

        if (contenedorFecha) {
            const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            contenedorFecha.innerText = new Date().toLocaleDateString('es-MX', opciones).toUpperCase();
        }
    } catch (error) {
        console.warn("⚠️ No se pudo auto-detectar el contenedor de la fecha:", error);
    }

    if (typeof actualizarHome === 'function') {
        actualizarHome();
    }

    const activeBtn = document.querySelector('.nav-active');
    const seccionId = activeBtn ? activeBtn.id : '';

    const inputInicioAnálisis = document.getElementById('an-fecha-inicio');
    const inputFinAnálisis = document.getElementById('an-fecha-fin');

    if (inputInicioAnálisis && inputInicioAnálisis.value && inputFinAnálisis && inputFinAnálisis.value) {
        window.AppState.filtrosActuales.inicio = inputInicioAnálisis.value;
        window.AppState.filtrosActuales.fin = inputFinAnálisis.value;

        if (typeof actualizarAnalisisFinanciero === 'function') {
            actualizarAnalisisFinanciero();
        } else if (typeof actualizarResumen === 'function') {
            actualizarResumen();
        }
    }
    else if (seccionId === 'nav-ingresos') {
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    }
    else if (seccionId === 'nav-gastos') {
        const m = document.getElementById('ex-mes');
        const a = document.getElementById('ex-año');
        if (m) window.AppState.filtrosActuales.mes = parseInt(m.value);
        if (a) window.AppState.filtrosActuales.año = parseInt(a.value);

        actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    }
    else if (seccionId === 'nav-resumen') {
        const m = document.getElementById('res-mes');
        const a = document.getElementById('res-año');
        if (m) window.AppState.filtrosActuales.mes = parseInt(m.value);
        if (a) window.AppState.filtrosActuales.año = parseInt(a.value);

        if (typeof actualizarResumen === 'function') {
            actualizarResumen();
        }
    }

    requestAnimationFrame(() => {
        if (typeof window.actualizarGraficoDistribucion === 'function') {
            window.actualizarGraficoDistribucion();
        }

        if (seccionId === 'resumen' || seccionId === 'analisis' || seccionId === 'nav-resumen') {
            if (typeof window.actualizarResumen === 'function') {
                window.actualizarResumen();
            }
        }
    });
}

window.obtenerMovimientosFiltrados = function () {
    const movimientos = window.AppState?.movimientos || [];
    const { inicio, fin } = window.AppState?.filtrosActuales || {};

    if (inicio && fin) {
        const inicioTime = new Date(inicio + 'T00:00:00').getTime();
        const finTime = new Date(fin + 'T23:59:59').getTime();

        return movimientos.filter(m => {
            if (!m.fecha) return false;

            let movTime = NaN;
            let fechaStr = String(m.fecha).trim();

            if (fechaStr.includes('-')) {
                const soloFecha = fechaStr.split('T')[0];
                movTime = new Date(soloFecha + 'T00:00:00').getTime();
            } else if (fechaStr.includes('/')) {
                const partes = fechaStr.split('/');
                if (partes.length === 3) {
                    movTime = new Date(`${partes[2]}-${partes[1]}-${partes[0]}T00:00:00`).getTime();
                }
            } else {
                movTime = new Date(m.fecha).getTime();
            }

            if (isNaN(movTime)) return false;

            return movTime >= inicioTime && movTime <= finTime;
        });
    }

    return movimientos;
}

function fMXN(monto) {
    const valor = parseFloat(monto);

    if (isNaN(valor)) {
        console.warn("Valor inválido detectado para formato:", monto);
        return "$0.00";
    }

    return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

window.formatearFechaMX = function (fechaString) {
    if (!fechaString) return "";
    
    // Si por alguna razón viene con hora o formato largo de Google Sheets, lo limpiamos
    const fechaLimpia = String(fechaString).split('T')[0];
    
    // Si viene en formato YYYY-MM-DD
    if (fechaLimpia.includes('-')) {
        const partes = fechaLimpia.split('-');
        if (partes.length === 3) {
            // Retorna directamente DD/MM/YYYY usando los valores exactos del texto
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
    }
    
    // Si ya viene en otro formato o texto plano, lo devolvemos tal cual
    return fechaString;
};

window.guardarFiltrosHome = function() {
    const mes = document.getElementById('ex-mes')?.value;
    const anio = document.getElementById('ex-año')?.value;

    if (mes !== undefined) sessionStorage.setItem('filtro_home_mes', mes);
    if (anio !== undefined) sessionStorage.setItem('filtro_home_anio', anio);
};

window.guardarFiltrosIngresos = function() {
    const inicio = document.getElementById('in-fecha-inicio')?.value;
    const fin = document.getElementById('in-fecha-fin')?.value;
    if (inicio) sessionStorage.setItem('filtro_ingresos_inicio', inicio);
    if (fin) sessionStorage.setItem('filtro_ingresos_fin', fin);
};

window.guardarFiltrosGastos = function() {
    const inicio = document.getElementById('ex-fecha-inicio')?.value;
    const fin = document.getElementById('ex-fecha-fin')?.value;
    if (inicio) sessionStorage.setItem('filtro_gastos_inicio', inicio);
    if (fin) sessionStorage.setItem('filtro_gastos_fin', fin);
};

window.guardarFiltrosAnalisis = function() {
    const inicio = document.getElementById('an-fecha-inicio')?.value;
    const fin = document.getElementById('an-fecha-fin')?.value;
    if (inicio) sessionStorage.setItem('filtro_analisis_inicio', inicio);
    if (fin) sessionStorage.setItem('filtro_analisis_fin', fin);
};