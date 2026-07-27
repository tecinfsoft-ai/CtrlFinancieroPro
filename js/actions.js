// 🔥 INYECTORES GLOBALES DE EMERGENCIA (Deben ir en la línea 1 de actions.js)
Object.defineProperty(window, 'seccionActual', {
    get: function () {
        return localStorage.getItem('ultima_seccion') || 'home';
    },
    configurable: true
});

Object.defineProperty(window, 'movimientos', {
    get: function () {
        return window.AppState?.movimientos || [];
    },
    configurable: true
});

window.EstadoFinanciero = {
    ingresos: 0,
    gastos: 0,
    ultimaCarga: { i: -1, g: -1 }
};

// ==========================================
// FUNCIÓN AUXILIAR PARA COMPROBANTES (NUEVA)
// ==========================================
function archivoABase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        var reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
            nombre: file.name,
            tipo: file.type,
            datos: reader.result.split(',')[1]
        });
        reader.onerror = error => reject(error);
    });
}

// ==========================================
// FUNCIÓN DE GUARDADO PRINCIPAL (ACTUALIZADA)
// ==========================================
async function guardarRegistro(tipo) {
    let btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    if (!btn) return;

    const pref = tipo === 'ingreso' ? 'in' : 'ex';
    const monto = parseFloat(document.getElementById(`${pref}-monto-hidden`).value);

    if (!monto || monto <= 0) {
        alert("Por favor ingresa un monto válido.");
        return;
    }

    // 🛑 1. VALIDACIÓN DE CATEGORÍA OBLIGATORIA
    const selectCat = document.getElementById(`${pref}-categoria`);
    const valorCategoria = selectCat ? selectCat.value.trim().toLowerCase() : "";

    if (!valorCategoria || valorCategoria === "" || valorCategoria === "seleccionar categoria" || valorCategoria === "seleccionarcategoria") {
        alert("Por favor, selecciona una categoría válida.");
        return;
    }

    // 🛑 2. VALIDACIÓN DE CONCEPTO EXCLUSIVA PARA GASTOS
    const inputDesc = document.getElementById(`${pref}-desc`);
    const textoDesc = inputDesc ? inputDesc.value.trim().toUpperCase() : "";

    if (tipo === 'gasto' && !textoDesc) {
        alert("El campo de concepto es obligatorio para los registros de gastos.");
        if (inputDesc) inputDesc.focus();
        return;
    }

    // 📎 3. CAPTURA DE COMPROBANTES (Ticket, PDF y XML)
    const fileTicket = document.getElementById('file-ticket') ? document.getElementById('file-ticket').files[0] : null;
    const filePdf = document.getElementById('file-pdf') ? document.getElementById('file-pdf').files[0] : null;
    const fileXml = document.getElementById('file-xml') ? document.getElementById('file-xml').files[0] : null;

    const comprobanteTicket = await archivoABase64(fileTicket);
    const comprobantePdf = await archivoABase64(filePdf);
    const comprobanteXml = await archivoABase64(fileXml);

    const idMovi = window.editandoId || Date.now();
    const nuevaData = {
        id: idMovi,
        tipo,
        fecha: document.getElementById(`${pref}-fecha`).value,
        cat: selectCat.value.trim().toUpperCase(),
        desc: textoDesc || 'SIN NOMBRE',
        monto,
        ticket: comprobanteTicket,
        facturaPdf: comprobantePdf,
        facturaXml: comprobanteXml
    };

    const esEdicion = !!window.editandoId;
    const estadoAnterior = JSON.stringify(AppState.movimientos);

    if (esEdicion) {
        const idx = AppState.movimientos.findIndex(m => m.id == idMovi);
        if (idx !== -1) AppState.movimientos[idx] = nuevaData;
    } else {
        AppState.movimientos.push(nuevaData);
    }

    localStorage.setItem("financiero_state", JSON.stringify(AppState));
    refrescarVistaActual();

    const textoOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerText = "PROCESANDO...";
    btn.classList.add('opacity-70');

    try {
        const res = await FetchAPI("guardarMovimiento", { data: nuevaData });
        if (!res.success) throw new Error(res.message);

        await inicializarSincronizacion();
        refrescarVistaActual();
        limpiarFormulario(tipo);

        if (document.getElementById('file-ticket')) document.getElementById('file-ticket').value = '';
        if (document.getElementById('file-pdf')) document.getElementById('file-pdf').value = '';
        if (document.getElementById('file-xml')) document.getElementById('file-xml').value = '';
        
    } catch (error) {
        console.error("Error:", error);
        AppState.movimientos = JSON.parse(estadoAnterior);
        localStorage.setItem("financiero_state", JSON.stringify(AppState));
        refrescarVistaActual();
        alert("No se pudo guardar: " + error.message);
        btn.innerText = textoOriginal;
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-70');
    }
}

