// 🔥 INYECTORES GLOBALES DE EMERGENCIA (Deben ir en la línea 1 de actions.js)
Object.defineProperty(window, 'seccionActual', {
    get: function () {
        return localStorage.getItem('ultima_seccion') || 'home';
    },
    configurable: true
});

Object.defineProperty(window, 'movimientos', {
    get: function () {
        // Devuelve los movimientos reales desde el estado global seguro
        return window.AppState?.movimientos || [];
    },
    configurable: true
});

window.EstadoFinanciero = {
    ingresos: 0,
    gastos: 0,
    ultimaCarga: { i: -1, g: -1 }
};

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

    const idMovi = window.editandoId || Date.now();
    const nuevaData = {
        id: idMovi,
        tipo,
        fecha: document.getElementById(`${pref}-fecha`).value,
        cat: selectCat.value.trim().toUpperCase(),
        desc: textoDesc || 'SIN NOMBRE',
        monto
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
        
        // --- Sincronización y limpieza ---
        await inicializarSincronizacion();
        refrescarVistaActual();
        limpiarFormulario(tipo);
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

    // Lista de campos específicos
    const campos = [`${pref}-categoria`, `${pref}-desc`, `${pref}-monto-mask`, `${pref}-monto-hidden`];

    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id.includes('hidden')) ? 0 : "";
    });

    window.editandoId = null;

    // Limpieza de estados visuales del botón
    const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    if (btn) {
        btn.innerText = tipo === 'ingreso' ? "GUARDAR REGISTRO" : "REGISTRAR EGRESO";
        btn.classList.remove('ring-4', 'ring-amber-100', 'bg-amber-600', 'opacity-70');
        btn.disabled = false;
    }
}

async function eliminarMovimiento(id) {
    if (!confirm("¿Deseas eliminar este registro de forma permanente?")) return;

    // 1. Guardamos estado previo para revertir si algo falla
    const estadoAnterior = JSON.stringify(AppState.movimientos);

    // 2. ACTUALIZACIÓN OPTIMISTA: Borramos de la memoria inmediatamente
    AppState.movimientos = AppState.movimientos.filter(m => m.id !== id);
    localStorage.setItem("financiero_state", JSON.stringify(AppState));
    refrescarVistaActual(); // La UI se limpia al instante

    try {
        // 3. Petición al servidor
        const res = await FetchAPI("eliminarMovimiento", { id });

        if (!res || !res.success) {
            throw new Error(res?.message || "Error al conectar con el servidor");
        }

        // alert("Eliminado con éxito.");
    } catch (error) {
        // 4. REVERSIÓN SI FALLA
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

    // Validar que no exista ya una categoría con el mismo nombre y tipo para evitar duplicados
    const existe = window.AppState.categorias.some(c => c.nombre.toUpperCase() === nom && c.tipo === tipo);
    if (existe) {
        alert("Esta categoría ya existe.");
        return;
    }

    const nuevaCat = {
        id: Date.now(),
        nombre: nom,
        tipo: tipo
    };

    // 1. Agregar localmente
    window.AppState.categorias.push(nuevaCat);
    
    // Asegurar que se guarde en la estructura global de almacenamiento que lee tu app
    localStorage.setItem('cats_mxn', JSON.stringify(window.AppState.categorias));
    if (typeof guardarEstadoGlobal === 'function') {
        guardarEstadoGlobal();
    } else {
        localStorage.setItem('financiero_state', JSON.stringify(window.AppState));
    }

    inputCat.value = '';

    // 2. 🔥 SINCRONIZACIÓN CON GOOGLE SHEETS
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "agregarCategoria",
                id: nuevaCat.id,
                nombre: nuevaCat.nombre,
                tipo: nuevaCat.tipo
            })
        });
        const resultado = await response.json();
        if (resultado.success) {
            alert("Categoría agregada en la nube correctamente.");
        } else {
            console.error("❌ Error en la nube al agregar categoría:", resultado.message);
        }
    } catch (error) {
        console.error("❌ Error de red al sincronizar la nueva categoría:", error);
    }

    // 3. Refrescar interfaz
    if (typeof actualizarSelectsCategorias === 'function') {
        actualizarSelectsCategorias();
    }
    if (typeof abrirVistaAjustesInteligente === 'function') {
        abrirVistaAjustesInteligente();
    }
    if (typeof refrescarVistaActual === 'function') {
        refrescarVistaActual();
    }
}

