// --- RENDERIZADOS LOCALES ---
function actualizarListadoIndividual(tipo, contId, countId) {
    // 🛡️ Extractor seguro: asegura que siempre obtengamos un arreglo plano sin importar cómo venga el estado
    let rawMovs = AppState.movimientos || [];
    if (!Array.isArray(rawMovs) && typeof rawMovs === 'object') {
        rawMovs = rawMovs.movimientos || Object.values(rawMovs);
    }
    const todosLosMovimientos = Array.isArray(rawMovs) ? rawMovs : [];

    const tipoNormalizado = tipo.toLowerCase().trim();

    const pref = tipoNormalizado === 'ingreso' ? 'in' : 'ex';
    const inputInicio = document.getElementById(`${pref}-fecha-inicio`);
    const inputFin = document.getElementById(`${pref}-fecha-fin`);

    // Valores por defecto (mes actual)
    const hoy = new Date();
    const añoActual = hoy.getFullYear();
    const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
    const diaActual = String(hoy.getDate()).padStart(2, '0');

    const defectoInicio = `${añoActual}-${mesActual}-01`;
    const defectoFin = `${añoActual}-${mesActual}-${diaActual}`;

    if (inputInicio && !inputInicio.value) inputInicio.value = defectoInicio;
    if (inputFin && !inputFin.value) inputFin.value = defectoFin;

    const fechaInicioStr = inputInicio ? inputInicio.value : defectoInicio;
    const fechaFinStr = inputFin ? inputFin.value : defectoFin;

    // Convertimos los límites del filtro a milisegundos para comparar matemáticamente (más seguro que strings)
    const inicioTime = new Date(fechaInicioStr + 'T00:00:00').getTime();
    const finTime = new Date(fechaFinStr + 'T23:59:59').getTime();

    // Filtramos validando tipo y rango de tiempo exacto
    const filtrados = todosLosMovimientos.filter(m => {
        if (!m.fecha) return false;

        const tipoMov = (m.tipo || '').toLowerCase().trim();
        if (tipoMov !== tipoNormalizado) return false;

        // Convertimos la fecha del movimiento a timestamp
        const movTime = new Date(m.fecha).getTime();
        if (isNaN(movTime)) return false;

        return movTime >= inicioTime && movTime <= finTime;
    }).reverse();

    // Actualizamos el contador
    const realCountId = tipoNormalizado === 'ingreso' ? 'count-in' : 'count-ex';
    const countEl = document.getElementById(realCountId) || document.getElementById(countId);
    if (countEl) countEl.innerText = `${filtrados.length} MOVIMIENTOS`;

    // Renderizamos en el contenedor correcto
    const realContId = tipoNormalizado === 'ingreso' ? 'lista-ingresos' : 'lista-gastos';
    const cont = document.getElementById(realContId) || document.getElementById(countId);

    if (!cont) return;

    if (filtrados.length === 0) {
        cont.innerHTML = '<p class="opacity-20 text-center py-10">Sin registros.</p>';
        return;
    }

    let htmlAcumulado = '';
    filtrados.forEach(m => {
        const fechaLegible = (typeof window.formatearFechaMX === 'function')
            ? window.formatearFechaMX(m.fecha)
            : String(m.fecha).split('T')[0];

        htmlAcumulado += `
            <div class="p-4 bg-gray-50/50 rounded-xl border border-white flex justify-between items-center group transition-all hover:bg-white hover:shadow-sm mb-2">
                <div class="flex-1">
                    <p class="text-sm font-semibold uppercase text-stone-700">${m.desc || 'Sin descripción'}</p>
                    <p class="text-[9px] opacity-40 uppercase font-bold">${fechaLegible} | ${m.cat || 'General'}</p>
                </div>
                <div class="flex items-center gap-4">
                    <p class="text-sm font-bold ${tipoNormalizado === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                        ${tipoNormalizado === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                    </p>
                    <div class="flex gap-1">
                        <button onclick="prepararEdicion(${m.id}, '${tipo}')" class="p-2 hover:bg-stone-200 rounded-full transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7E6A" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="eliminarMovimiento(${m.id})" class="p-2 hover:bg-rose-100 rounded-full transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    });

    cont.innerHTML = htmlAcumulado;
}

function actualizarSelectsCategorias() {
    const inSel = document.getElementById('in-categoria');
    const exSel = document.getElementById('ex-categoria');
    const listaCategorias = window.AppState?.categorias || [];

    if (inSel) {
        // 1. Ponemos la opción por defecto obligatoria para ingresos
        inSel.innerHTML = `<option value="SELECCIONAR CATEGORIA" disabled selected>SELECCIONAR CATEGORÍA</option>`;

        listaCategorias.filter(c => c.tipo === 'ingreso').forEach(c => {
            inSel.innerHTML += `<option value="${c.nombre}">${c.nombre.toUpperCase()}</option>`;
        });
    }

    if (exSel) {
        // 2. Ponemos la opción por defecto obligatoria para gastos
        exSel.innerHTML = `<option value="SELECCIONAR CATEGORIA" disabled selected>SELECCIONAR CATEGORÍA</option>`;

        listaCategorias.filter(c => c.tipo === 'gasto').forEach(c => {
            exSel.innerHTML += `<option value="${c.nombre}">${c.nombre.toUpperCase()}</option>`;
        });
    }
}

function renderCategoriasConfig() {
    const contIng = document.getElementById('lista-cats-ingreso');
    const contGas = document.getElementById('lista-cats-gasto');
    if (!contIng || !contGas) return;

    contIng.innerHTML = '';
    contGas.innerHTML = '';

    const listaCategorias = window.AppState?.categorias || [];

    listaCategorias.forEach(c => {
        const itemHtml = `
            <div class="group bg-stone-50 rounded-xl border border-stone-100 p-3 transition hover:shadow-sm">
                <div id="view-${c.id}" class="flex justify-between items-center">
                    <span class="text-xs font-bold uppercase text-stone-700">${c.nombre}</span>
                    <div class="flex gap-3 opacity-0 group-hover:opacity-100 transition">
                        <button onclick="editMode(${c.id}, true)" class="text-[10px] font-bold text-stone-400 hover:text-stone-800 tracking-wider">EDITAR</button>
                        <button onclick="eliminarCategoria(${c.id})" class="text-[10px] font-bold text-rose-300 hover:text-rose-600">X</button>
                    </div>
                </div>
                <div id="edit-${c.id}" class="hidden flex gap-2">
                    <input type="text" id="input-${c.id}" value="${c.nombre}" class="flex-1 text-xs p-2 rounded-lg border border-stone-200 outline-none uppercase font-semibold text-stone-700">
                    <button onclick="saveEdit(${c.id})" class="bg-stone-800 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">OK</button>
                </div>
            </div>`;

        if (c.tipo === 'ingreso') contIng.innerHTML += itemHtml;
        else contGas.innerHTML += itemHtml;
    });
}

// Asegúrate de que esta variable sea global en tu archivo
function editMode(id, active) {
    // Si quieres que active el spinner al alternar la vista, descomenta la siguiente línea:
    // mostrarSpinnerGlobal();

    const viewEl = document.getElementById(`view-${id}`);
    const editEl = document.getElementById(`edit-${id}`);
    
    if (viewEl && editEl) {
        viewEl.classList.toggle('hidden', active);
        editEl.classList.toggle('hidden', !active);
        if (active) {
            const input = document.getElementById(`input-${id}`);
            if (input) input.focus();
        }
    }

    // ocultarSpinnerGlobal();
}

async function saveEdit(id) {
    try {
        const inputEl = document.getElementById(`input-${id}`);
        if (!inputEl) return;

        const nuevoNombre = inputEl.value.trim().toUpperCase();
        if (!nuevoNombre || !window.AppState) return;

        // 1. COMPARACIÓN SEGURA: Convertimos ambos a String para evitar fallos de Tipo
        const index = window.AppState.categorias.findIndex(c => String(c.id) === String(id));

        if (index !== -1) {
            const nombreAnterior = window.AppState.categorias[index].nombre;

            if (nombreAnterior === nuevoNombre) {
                if (typeof abrirVistaAjustesInteligente === 'function') abrirVistaAjustesInteligente();
                return;
            }

            // 🛑 2. NUEVA VALIDACIÓN: Comprobar si existen movimientos con esta categoría
            const tieneMovimientosAsociados = window.AppState.movimientos && window.AppState.movimientos.some(m => {
                if (!m) return false;
                const catMov = (m.cat || m.categoria || "").trim().toUpperCase();
                return catMov === nombreAnterior.trim().toUpperCase();
            });

            if (tieneMovimientosAsociados) {
                alert(`No se puede modificar la categoría "${nombreAnterior}" porque ya cuenta con registros de movimientos asociados.`);
                if (typeof abrirVistaAjustesInteligente === 'function') abrirVistaAjustesInteligente();
                return;
            }

            // 🌀 1. MOSTRAR SPINNER GLOBAL ANTES DE GUARDAR Y SINCRONIZAR
            mostrarSpinnerGlobal();

            try {
                // 3. Actualizar el nombre en el catálogo de categorías local
                window.AppState.categorias[index].nombre = nuevoNombre;
                localStorage.setItem('cats_mxn', JSON.stringify(window.AppState.categorias));
                localStorage.setItem('financiero_state', JSON.stringify(window.AppState));

                // 4. 🔥 SINCRONIZACIÓN CON GOOGLE SHEETS
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos máx

                const response = await fetch(API_URL, {
                    method: 'POST',
                    signal: controller.signal,
                    body: JSON.stringify({
                        action: "actualizarCategoria",
                        id: id,
                        nombre: nuevoNombre
                    })
                });
                clearTimeout(timeoutId);

                const resultado = await response.json();
                if (resultado.success) {
                    console.log("✅ Categoría actualizada en la nube correctamente.");
                } else {
                    console.error("❌ En la nube:", resultado.message);
                }

                // ⏱️ Pausa visual fluida para que se aprecie el spinner
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.warn("⚠️ Aviso de red al actualizar categoría (se aplicó localmente):", error);
            } finally {
                // 🌀 2. OCULTAR SPINNER GLOBAL SIEMPRE (Pase lo que pase)
                ocultarSpinnerGlobal();
            }

            // 5. Restablecer la variable global de edición
            if (typeof editandoId !== 'undefined') {
                editandoId = null;
            }

            // 6. Forzar el redibujado inmediato y seguro de la UI y los ajustes
            if (typeof abrirVistaAjustesInteligente === 'function') abrirVistaAjustesInteligente();
            if (typeof actualizarHome === 'function') actualizarHome();
            if (typeof actualizarResumen === 'function') actualizarResumen();

            console.log(`Categoría "${nombreAnterior}" actualizada con éxito a "${nuevoNombre}".`);

            if (typeof refrescarVistaActual === 'function') {
                refrescarVistaActual();
            }
        }
    } catch (error) {
        console.error("Error crítico en saveEdit de categorías:", error);
        ocultarSpinnerGlobal(); // Garantía de seguridad por si ocurre un fallo inesperado
    }
}

async function actualizarCategoriaEnNube(id, nuevoNombre) {
    // Reemplaza esta URL con la URL de implementación web de tu Google Apps Script
    const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbx87PyaYtEDgPqomoCuBCd59yUIXW04Sl5JioZ1hxpJAXfOwiWTbuIajMXGfEEMKbRDUg/exec";

    try {
        const respuesta = await fetch(URL_APPS_SCRIPT, {
            method: 'POST',
            body: JSON.stringify({
                action: "actualizarCategoria",
                id: id,
                nombre: nuevoNombre
            })
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            console.log("✅ Categoría sincronizada con Google Sheets correctamente.");
        } else {
            console.error("❌ Error en la nube al actualizar categoría:", resultado.message);
        }
    } catch (error) {
        console.error("❌ Error de red al intentar actualizar en Google Sheets:", error);
    }
}
// Variables globales seguras para los gráficos
window.chartH = window.chartH || null;
window.chartR = window.chartR || null;

// ========================================================
// --- AUXILIAR: NORMALIZADOR UNIVERSAL DE MOVIMIENTOS ---
// ========================================================
function normalizarMovimiento(m) {
    if (!m) return null;

    // Guardamos una copia exacta del dato de fecha original para tus formateadores de la app
    const fechaOriginal = m.fecha;

    // Crear un objeto Date nativo seguro para cálculos numéricos e internos
    let dateObj = null;
    if (m.fecha) {
        dateObj = new Date(m.fecha);

        // Si el formato viene como texto es-MX "DD/MM/YYYY", new Date() podría fallar.
        // Agregamos un salvavidas para reconstruirla limpiamente si contiene diagonales:
        if (isNaN(dateObj.getTime()) && typeof m.fecha === 'string') {
            const partesFecha = m.fecha.split('/');
            if (partesFecha.length === 3) {
                const dia = partesFecha[0].padStart(2, '0');
                const mes = partesFecha[1].padStart(2, '0');
                const anio = partesFecha[2];
                dateObj = new Date(`${anio}-${mes}-${dia}T00:00:00`);
            }
        }
    }

    // Si la fecha sigue siendo inválida o no existía, usamos la fecha de hoy por defecto
    if (!dateObj || isNaN(dateObj.getTime())) {
        dateObj = new Date();
    }

    return {
        id: m.id || "",
        monto: parseFloat(m.monto) || 0,
        tipo: m.tipo === 'ingreso' ? 'ingreso' : 'gasto',
        desc: (m.desc || m.concepto || "Sin concepto").trim(),
        cat: (m.cat || m.categoria || "Varios").trim(),
        fechaOriginal: fechaOriginal, // Mandamos la original sin alterar a la UI
        dateObj: dateObj              // Mandamos el objeto nativo para los cálculos
    };
}

// ========================================================
// --- ACTUALIZACIÓN EN TIEMPO REAL DE DASHBOARDS (UI) ---
// ========================================================

function actualizarHome() {
    try {
        let rawDatos = window.AppState?.movimientos || [];
        if (rawDatos && !Array.isArray(rawDatos) && typeof rawDatos === 'object') {
            rawDatos = rawDatos.movimientos || Object.values(rawDatos);
        }
        if (!Array.isArray(rawDatos)) rawDatos = [];

        const datos = rawDatos.map(normalizarMovimiento).filter(Boolean);

        const ahora = new Date();
        const hoyStr = ahora.toISOString().split('T')[0]; // "YYYY-MM-DD" del día de hoy
        let balG = 0, balD = 0, ingM = 0, gasM = 0;

        // OBTENEMOS EL PERIODO SELECCIONADO EN LOS FILTROS
        const filtros = window.AppState?.filtrosActuales || {};
        const mesFiltro = filtros.mes !== undefined ? filtros.mes : ahora.getMonth();
        const añoFiltro = filtros.año !== undefined ? filtros.año : ahora.getFullYear();

        datos.forEach(m => {
            const val = m.tipo === 'ingreso' ? m.monto : -m.monto;
            balG += val;

            // Verificación del día de hoy usando el objeto nativo de manera segura
            let mFechaStr = "";
            try {
                mFechaStr = m.dateObj.toISOString().split('T')[0];
            } catch (e) {
                mFechaStr = "";
            }

            if (mFechaStr === hoyStr) {
                balD += val;
            }

            // VERIFICACIÓN DINÁMICA USANDO EL MES Y AÑO SELECCIONADOS
            if (m.dateObj.getMonth() === mesFiltro && m.dateObj.getFullYear() === añoFiltro) {
                if (m.tipo === 'ingreso') ingM += m.monto;
                else gasM += m.monto;
            }
        });

        const fLocal = (v) => typeof fMXN === 'function' ? fMXN(v) : `$${v.toFixed(2)}`;

        if (document.getElementById('balance-general')) document.getElementById('balance-general').innerText = fLocal(balG);
        if (document.getElementById('balance-dia')) document.getElementById('balance-dia').innerText = fLocal(balD);
        if (document.getElementById('home-ingresos')) document.getElementById('home-ingresos').innerText = fLocal(ingM);
        if (document.getElementById('home-gastos')) document.getElementById('home-gastos').innerText = fLocal(gasM);

        window.EstadoFinanciero = { ingresos: ingM, gastos: gasM };

        // ==========================================
        // 3. Render del gráfico Donut (ACTUALIZACIÓN INTELIGENTE)
        // ==========================================
        const canvasH = document.getElementById('chartHome');
        if (canvasH) {
            const chartExistente = Chart.getChart(canvasH);
            const hayDatos = (ingM > 0 || gasM > 0);
            const dataDonut = hayDatos ? [ingM, gasM] : [1, 1];
            const colorsDonut = hayDatos ? ['#D6C7B3', '#45423E'] : ['#E5E7EB', '#E5E7EB'];

            if (chartExistente) {
                // Si el gráfico ya existe, solo actualizamos los datos y colores
                chartExistente.data.datasets[0].data = dataDonut;
                chartExistente.data.datasets[0].backgroundColor = colorsDonut;
                chartExistente.update(); // Esto cambia los datos sin parpadear
            } else {
                // Si es la primera vez que carga, creamos el gráfico
                const ctx = canvasH.getContext('2d');
                window.chartH = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Ingresos', 'Gastos'],
                        datasets: [{
                            data: dataDonut,
                            backgroundColor: colorsDonut,
                            borderWidth: 0
                        }]
                    },
                    options: {
                        cutout: '75%',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: hayDatos,
                                callbacks: {
                                    label: function (context) {
                                        let label = context.label || '';
                                        if (label) label += ': ';
                                        const valor = context.parsed;
                                        label += typeof fMXN === 'function' ? fMXN(valor) : `$${valor.toFixed(2)}`;
                                        return label;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }

        // Lista de transacciones recientes reparada
        const listaH = document.getElementById('lista-recientes');
        if (listaH) {
            listaH.innerHTML = '';
            if (datos.length === 0) {
                listaH.innerHTML = '<p class="opacity-30 text-center py-6 text-xs uppercase font-medium">Sin movimientos</p>';
            } else {
                [...datos].reverse().slice(0, 10).forEach(m => {
                    // Usamos la fecha original exacta para que window.formatearFechaMX no devuelva error
                    const fechaFormateada = typeof window.formatearFechaMX === 'function' ? window.formatearFechaMX(m.fechaOriginal) : m.dateObj.toLocaleDateString('es-MX');

                    listaH.innerHTML += `
                        <div class="flex justify-between items-center p-3 bg-stone-50/60 rounded-xl border border-white transition hover:bg-stone-50">
                            <div>
                                <p class="text-xs font-semibold uppercase text-stone-800">${m.desc}</p>
                                <p class="text-[9px] text-stone-400 font-medium uppercase mt-0.5">${fechaFormateada} | ${m.cat}</p>
                            </div>
                            <span class="text-xs font-bold ${m.tipo === 'gasto' ? 'text-rose-500' : 'text-stone-700'}">
                                ${m.tipo === 'gasto' ? '-' : '+'}${fLocal(m.monto)}
                            </span>
                        </div>`;
                });
            }
        }
    } catch (error) {
        console.error("Error crítico en actualizarHome:", error);
    }
}

function actualizarResumen() {
    try {
        // 🎯 APUNTAMOS DIRECTAMENTE A LA FUENTE REAL DE LOS DATOS
        let rawFiltrados = window.AppState?.movimientos || [];

        const { inicio, fin } = window.AppState?.filtrosActuales || {};
        let filtrados = rawFiltrados.map(normalizarMovimiento).filter(Boolean);

        if (inicio && fin) {
            const numInicio = parseInt(inicio.replace(/-/g, ''), 10);
            const numFin = parseInt(fin.replace(/-/g, ''), 10);

            filtrados = filtrados.filter(m => {
                if (!m.dateObj || isNaN(m.dateObj.getTime())) return false;

                const anio = m.dateObj.getFullYear();
                const mes = String(m.dateObj.getMonth() + 1).padStart(2, '0');
                const dia = String(m.dateObj.getDate()).padStart(2, '0');
                const numMovimiento = parseInt(`${anio}${mes}${dia}`, 10);

                return numMovimiento >= numInicio && numMovimiento <= numFin;
            });
        }

        let ing = 0, gas = 0;

        filtrados.forEach(m => {
            if (m.tipo === 'ingreso') ing += m.monto;
            else gas += m.monto;
        });

        const fLocal = (v) => typeof fMXN === 'function' ? fMXN(v) : `$${v.toFixed(2)}`;

        if (document.getElementById('resumen-balance-total')) {
            document.getElementById('resumen-balance-total').innerText = fLocal(ing - gas);
        }

        const contLista = document.getElementById('lista-resumen-periodo');
        if (contLista) {
            contLista.innerHTML = filtrados.length ? '' : '<p class="opacity-30 text-center py-12 text-xs font-medium uppercase tracking-wider">Sin movimientos registrados en este período.</p>';

            // Ordenamos de forma cronológica por el objeto de tiempo nativo
            [...filtrados].sort((a, b) => b.dateObj - a.dateObj).forEach(m => {
                const fechaFormateada = typeof window.formatearFechaMX === 'function' ? window.formatearFechaMX(m.fechaOriginal) : m.dateObj.toLocaleDateString('es-MX');

                const div = document.createElement('div');
                div.className = "flex justify-between items-center p-3 bg-stone-50/60 rounded-xl border border-white transition hover:bg-stone-50";
                div.innerHTML = `
                    <div>
                        <p class="text-[11px] font-semibold text-stone-800">${m.desc.toUpperCase()}</p>
                        <p class="text-[9px] text-stone-400 font-medium uppercase mt-0.5">${m.cat} | ${fechaFormateada}</p>
                    </div>
                    <span class="text-[11px] font-bold ${m.tipo === 'gasto' ? 'text-rose-500' : 'text-stone-700'}">
                        ${m.tipo === 'gasto' ? '-' : '+'}${fLocal(m.monto)}
                    </span>`;
                contLista.appendChild(div);
            });
        }

        const canvasR = document.getElementById('chartResumen');
        if (canvasR) {
            const ctx = canvasR.getContext('2d');
            if (window.chartR) {
                window.chartR.destroy();
                window.chartR = null;
            }
            window.chartR = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Ingresos', 'Gastos'],
                    datasets: [{ data: [ing, gas], backgroundColor: ['#D6C7B3', '#45423E'], borderRadius: 6 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    } catch (error) {
        console.error("Error crítico en actualizarResumen:", error);
    }
}

function actualizarFechaHeader() {
    try {
        const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const fecha = new Date().toLocaleDateString('es-MX', opciones);
        const headerEl = document.getElementById('fecha-sistema');
        if (headerEl) {
            headerEl.innerText = fecha.charAt(0).toUpperCase() + fecha.slice(1);
        }
    } catch (e) {
        console.error(e);
    }
}

window.toggleLoading = function(show) {
    var loader = document.getElementById('loading-overlay');
    
    // Si por alguna razón el div no está en el HTML, lo creamos automáticamente al vuelo
    if (!loader && show) {
        loader = document.createElement('div');
        loader.id = 'loading-overlay';
        loader.style.cssText = "position: fixed; inset: 0; z-index: 99999; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(28, 25, 23, 0.7); backdrop-filter: blur(4px);";
        loader.innerHTML = `
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-100 mb-4" style="border-top: 2px solid transparent; border-left: 2px solid transparent; animation: spin 1s linear infinite;"></div>
            <p style="color: #f5f5f4; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em;">Procesando...</p>
        `;
        document.body.appendChild(loader);
    }

    if (loader) {
        if (show) {
            loader.style.display = 'flex';
        } else {
            loader.style.display = 'none';
        }
    }
};

function inicializarFiltros() {
    const hoy = new Date();
    const añoActual = hoy.getFullYear();
    const mesActualSistema = hoy.getMonth(); 
    const mesStr = String(mesActualSistema + 1).padStart(2, '0');
    const diaActual = String(hoy.getDate()).padStart(2, '0');

    const primerDiaMes = `${añoActual}-${mesStr}-01`;
    const fechaHoySistema = `${añoActual}-${mesStr}-${diaActual}`;

    // 1. Manejo de inputs de fecha usando sessionStorage para aislar por pestaña/sesión
    const prefijos = ['in', 'ex', 'res', 'an'];
    prefijos.forEach(pref => {
        const inputInicio = document.getElementById(`${pref}-fecha-inicio`);
        const inputFin = document.getElementById(`${pref}-fecha-fin`);

        if (inputInicio && inputFin) {
            // Cargar desde sessionStorage de la sesión actual, o usar el valor por defecto del sistema
            const sesionInicio = sessionStorage.getItem(`${pref}_filtro_inicio`) || primerDiaMes;
            const sesionFin = sessionStorage.getItem(`${pref}_filtro_fin`) || fechaHoySistema;

            inputInicio.value = sesionInicio;
            inputFin.value = sesionFin;
        }
    });

    // Inputs individuales de captura
    const inputFechaIngreso = document.getElementById('in-fecha');
    if (inputFechaIngreso && !inputFechaIngreso.value) {
        inputFechaIngreso.value = fechaHoySistema;
    }

    const inputFechaGasto = document.getElementById('ex-fecha');
    if (inputFechaGasto && !inputFechaGasto.value) {
        inputFechaGasto.value = fechaHoySistema;
    }

    if (!AppState.filtrosActuales) AppState.filtrosActuales = {};
    AppState.filtrosActuales.inicio = sessionStorage.getItem('an_filtro_inicio') || primerDiaMes;
    AppState.filtrosActuales.fin = sessionStorage.getItem('an_filtro_fin') || fechaHoySistema;
    AppState.filtrosActuales.mes = mesActualSistema;
    AppState.filtrosActuales.año = añoActual;

    // 2. Sincronización de selectores de Mes y Año
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const idsAnio = ['in-año', 'ex-año', 'res-año'];
    const idsMes = ['in-mes', 'ex-mes', 'res-mes'];

    [idsMes, idsAnio].forEach((list, idx) => {
        list.forEach(id => {
            const sel = document.getElementById(id);
            if (sel) {
                sel.innerHTML = '';
                if (idx === 0) {
                    meses.forEach((m, i) => {
                        let opt = document.createElement('option');
                        opt.value = i;
                        opt.innerHTML = m;
                        sel.appendChild(opt);
                    });
                    sel.value = mesActualSistema; 
                } else {
                    for (let i = añoActual; i >= añoActual - 4; i--) {
                        let opt = document.createElement('option');
                        opt.value = i;
                        opt.innerHTML = i;
                        sel.appendChild(opt);
                    }
                    sel.value = añoActual; 
                }

                if (!sel.dataset.escuchadorActivo) {
                    sel.dataset.escuchadorActivo = "true";
                    sel.addEventListener('change', () => {
                        if (!AppState.filtrosActuales) AppState.filtrosActuales = {};

                        if (sel.id.includes('mes')) {
                            AppState.filtrosActuales.mes = parseInt(sel.value, 10);
                        } else if (sel.id.includes('año')) {
                            AppState.filtrosActuales.año = parseInt(sel.value, 10);
                        }

                        if (typeof refrescarVistaActual === 'function') {
                            refrescarVistaActual();
                        }
                    });
                }
            }
        });
    });

    // 3. Escuchador para guardar en sessionStorage (aislado por sesión activa)
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (input.dataset.escuchadorActivo) return;
        input.dataset.escuchadorActivo = "true";

        input.addEventListener('change', () => {
            if (!AppState.filtrosActuales) AppState.filtrosActuales = {};

            if (input.id.includes('inicio')) {
                AppState.filtrosActuales.inicio = input.value;
                sessionStorage.setItem('an_filtro_inicio', input.value);
            } else if (input.id.includes('fin')) {
                AppState.filtrosActuales.fin = input.value;
                sessionStorage.setItem('an_filtro_fin', input.value);
            }

            if (typeof refrescarVistaActual === 'function') {
                refrescarVistaActual();
            } else if (typeof actualizarResumen === 'function') {
                actualizarResumen();
            }
        });
    });
}

function guardarFiltrosIngresos() {
    const inicio = document.getElementById('in-fecha-inicio')?.value;
    const fin = document.getElementById('in-fecha-fin')?.value;

    if (inicio) sessionStorage.setItem('filtro_ingresos_inicio', inicio);
    if (fin) sessionStorage.setItem('filtro_ingresos_fin', fin);
}

function restaurarFiltrosIngresos() {
    const inicioGuardado = sessionStorage.getItem('filtro_ingresos_inicio');
    const finGuardado = sessionStorage.getItem('filtro_ingresos_fin');

    const inputInicio = document.getElementById('in-fecha-inicio');
    const inputFin = document.getElementById('in-fecha-fin');

    if (inputInicio && inicioGuardado) {
        inputInicio.value = inicioGuardado;
    }
    if (inputFin && finGuardado) {
        inputFin.value = finGuardado;
    }
}

function formatCurrency(input, hiddenId) {
    // 1. Guardar la posición actual del cursor antes de modificar el valor
    let cursorPosition = input.selectionStart;
    let oldLength = input.value.length;

    // 2. Extraer solo los números
    let value = input.value.replace(/\D/g, "");
    let numericValue = value ? parseFloat(value) / 100 : 0;
    
    // 3. Actualizar el input oculto
    const hiddenInput = document.getElementById(hiddenId);
    if (hiddenInput) {
        hiddenInput.value = numericValue;
    }

    // 4. Aplicar el formato de moneda al input visible
    let formattedValue = numericValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + " MXN";
    input.value = formattedValue;

    // 5. Restaurar la posición del cursor de forma inteligente
    let newLength = input.value.length;
    cursorPosition = cursorPosition + (newLength - oldLength);
    
    // Asegurar que el cursor no se salga de los límites
    if (cursorPosition < 0) cursorPosition = 0;
    if (cursorPosition > input.value.length) cursorPosition = input.value.length;
    
    input.setSelectionRange(cursorPosition, cursorPosition);
}

// Función de seguridad para actualizar elementos
// Agrega esto a tu ui.js junto a safeSetText
function safeSetHTML(id, htmlContent) {
    const el = document.getElementById(id);
    if (el) {
        el.innerHTML = htmlContent;
    }
}

// --- CONTROLADOR INTELIGENTE DE VISTAS ---
async function abrirVistaAjustesInteligente() {
    toggleLoading(true); // Siempre muestra carga antes de la lógica
    try {
        if (!AppState.categorias || AppState.categorias.length === 0) {
            const formData = new FormData();
            formData.append('action', 'obtenerCategorias');
            const req = await fetch(API_URL, { method: 'POST', body: formData });
            const res = await req.json();
            if (res.exito) AppState.categorias = res.datos;
        }
    } catch (error) {
        console.error("Error al cargar categorías:", error);
    } finally {
        toggleLoading(false);
        renderCategoriasConfig(); // SE EJECUTA SIEMPRE, haya datos o error
    }
}