function limpiarFormulario(tipo) {
    const pref = tipo === 'ingreso' ? 'in' : 'ex';
    const campos = [`${pref}-categoria`, `${pref}-desc`, `${pref}-monto-mask`, `${pref}-monto-hidden`];

    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id.includes('hidden')) ? 0 : "";
    });

    window.editandoId = null;

    const textoTicket = document.getElementById('textoTicketActual');
    const textoPdf = document.getElementById('textoPdfActual');
    const textoXml = document.getElementById('textoXmlActual');

    if (textoTicket) textoTicket.innerHTML = `<span style="color: #6b7280; font-style: italic;">No hay archivo</span>`;
    if (textoPdf) textoPdf.innerHTML = `<span style="color: #6b7280; font-style: italic;">No hay archivo</span>`;
    if (textoXml) textoXml.innerHTML = `<span style="color: #6b7280; font-style: italic;">No hay archivo</span>`;

    if (document.getElementById('file-ticket')) document.getElementById('file-ticket').value = '';
    if (document.getElementById('file-pdf')) document.getElementById('file-pdf').value = '';
    if (document.getElementById('file-xml')) document.getElementById('file-xml').value = '';

    const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    if (btn) {
        btn.innerText = tipo === 'ingreso' ? "GUARDAR REGISTRO" : "REGISTRAR EGRESO";
        btn.classList.remove('ring-4', 'ring-amber-100', 'bg-amber-600', 'opacity-70');
        btn.disabled = false;
    }
}

async function eliminarMovimiento(id) {
    if (!confirm("¿Deseas eliminar este registro de forma permanente?")) return;

    const estadoAnterior = JSON.stringify(AppState.movimientos);
    AppState.movimientos = AppState.movimientos.filter(m => m.id !== id);
    localStorage.setItem("financiero_state", JSON.stringify(AppState));
    refrescarVistaActual();

    try {
        const res = await FetchAPI("eliminarMovimiento", { id });
        if (!res || !res.success) {
            throw new Error(res?.message || "Error al conectar con el servidor");
        }
    } catch (error) {
        console.error("Error al eliminar:", error);
        AppState.movimientos = JSON.parse(estadoAnterior);
        localStorage.setItem("financiero_state", JSON.stringify(AppState));
        refrescarVistaActual();
        alert("No se pudo eliminar el registro: " + error.message);
    }
}