async function eliminarCategoria(id) {
    if (!window.AppState) return;

    const categoriaAEliminar = window.AppState.categorias.find(c => String(c.id) === String(id));
    if (!categoriaAEliminar) return;

    const nombreCat = categoriaAEliminar.nombre;

    // Validación: Evitar borrar si hay movimientos asociados
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

    // 1. Filtrar localmente el estado y actualizar almacenamiento
    window.AppState.categorias = window.AppState.categorias.filter(c => String(c.id) !== String(id));
    localStorage.setItem('cats_mxn', JSON.stringify(window.AppState.categorias));
    localStorage.setItem('financiero_state', JSON.stringify(window.AppState));

    // 2. 🔥 SINCRONIZACIÓN CON GOOGLE SHEETS
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "eliminarCategoria",
                id: id
            })
        });
        const resultado = await response.json();
        if (resultado.success) {
            alert(`Categoría "${nombreCat}" eliminada de la nube correctamente.`);
        } else {
            console.error("❌ Error en la nube al eliminar categoría:", resultado.message);
        }
    } catch (error) {
        console.error("❌ Error de red al intentar eliminar la categoría:", error);
    }

    // 3. 🔄 REFRESCAR LA PANTALLA DE INMEDIATO
    if (typeof abrirVistaAjustesInteligente === 'function') {
        abrirVistaAjustesInteligente();
    }
    if (typeof actualizarSelectsCategorias === 'function') {
        actualizarSelectsCategorias();
    }
    if (typeof refrescarVistaActual === 'function') {
        refrescarVistaActual();
    }
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

    // 1. Fecha
    const fechaObj = new Date(mov.fecha);
    document.getElementById(`${pref}-fecha`).value = fechaObj.toISOString().split('T')[0];

    // 2. Categoría - DECLARAMOS 'selectCat' SOLO UNA VEZ
    // --- NUEVA PRUEBA PARA LA CATEGORÍA ---
    const selectCat = document.getElementById(`${pref}-categoria`);

    // Forzamos un pequeño retraso para asegurar que el DOM esté listo
    setTimeout(() => {
        selectCat.value = mov.cat;

        // Si sigue sin seleccionarse, el valor no existe en la lista
        if (selectCat.value !== mov.cat) {
            console.warn("¡Cuidado! No se pudo asignar el valor. ¿Está en la lista de opciones?");
        }
    }, 200);

    // 3. Descripción y Monto
    document.getElementById(`${pref}-desc`).value = mov.desc;
    const mask = document.getElementById(`${pref}-monto-mask`);
    const hidden = document.getElementById(`${pref}-monto-hidden`);

    if (mask && hidden) {
        hidden.value = mov.monto;
        mask.value = Number(mov.monto).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    }

    // 4. Feedback
    const btn1 = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    if (btn1) {
        btn1.innerText = "ACTUALIZAR REGISTRO";
        btn1.classList.add('ring-4', 'ring-amber-100', 'bg-amber-600');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// CONTROL DE GRÁFICOS GLOBALES
// ==========================================
window.chartH = window.chartH || null;
window.miChartResumenInstance = window.miChartResumenInstance || null;
window.ultimaCarga = { i: -1, g: -1 };

// --- GRÁFICO 1: PANTALLA INICIO (HOME) ---
window.actualizarGraficoDistribucion = function () {
    const canvas = document.getElementById('chartHome');
    if (!canvas) return;

    const ingresos = window.EstadoFinanciero?.ingresos || 0;
    const gastos = window.EstadoFinanciero?.gastos || 0;

    // El cerrojo para evitar parpadeos innecesarios
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

// --- BUCLE DE SEGURIDAD PARA HOME ---
window.addEventListener('load', () => {
    setInterval(() => {
        if (typeof Chart !== 'undefined' && typeof window.actualizarGraficoDistribucion === 'function') {
            window.actualizarGraficoDistribucion();
        }
    }, 500);
});

// --- CONTROL DE SESIÓN ---
function cerrarSesion() {
    localStorage.removeItem('session_user');
    localStorage.removeItem('session_userName');
    localStorage.removeItem('isLoggedIn');
    window.location.href = "./login.html";
}

function obtenerPeriodoActual() {
    // Detecta la sección activa del estado global seguro
    const seccion = window.AppState?.seccionActual || 'home';
    let pref = seccion === 'ingresos' ? 'in' : (seccion === 'gastos' ? 'ex' : 'res');

    const mesEl = document.getElementById(`${pref}-mes`);
    const anioEl = document.getElementById(`${pref}-año`);

    return {
        mes: mesEl ? parseInt(mesEl.value) : new Date().getMonth(),
        año: anioEl ? parseInt(anioEl.value) : new Date().getFullYear()
    };
}

function obtenerMovimientosFiltrados() {
    // 1. Obtener periodo actual (asegúrate de que esto devuelva el mes y año correctos)
    const { mes, año } = obtenerPeriodoActual();

    return movimientos.filter(m => {
        // 2. Convertir la fecha del movimiento a objeto Date de forma segura
        // Si m.fecha es "2026-07-08", esto creará una fecha en UTC
        const fechaEstandar = new Date(m.fecha).toISOString().split('T')[0];
        const mF = new Date(fechaEstandar + 'T00:00:00');

        // 3. Comparar mes y año
        const coincideMes = mF.getMonth() === mes;
        const coincideAño = mF.getFullYear() === año;

        return coincideMes && coincideAño;
    });
}

// ========================================================
// FUNCIÓN DE REPORTE FINANCIERO INTEGRADO (4 PESTAÑAS)
// ========================================================
async function generarLibroContable() {
    console.log("📥 Iniciando construcción de Libro Contable Excel...");

    // 1. Obtener los datos del período seleccionado y el estado de la aplicación
    const { mes, año } = obtenerPeriodoActual();
    const filtrados = obtenerMovimientosFiltrados();

    // 🔥 PROTECCIÓN CLAVE: Obtenemos el historial completo desde el AppState global de forma segura
    const todosLosMovimientos = window.AppState?.movimientos || [];

    if (!filtrados.length) {
        alert("No hay transacciones registradas en este período para generar el reporte.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const ahora = new Date();

    // Formato regional unificado para México
    const fechaReporte = ahora.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).toUpperCase();

    // ==========================================
    // --- PESTAÑA 1: ESTADO DE RESULTADOS ---
    // ==========================================
    const sheetER = workbook.addWorksheet('Estado de Resultados');
    let filaER = 1;

    filaER = Encabezado(sheetER, "ESTADO DE RESULTADOS", filaER);
    filaER = Encabezado(sheetER, "PERIODO DE " + meses[mes].toUpperCase() + " " + año, filaER);
    filaER = Encabezado(sheetER, "GENERADO EL " + fechaReporte, filaER);
    filaER++; // Celda de separación en blanco

    // Sección de Ingresos
    let totalIngresos = 0;
    filaER = TitRepCont(sheetER, "INGRESOS", null, filaER);
    filtrados.filter(m => m.tipo === 'ingreso').forEach(m => {
        filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER);
        totalIngresos += m.monto;
    });
    filaER = TitRepCont(sheetER, "(+) TOTAL INGRESOS", totalIngresos, filaER);
    filaER++;

    // Sección de Gastos
    let totalGastos = 0;
    filaER = TitRepCont(sheetER, "GASTOS", null, filaER);
    filtrados.filter(m => m.tipo === 'gasto').forEach(m => {
        filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER);
        totalGastos += m.monto;
    });
    filaER = TitRepCont(sheetER, "(-) TOTAL GASTOS", totalGastos, filaER);
    filaER++;

    // Utilidad Neta
    const utilidad = totalIngresos - totalGastos;
    filaER = UtiNeta(sheetER, "UTILIDAD NETA DEL PERIODO", totalGastos, utilidad, filaER);

    
    sheetER.views = [{ showGridLines: false }]; // <-- Oculta las líneas de cuadrícula
    // ==========================================
    // --- PESTAÑA 2: BALANCE GENERAL ---
    // ==========================================
    const sheetBG = workbook.addWorksheet('Balance General');
    let filaBG = 1;

    filaBG = Encabezado(sheetBG, "BALANCE GENERAL", filaBG);
    filaBG = Encabezado(sheetBG, "FECHA DE CORTE: " + fechaReporte, filaBG);
    filaBG = Encabezado(sheetBG, "GENERADO EL " + fechaReporte, filaBG);
    filaBG++;

    // Cálculo histórico acumulado usando la variable blindada
    let ingHist = 0, gasHist = 0;
    todosLosMovimientos.forEach(m => {
        if (m.tipo === 'ingreso') ingHist += m.monto;
        else gasHist += m.monto;
    });

    // Activos
    filaBG = TitRepCont(sheetBG, "ACTIVOS", null, filaBG);
    filaBG = DatoRepCont(sheetBG, "Efectivo y Equivalentes", ingHist - gasHist, filaBG);
    filaBG = TitRepCont(sheetBG, "TOTAL ACTIVOS", ingHist - gasHist, filaBG);
    filaBG++;

    // Patrimonio
    filaBG = TitRepCont(sheetBG, "PATRIMONIO", null, filaBG);
    filaBG = DatoRepCont(sheetBG, "Utilidades Acumuladas (Ingresos)", ingHist, filaBG);
    filaBG = DatoRepCont(sheetBG, "Gastos Acumulados", -1 * gasHist, filaBG);
    filaBG = UtiNeta(sheetBG, "TOTAL PATRIMONIO", ingHist - gasHist, ingHist - gasHist, filaBG);
    
    sheetBG.views = [{ showGridLines: false }]; // <-- Oculta las líneas de cuadrícula

    // ==========================================
    // --- PESTAÑA 3: DETALLE DE INGRESOS ---
    // ==========================================
    const wsIng = workbook.addWorksheet('Ingresos');
    let filaIng = 1;

    filaIng = Encabezado(wsIng, "DETALLE DE INGRESOS", filaIng);
    filaIng = Encabezado(wsIng, "PERIODO DE " + meses[mes].toUpperCase() + " " + año, filaIng);
    filaIng = Encabezado(wsIng, "GENERADO EL " + fechaReporte, filaIng);
    filaIng++;

    if (typeof llenarTablaDetalle === 'function') {
        llenarTablaDetalle(wsIng, filtrados.filter(m => m.tipo === 'ingreso'), filaIng); // <-- Corregido con filaIng
    }


    // ==========================================
    // --- PESTAÑA 4: DETALLE DE GASTOS ---
    // ==========================================
    const wsGas = workbook.addWorksheet('Gastos');
    let filaGas = 1;

    filaGas = Encabezado(wsGas, "DETALLE DE GASTOS", filaGas);
    filaGas = Encabezado(wsGas, "PERIODO DE " + meses[mes].toUpperCase() + " " + año, filaGas);
    filaGas = Encabezado(wsGas, "GENERADO EL " + fechaReporte, filaGas);
    filaGas++;

    if (typeof llenarTablaDetalle === 'function') {
        llenarTablaDetalle(wsGas, filtrados.filter(m => m.tipo === 'gasto'), filaGas); // <-- Corregido con filaGas
    }
    

    // ==========================================
    // --- DESCARGA AUTOMÁTICA DEL ARCHIVO ---
    // ==========================================
    if (typeof descargarArchivo === 'function') {
        descargarArchivo(workbook, "RepCont_" + meses[mes] + "_" + año);
    } else {
        console.error("❌ Error: La función 'descargarArchivo' no está definida en los módulos globales.");
    }
}

window.generarLibroContable = generarLibroContable;

async function exportarFiltradoXLSX(tipo) {
    const { mes, año } = obtenerPeriodoActual(); 
    const todosLosMovimientos = obtenerMovimientosFiltrados();

    console.group(`🔍 DIAGNÓSTICO DE FILTRADO (${tipo.toUpperCase()})`);
    console.log(`Mes seleccionado en filtro: ${mes}, Año: ${año}`);

    const filtrados = todosLosMovimientos.filter(m => {
        if (!m.fecha) return false;

        const fechaObj = new Date(m.fecha);
        
        if (isNaN(fechaObj.getTime())) {
            console.warn(`Fecha inválida detectada:`, m.fecha);
            return false;
        }

        const mesM = fechaObj.getMonth();       // 0 a 11
        const añoM = fechaObj.getFullYear();   // ej. 2026

        const esDelTipo = m.tipo.toLowerCase() === tipo.toLowerCase();
        const esDelMesSeleccionado = (añoM === año && mesM === mes);
        const pasaFiltro = esDelTipo && esDelMesSeleccionado;

        return pasaFiltro;
    });

    console.log(`Total registros que pasaron el filtro: ${filtrados.length}`);
    console.groupEnd();

    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    if (!filtrados.length) {
        return alert(`Sin movimientos de ${tipo} para ${meses[mes]} de ${año}.`);
    }

    const ahora = new Date();
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Detalle');
    let filaFil = 1;

    filaFil = Encabezado(ws, "DETALLE DE " + tipo.toUpperCase(), filaFil);
    filaFil = Encabezado(ws, "PERIODO: " + meses[mes].toUpperCase() + " " + año, filaFil);
    filaFil = Encabezado(ws, "GENERADO EL " + ahora.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), filaFil);
    filaFil++; // Espacio adicional antes de la tabla
    
    // Llamada con el tercer parámetro 'filaFil' para que pinte bien los datos
    if (typeof llenarTablaDetalle === 'function') {
        llenarTablaDetalle(ws, filtrados, filaFil);
    } else {
        console.error("❌ Error: La función 'llenarTablaDetalle' no está definida.");
    }

    // ==========================================
    // --- DESCARGA AUTOMÁTICA DEL ARCHIVO ---
    // ==========================================
    if (typeof descargarArchivo === 'function') {
        descargarArchivo(workbook, "Detalle_" + tipo + "_" + meses[mes] + "_" + año);
    } else {
        console.error("❌ Error: La función 'descargarArchivo' no está definida en los módulos globales.");
    }
}