async function agregarCategoria() {
    const inputCat = document.getElementById('nueva-cat-nombre');
    const selectTipo = document.getElementById('nueva-cat-tipo');
    if (!inputCat || !selectTipo) return;

    const nom = inputCat.value.trim().toUpperCase();
    const tipo = selectTipo.value;

    if (!nom || !window.AppState) return;

    const existe = window.AppState.categorias.some(c => c.nombre.toUpperCase() === nom && c.tipo === tipo);
    if (existe) {
        alert("Esta categoría ya existe.");
        return;
    }

    // 🌀 1. MOSTRAR SPINNER FLOTANTE ANTES DE INICIAR CUALQUIER ACCIÓN
    mostrarSpinnerGlobal();

    try {
        const nuevaCat = {
            id: Date.now(),
            nombre: nom,
            tipo: tipo
        };

        window.AppState.categorias.push(nuevaCat);

        localStorage.setItem('cats_mxn', JSON.stringify(window.AppState.categorias));
        if (typeof guardarEstadoGlobal === 'function') {
            guardarEstadoGlobal();
        } else {
            localStorage.setItem('financiero_state', JSON.stringify(window.AppState));
        }

        inputCat.value = '';

        // Petición a la nube de forma totalmente silenciosa (sin alerts)
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "agregarCategoria",
                id: nuevaCat.id,
                nombre: nuevaCat.nombre,
                tipo: nuevaCat.tipo
            })
        });

        // ⏱️ Forzamos una pequeña pausa visual de medio segundo para que el usuario aprecie el spinner
        await new Promise(resolve => setTimeout(resolve, 500));

        if (typeof actualizarSelectsCategorias === 'function') {
            actualizarSelectsCategorias();
        }
        if (typeof abrirVistaAjustesInteligente === 'function') {
            abrirVistaAjustesInteligente();
        }
        if (typeof refrescarVistaActual === 'function') {
            refrescarVistaActual();
        }

    } catch (error) {
        console.error("Error al sincronizar categoría:", error);
    } finally {
        // 🌀 2. OCULTAR SPINNER FLOTANTE AL TERMINAR (Pase lo que pase)
        ocultarSpinnerGlobal();
    }
}

async function eliminarCategoria(id) {
    if (!window.AppState) return;

    const categoriaAEliminar = window.AppState.categorias.find(c => String(c.id) === String(id));
    if (!categoriaAEliminar) return;

    const nombreCat = categoriaAEliminar.nombre;

    const tieneMovimientos = window.AppState.movimientos && window.AppState.movimientos.some(m => {
        if (!m) return false;
        const catMov = (m.cat || m.categoria || "").trim().toUpperCase();
        return catMov === nombreCat.trim().toUpperCase();
    });

    if (tieneMovimientos) {
        alert(`No se puede eliminar la categoría "${nombreCat}" porque tiene movimientos asociados.`);
        return;
    }

    if (!confirm(`¿Estás segura de que deseas eliminar la categoría "${nombreCat}"?`)) {
        return;
    }

    // 🌀 1. MOSTRAR SPINNER GLOBAL
    mostrarSpinnerGlobal();

    try {
        // Actualizamos estado local
        window.AppState.categorias = window.AppState.categorias.filter(c => String(c.id) !== String(id));
        localStorage.setItem('cats_mxn', JSON.stringify(window.AppState.categorias));
        localStorage.setItem('financiero_state', JSON.stringify(window.AppState));

        // Petición a la nube (con un timeout de seguridad por si la red falla)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos máx

        const response = await fetch(API_URL, {
            method: 'POST',
            signal: controller.signal,
            body: JSON.stringify({
                action: "eliminarCategoria",
                id: id
            })
        });
        clearTimeout(timeoutId);
        
        await response.json();

        // ⏱️ Pausa visual fluida para que se aprecie el spinner
        await new Promise(resolve => setTimeout(resolve, 400));

    } catch (error) {
        console.warn("⚠️ Aviso de red al eliminar categoría (se aplicó localmente):", error);
    } finally {
        // 🌀 2. OCULTAR SPINNER GLOBAL SIEMPRE (Pase lo que pase)
        ocultarSpinnerGlobal();
    }

    // Refrescamos las vistas al terminar el proceso de forma segura
    if (typeof abrirVistaAjustesInteligente === 'function') abrirVistaAjustesInteligente();
    if (typeof actualizarSelectsCategorias === 'function') actualizarSelectsCategorias();
    if (typeof refrescarVistaActual === 'function') refrescarVistaActual();
}

function borrarTodo() {
    if (confirm("⚠️ ¿Estás completamente seguro de borrar TODO el historial y las configuraciones del sistema? Esta acción no se puede deshacer.")) {
        localStorage.clear();
        location.reload();
    }
}

function prepararEdicion(id, tipo) {
    const mov = AppState.movimientos.find(m => m.id === id);
    if (!mov) return;

    window.editandoId = id;
    const pref = tipo === 'ingreso' ? 'in' : 'ex';

    const fechaObj = new Date(mov.fecha);
    document.getElementById(`${pref}-fecha`).value = fechaObj.toISOString().split('T')[0];

    const selectCat = document.getElementById(`${pref}-categoria`);

    setTimeout(() => {
        selectCat.value = mov.cat;
        if (selectCat.value !== mov.cat) {
            console.warn("¡Cuidado! No se pudo asignar el valor.");
        }
    }, 200);

    document.getElementById(`${pref}-desc`).value = mov.desc;
    const mask = document.getElementById(`${pref}-monto-mask`);
    const hidden = document.getElementById(`${pref}-monto-hidden`);

    if (mask && hidden) {
        hidden.value = mov.monto;
        mask.value = Number(mov.monto).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    }

    const btn1 = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    if (btn1) {
        btn1.innerText = "ACTUALIZAR REGISTRO";
        btn1.classList.add('ring-4', 'ring-amber-100', 'bg-amber-600');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const camposArchivos = [
        { url: mov.ticket, textoId: 'textoTicketActual' },
        { url: mov.facturaPdf, textoId: 'textoPdfActual' },
        { url: mov.facturaXml, textoId: 'textoXmlActual' }
    ];

    camposArchivos.forEach(item => {
        const span = document.getElementById(item.textoId);
        if (span) {
            const urlArchivo = typeof item.url === 'object' ? item.url?.url : item.url;
            const nombreArchivo = typeof item.url === 'object' ? item.url?.nombre : '';

            if (urlArchivo && urlArchivo.trim() !== "") {
                span.innerHTML = `
                    <a href="${urlArchivo}" target="_blank" style="color: #0284c7; text-decoration: underline; font-weight: 500;">
                        ${nombreArchivo ? nombreArchivo : 'Ver archivo cargado'}
                    </a>
                `;
            } else {
                span.innerHTML = `<span style="color: #6b7280; font-style: italic;">No hay archivo</span>`;
            }
        }
    });
}

// ==========================================
// CONTROL DE GRÁFICOS GLOBALES
// ==========================================
window.chartH = window.chartH || null;
window.miChartResumenInstance = window.miChartResumenInstance || null;
window.ultimaCarga = { i: -1, g: -1 };

window.actualizarGraficoDistribucion = function () {
    const canvas = document.getElementById('chartHome');
    if (!canvas) return;

    const ingresos = window.EstadoFinanciero?.ingresos || 0;
    const gastos = window.EstadoFinanciero?.gastos || 0;

    if (window.chartH && window.ultimaCarga?.i === ingresos && window.ultimaCarga?.g === gastos) {
        return;
    }

    if (window.chartH) {
        window.chartH.destroy();
    }

    const ctx = canvas.getContext('2d');
    window.chartH = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [ingresos, gastos],
                backgroundColor: ['#D6C7B3', '#E5E7EB']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    window.ultimaCarga = { i: ingresos, g: gastos };
};

window.addEventListener('load', async () => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
});

function mostrarSpinnerGlobal() {
    const spinner = document.getElementById('spinner-global');
    if (spinner) {
        spinner.classList.remove('hidden');
        spinner.style.display = 'flex';
    }
}

function ocultarSpinnerGlobal() {
    const spinner = document.getElementById('spinner-global');
    if (spinner) {
        spinner.classList.add('hidden');
        spinner.style.display = 'none';
    }
}

function cerrarSesion() {
    // 1. Obtener el usuario actual antes de eliminar las credenciales
    const usuarioActual = (localStorage.getItem('usuarioLogueado') || localStorage.getItem('session_user') || '').toLowerCase();

    // 2. Borrar los estados, filtros y datos específicos guardados de este usuario
    if (usuarioActual) {
        localStorage.removeItem(`financiero_state_${usuarioActual}`);
        localStorage.removeItem(`${usuarioActual}_ultima_seccion`);
    }

    // 3. Limpiar cualquier residuo genérico en localStorage que use la app
    localStorage.removeItem('usuarioLogueado');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('session_user');
    localStorage.removeItem('session_userName');
    localStorage.removeItem('ultima_seccion');
    localStorage.removeItem('financiero_state'); // Por si quedó alguna llave antigua global

    // 4. Limpiar el almacenamiento de sesión de la pestaña actual
    sessionStorage.clear();

    // 5. Vaciar el estado global en memoria
    if (window.AppState) {
        window.AppState = {};
    }

    // 6. Redirigir de forma segura al login
    window.location.replace("./login.html");
}