// Exponer globalmente para que el HTML la reconozca en el onclick
function llenarTablaDetalle(ws, datos, filaLle) {
    ws.views = [{ showGridLines: false }];
    // Configuramos el encabezado de la tabla en la fila indicada
    const head = ws.getRow(filaLle);
    head.values = ['FECHA', 'CATEGORÍA', 'DESCRIPCIÓN', 'MONTO'];

    head.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
        c.alignment = { horizontal: 'center' };
    });

    head.commit();
    filaLle++; // Pasamos a la siguiente fila para los registros

    // Llenamos los datos de los movimientos filtrados
    datos.forEach((d, i) => {
        const r = ws.getRow(filaLle);

        // Convertir la fecha al formato formal DD/MM/YYYY para que luzca ordenada en el Excel
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

            // Alinear la fecha al centro y dar formato de moneda a la columna de monto (Columna 4)
            if (colNumber === 1) {
                cell.alignment = { horizontal: 'center' };
            }
            if (colNumber === 4) {
                cell.numFmt = '"$"#,##0.00';
                cell.alignment = { horizontal: 'right' };
            }
        });

        r.commit();
        filaLle++;
    });

    // Ajustar el ancho automático de las columnas
    ws.columns.forEach(c => c.width = 22);
}

window.llenarTablaDetalle = llenarTablaDetalle;
// ========================================================
// --- FUNCIONES AUXILIARES PARA GENERACIÓN DE EXCEL ---
// ========================================================