function obtenerPeriodoActual() {
    const seccion = window.AppState?.seccionActual || 'home';
    let pref = seccion === 'ingresos' ? 'in' : (seccion === 'gastos' ? 'ex' : 'an');

    // Intentar leer de los inputs de fecha por rango de la vista actual
    const inputInicio = document.getElementById(`${pref}-fecha-inicio`);
    const inputFin = document.getElementById(`${pref}-fecha-fin`);

    if (inputInicio && inputFin && inputInicio.value && inputFin.value) {
        return {
            tipo: 'rango',
            inicio: inputInicio.value,
            fin: inputFin.value,
            // Valores numéricos de respaldo calculados a partir de la fecha de inicio
            mes: new Date(inputInicio.value + 'T00:00:00').getMonth(),
            año: new Date(inputInicio.value + 'T00:00:00').getFullYear()
        };
    }

    // Respaldo para vistas que sigan usando selectores de mes/año tradicionales
    const mesEl = document.getElementById(`${pref}-mes`);
    const anioEl = document.getElementById(`${pref}-año`);

    const ahora = new Date();
    return {
        tipo: 'mes',
        mes: mesEl ? parseInt(mesEl.value) : ahora.getMonth(),
        año: anioEl ? parseInt(anioEl.value) : ahora.getFullYear()
    };
}

function obtenerMovimientosFiltrados() {
    const { mes, año } = obtenerPeriodoActual();
    const listaMovs = window.movimientos || [];

    return listaMovs.filter(m => {
        if (!m.fecha) return false;
        const fechaStr = String(m.fecha).split('T')[0];
        const partes = fechaStr.split('-');
        if (partes.length < 3) return false;

        const anioMov = parseInt(partes[0], 10);
        const mesMov = parseInt(partes[1], 10) - 1;
        return mesMov === mes && anioMov === año;
    });
}

// ========================================================
// FUNCIÓN DE REPORTE FINANCIERO INTEGRADO
// ========================================================
async function exportarFiltradoXLSX(tipo) {
    mostrarSpinnerGlobal();

    try {
        let filtrados = [];
        if (typeof obtenerMovimientosFiltrados === 'function') {
            filtrados = obtenerMovimientosFiltrados();
        }

        if (!filtrados || filtrados.length === 0) {
            const listaGeneral = window.listaIngresos || window.movimientos || [];
            filtrados = listaGeneral.filter(m => String(m.tipo || '').toLowerCase().includes(tipo.toLowerCase()));
        }

        if (!filtrados.length) {
            alert(`Sin movimientos de ${tipo} para el periodo seleccionado.`);
            return;
        }

        const inputsFecha = document.querySelectorAll('input[type="date"]');
        const txtInicio = inputsFecha.length > 0 ? inputsFecha[0].value : '';
        const txtFin = inputsFecha.length > 1 ? inputsFecha[1].value : '';

        const ahora = new Date();
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Detalle');
        let filaFil = 1;

        const periodoTexto = (txtInicio && txtFin) ? `DEL ${txtInicio} AL ${txtFin}` : `PERIODO ACTUAL`;

        filaFil = Encabezado(ws, "DETALLE DE " + tipo.toUpperCase(), filaFil);
        filaFil = Encabezado(ws, periodoTexto, filaFil);
        filaFil = Encabezado(ws, "GENERADO EL " + ahora.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), filaFil);
        filaFil++; 

        if (typeof llenarTablaDetalle === 'function') {
            llenarTablaDetalle(ws, filtrados, filaFil);
        }

        if (typeof descargarArchivo === 'function') {
            await descargarArchivo(workbook, "Detalle_" + tipo + "_" + (txtInicio || 'reporte') + "_al_" + (txtFin || 'fecha'));
        }

    } catch (error) {
        console.error("❌ Error en el proceso:", error);
    } finally {
        ocultarSpinnerGlobal();
    }
}

window.generarLibroContable = async function() {
    console.log("📥 Iniciando diagnóstico de fechas para Reporte Financiero...");

    const fechaInicioStr = document.getElementById('an-fecha-inicio')?.value || window.AppState?.filtrosActuales?.inicio;
    const fechaFinStr = document.getElementById('an-fecha-fin')?.value || window.AppState?.filtrosActuales?.fin;

    console.log("📅 Rango seleccionado en pantalla -> Inicio:", fechaInicioStr, "| Fin:", fechaFinStr);

    if (!fechaInicioStr || !fechaFinStr) {
        alert("Por favor selecciona un rango de fechas válido (Del / Al) antes de generar el reporte.");
        return;
    }

    const fechaInicio = new Date(fechaInicioStr + 'T00:00:00');
    const fechaFin = new Date(fechaFinStr + 'T23:59:59');

    const todosLosMovimientos = window.AppState?.movimientos || [];
    console.log("📦 Total de movimientos en AppState:", todosLosMovimientos.length, todosLosMovimientos);

    const filtrados = todosLosMovimientos.filter(m => {
        if (!m.fecha) return false;

        // Convertir cualquier formato de fecha (string largo, objeto Date o texto) a un objeto Date limpio
        const fechaMov = new Date(m.fecha);
        if (isNaN(fechaMov.getTime())) return false;

        // Limpiar las horas para comparar únicamente las fechas (Año, Mes, Día)
        fechaMov.setHours(0, 0, 0, 0);
        const inicioLimpieza = new Date(fechaInicio);
        inicioLimpieza.setHours(0, 0, 0, 0);
        const finLimpieza = new Date(fechaFin);
        finLimpieza.setHours(23, 59, 59, 999);

        return fechaMov >= inicioLimpieza && fechaMov <= finLimpieza;
    });

    console.log("✅ Movimientos que pasaron el filtro:", filtrados.length);

    if (!filtrados.length) {
        alert("No hay transacciones registradas en este período para generar el reporte. (Revisa la consola con F12 para ver el detalle de fechas).");
        return;
    }

    // Si pasa los filtros, continúa con la creación normal del Excel...
    const workbook = new ExcelJS.Workbook();
    const ahora = new Date();
    const fechaReporteFormateada = ahora.toLocaleDateString('es-MX', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).toUpperCase();
    const periodoTexto = `DEL ${fechaInicio.toLocaleDateString('es-MX')} AL ${fechaFin.toLocaleDateString('es-MX')}`;

    // --- PESTAÑA 1 ---
    const sheetER = workbook.addWorksheet('Estado de Resultados');
    let filaER = 1;
    filaER = Encabezado(sheetER, "ESTADO DE RESULTADOS", filaER);
    filaER = Encabezado(sheetER, "PERIODO " + periodoTexto, filaER);
    filaER = Encabezado(sheetER, "GENERADO EL " + fechaReporteFormateada, filaER);
    filaER++;

    let totalIngresos = 0;
    filaER = TitRepCont(sheetER, "INGRESOS", null, filaER);
    filtrados.filter(m => m.tipo === 'ingreso').forEach(m => {
        filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER);
        totalIngresos += m.monto;
    });
    filaER = TitRepCont(sheetER, "(+) TOTAL INGRESOS", totalIngresos, filaER);
    filaER++;

    let totalGastos = 0;
    filaER = TitRepCont(sheetER, "GASTOS", null, filaER);
    filtrados.filter(m => m.tipo === 'gasto').forEach(m => {
        filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER);
        totalGastos += m.monto;
    });
    filaER = TitRepCont(sheetER, "(-) TOTAL GASTOS", totalGastos, filaER);
    filaER++;

    const utilidad = totalIngresos - totalGastos;
    filaER = UtiNeta(sheetER, "UTILIDAD NETA DEL PERIODO", totalGastos, utilidad, filaER);
    sheetER.views = [{ showGridLines: false }];

    // --- PESTAÑA 2 ---
    const sheetBG = workbook.addWorksheet('Balance General');
    let filaBG = 1;
    filaBG = Encabezado(sheetBG, "BALANCE GENERAL", filaBG);
    filaBG = Encabezado(sheetBG, "CORTE AL: " + fechaFin.toLocaleDateString('es-MX'), filaBG);
    filaBG = Encabezado(sheetBG, "GENERADO EL " + fechaReporteFormateada, filaBG);
    filaBG++;

    let ingHist = 0, gasHist = 0;
    todosLosMovimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingHist += m.monto;
        else gasHist += m.monto;
    });

    filaBG = TitRepCont(sheetBG, "ACTIVOS", null, filaBG);
    filaBG = DatoRepCont(sheetBG, "Efectivo y Equivalentes", ingHist - gasHist, filaBG);
    filaBG = TitRepCont(sheetBG, "TOTAL ACTIVOS", ingHist - gasHist, filaBG);
    filaBG++;

    filaBG = TitRepCont(sheetBG, "PATRIMONIO", null, filaBG);
    filaBG = DatoRepCont(sheetBG, "Utilidades Acumuladas (Ingresos)", ingHist, filaBG);
    filaBG = DatoRepCont(sheetBG, "Gastos Acumulados", -1 * gasHist, filaBG);
    filaBG = UtiNeta(sheetBG, "TOTAL PATRIMONIO", ingHist - gasHist, ingHist - gasHist, filaBG);
    sheetBG.views = [{ showGridLines: false }];

    // --- PESTAÑA 3 ---
    const wsIng = workbook.addWorksheet('Ingresos');
    let filaIng = 1;
    filaIng = Encabezado(wsIng, "DETALLE DE INGRESOS", filaIng);
    filaIng = Encabezado(wsIng, "PERIODO " + periodoTexto, filaIng);
    filaIng = Encabezado(wsIng, "GENERADO EL " + fechaReporteFormateada, filaIng);
    filaIng++;
    if (typeof llenarTablaDetalle === 'function') {
        llenarTablaDetalle(wsIng, filtrados.filter(m => m.tipo === 'ingreso'), filaIng);
    }

    // --- PESTAÑA 4 ---
    const wsGas = workbook.addWorksheet('Gastos');
    let filaGas = 1;
    filaGas = Encabezado(wsGas, "DETALLE DE GASTOS", filaGas);
    filaGas = Encabezado(wsGas, "PERIODO " + periodoTexto, filaGas);
    filaGas = Encabezado(wsGas, "GENERADO EL " + fechaReporteFormateada, filaGas);
    filaGas++;
    if (typeof llenarTablaDetalle === 'function') {
        llenarTablaDetalle(wsGas, filtrados.filter(m => m.tipo === 'gasto'), filaGas);
    }

    if (typeof descargarArchivo === 'function') {
        descargarArchivo(workbook, `RepCont_${fechaInicioStr}_al_${fechaFinStr}`);
    } else {
        console.error("❌ Error: La función 'descargarArchivo' no está definida.");
    }
};