function Encabezado(ws, texto, fila) {
    ws.mergeCells(`A${fila}:D${fila}`);
    const cell = ws.getCell(`A${fila}`);
    cell.value = texto.toUpperCase();
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF45423E' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Configuración estética base de la pestaña
    ws.views = [{ showGridLines: true }];
    ws.getRow(fila).height = 25;

    // Definimos anchos fijos proporcionales una sola vez por pestaña
    ws.getColumn('A').width = 35; // Categoría / Concepto
    ws.getColumn('B').width = 22; // Montos financieros
    ws.getColumn('C').width = 15; // Columnas auxiliares si aplican
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
    // Si no viene monto (es solo título de sección), dejamos la celda vacía de forma limpia
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

    // Paleta arena y crema desaturada para filas cebra
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
    cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF45423E' } }; // Fondo oscuro distinguible
    cellA.alignment = { vertical: 'middle', horizontal: 'left' };

    const cellB = ws.getCell(`B${fila}`);
    // 🔥 CORRECCIÓN CLAVE: Asigna el valor real de la utilidad calculada en lugar del acumulado de gastos
    cellB.value = utilidad;
    cellB.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: utilidad >= 0 ? 'FFFFFFFF' : 'FFFF8A8A' } // Blanco si es positivo, Rojo suave si es negativo
    };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF45423E' } };
    cellB.alignment = { vertical: 'middle', horizontal: 'right' };
    cellB.numFmt = '"$"#,##0.00';

    return fila + 1;
}
async function descargarArchivo(workbook, nombre) { const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${nombre}.xlsx`; link.click(); }