window.exportarFiltradoXLSX = exportarFiltradoXLSX;

function llenarTablaDetalle(ws, datos, filaLle) {
    ws.views = [{ showGridLines: false }];
    const head = ws.getRow(filaLle);
    head.values = ['FECHA', 'CATEGORÍA', 'DESCRIPCIÓN', 'MONTO'];

    head.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
        c.alignment = { horizontal: 'center' };
    });

    head.commit();
    filaLle++;

    datos.forEach((d, i) => {
        const r = ws.getRow(filaLle);
        let fechaFormateada = d.fecha;
        if (d.fecha) {
            const fechaObj = new Date(d.fecha);
            if (!isNaN(fechaObj.getTime())) {
                const dia = String(fechaObj.getDate()).padStart(2, '0');
                const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
                const anio = fechaObj.getFullYear();
                fechaFormateada = `${dia}/${mes}/${anio}`;
            }
        }

        r.values = [fechaFormateada, d.cat, d.desc, d.monto];
        const colorFila = (i % 2 === 0) ? 'FFF2ECE5' : 'FFB9AB97';

        r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFila } };
            cell.font = { size: 12, color: { argb: 'FF45423E' } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } };

            if (colNumber === 1) cell.alignment = { horizontal: 'center' };
            if (colNumber === 4) {
                cell.numFmt = '"$"#,##0.00';
                cell.alignment = { horizontal: 'right' };
            }
        });

        r.commit();
        filaLle++;
    });

    ws.columns.forEach(c => c.width = 22);
}

window.llenarTablaDetalle = llenarTablaDetalle;

// ==========================================
// --- FUNCIONES AUXILIARES PARA EXCEL ---
// ==========================================
function Encabezado(ws, texto, fila) {
    ws.mergeCells(`A${fila}:D${fila}`);
    const cell = ws.getCell(`A${fila}`);
    cell.value = texto.toUpperCase();
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF45423E' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.views = [{ showGridLines: true }];
    ws.getRow(fila).height = 25;

    ws.getColumn('A').width = 35;
    ws.getColumn('B').width = 22;
    ws.getColumn('C').width = 15;
    ws.getColumn('D').width = 15;

    return fila + 1;
}

function TitRepCont(ws, tit, monto, fila) {
    ws.getRow(fila).height = 22;

    const cellA = ws.getCell(`A${fila}`);
    cellA.value = tit.toUpperCase();
    cellA.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
    cellA.alignment = { vertical: 'middle', horizontal: 'left' };

    const cellB = ws.getCell(`B${fila}`);
    cellB.value = monto !== null && monto !== undefined ? monto : "";
    cellB.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
    cellB.alignment = { vertical: 'middle', horizontal: 'right' };
    if (monto !== null && monto !== undefined) {
        cellB.numFmt = '"$"#,##0.00';
    }

    return fila + 1;
}

function DatoRepCont(ws, cat, monto, fila) {
    ws.getRow(fila).height = 20;
    const colorFondo = (fila % 2 !== 0) ? 'FFF5F2EB' : 'FFFFFFFF';
    const bordeGrisFino = { style: 'thin', color: { argb: 'FFEAE6DF' } };

    const cellA = ws.getCell(`A${fila}`);
    cellA.value = cat.toUpperCase();
    cellA.font = { name: 'Arial', size: 10, color: { argb: 'FF45423E' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } };
    cellA.alignment = { vertical: 'middle', horizontal: 'left' };
    cellA.border = { bottom: bordeGrisFino, right: bordeGrisFino };

    const cellB = ws.getCell(`B${fila}`);
    cellB.value = monto;
    cellB.font = { name: 'Arial', size: 10, color: { argb: 'FF45423E' } };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } };
    cellB.alignment = { vertical: 'middle', horizontal: 'right' };
    cellB.numFmt = '"$"#,##0.00';
    cellB.border = { bottom: bordeGrisFino };

    return fila + 1;
}

function UtiNeta(ws, tit, monto, utilidad, fila) {
    ws.getRow(fila).height = 24;

    const cellA = ws.getCell(`A${fila}`);
    cellA.value = tit.toUpperCase();
    cellA.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF45423E' } };
    cellA.alignment = { vertical: 'middle', horizontal: 'left' };

    const cellB = ws.getCell(`B${fila}`);
    cellB.value = utilidad;
    cellB.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: utilidad >= 0 ? 'FFFFFFFF' : 'FFFF8A8A' }
    };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF45423E' } };
    cellB.alignment = { vertical: 'middle', horizontal: 'right' };
    cellB.numFmt = '"$"#,##0.00';

    return fila + 1;
}

async function descargarArchivo(workbook, nombre) { 
    const buffer = await workbook.xlsx.writeBuffer(); 
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); 
    const link = document.createElement('a'); 
    link.href = URL.createObjectURL(blob); 
    link.download = `${nombre}.xlsx`; 
    link.click(); 
}