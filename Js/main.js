// Variables globales para destruir gráficas viejas si se calcula varias veces
let chartDona = null;
let chartCurva = null;

// Lógica de conversión automática de meses a años
document.getElementById('meses').addEventListener('input', function() {
    let meses = parseInt(this.value) || 0;
    if (meses >= 12) {
        let aniosInput = document.getElementById('anios');
        let aniosExtra = Math.floor(meses / 12);
        aniosInput.value = parseInt(aniosInput.value || 0) + aniosExtra;
        this.value = meses % 12;
    }
});

// Lógica Principal de Diagnóstico conectada a la IA (Python / Flask)
document.getElementById('formulario-diagnostico').addEventListener('submit', async function(e) {
    e.preventDefault(); 
    
    // 1. Obtener valores básicos del formulario
    const odometro = parseFloat(document.getElementById('odometro').value) || 0;
    const anios = parseInt(document.getElementById('anios').value) || 0;
    const meses = parseInt(document.getElementById('meses').value) || 0;
    
    // 2. Capturar los campos del Cliente y Mecánico
    const terreno = document.getElementById('terreno') ? document.getElementById('terreno').value : 'Plano';
    const metodoCarga = document.getElementById('metodo-carga') ? document.getElementById('metodo-carga').value : 'Lenta';
    const marca = document.getElementById('marca').value;
    const quimica = document.getElementById('quimica').value;
    const regimen = document.getElementById('regimen').value;
    
    const inputCiclos = document.getElementById('ciclos');
    const ciclos = (inputCiclos && inputCiclos.value !== "") ? parseFloat(inputCiclos.value) : (odometro / 250);
    
    const inputRefri = document.getElementById('refrigeracion');
    const refrigeracion = inputRefri ? inputRefri.value : 'Optimo';
    
    const inputAlertas = document.getElementById('alertas');
    const alertas = inputAlertas ? inputAlertas.value : 'Ninguna';

    // Cambiar visualmente el botón a estado de carga
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Sincronizando motor de IA...';

    try {
        // --- PAUSA ARTIFICIAL DE 3 SEGUNDOS PARA LA PRESENTACIÓN ---
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. ENVIAR DATOS A PYTHON POR DEBAJO DEL AGUA (API Flask)
        const respuesta = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                marca: marca,
                odometro: odometro,
                anios: anios,
                meses: meses,
                terreno: terreno,
                quimica: quimica,
                metodoCarga: metodoCarga,
                regimen: regimen,
                ciclos: ciclos
            })
        });

        if (!respuesta.ok) {
            throw new Error("No se pudo conectar con el servidor de Python.");
        }

        const resultadoIA = await respuesta.json();
        const soh_estimado = resultadoIA.soh_estimado;
        const prediccionFalla = resultadoIA.prediccion_falla;

        // 4. Evaluar Criticidad (Semáforo) basado en la IA real
        let colorBorde, textoEstado, descEstado, colorGrafica;
        
        if (soh_estimado >= 80.0 && prediccionFalla === 0) {
            textoEstado = "🟢 ESTADO: ÓPTIMO";
            descEstado = "La batería opera en condiciones seguras según el modelo predictivo de IA.";
            colorBorde = "#10b981"; // Verde
            colorGrafica = "#10b981";
        } else if (soh_estimado >= 70.0) {
            textoEstado = "🟡 ESTADO: PREVENTIVO";
            descEstado = "Se detecta desgaste moderado. Se sugiere programar mantenimiento preventivo.";
            colorBorde = "#f59e0b"; // Amarillo
            colorGrafica = "#f59e0b";
        } else {
            textoEstado = "🔴 ESTADO: CRÍTICO";
            descEstado = "Alto riesgo de fallo inminente detectado por la red de Machine Learning.";
            colorBorde = "#ef4444"; // Rojo
            colorGrafica = "#ef4444";
        }

        // 5. Guardar en el Historial Local del navegador
        guardarEnHistorial({
            marca: marca,
            quimica: quimica,
            odometro: odometro,
            ciclos: ciclos,
            terreno: terreno,
            metodoCarga: metodoCarga,
            soh: soh_estimado.toFixed(2),
            estado: textoEstado.replace(/🟢|🟡|🔴/g, '').trim()
        });

        // 6. Actualizar la interfaz HTML (DOM)
        document.getElementById('texto-estado').innerText = textoEstado;
        document.getElementById('desc-estado').innerText = descEstado;
        document.getElementById('res-tiempo').innerText = `${anios} años y ${meses} meses`;
        document.getElementById('res-soh').innerText = `${soh_estimado.toFixed(2)}%`;
        
        const tarjetaSemaforo = document.getElementById('tarjeta-semaforo');
        tarjetaSemaforo.style.border = `2px solid ${colorBorde}`;
        
        // Mostrar sección de resultados con desplazamiento suave
        const seccionResultados = document.getElementById('seccion-resultados');
        seccionResultados.classList.remove('hidden');
        seccionResultados.scrollIntoView({ behavior: 'smooth' });

        // 7. Renderizar Gráficas con Chart.js
        renderizarGraficas(soh_estimado, anios, colorGrafica);

    } catch (error) {
        console.error("Error de conexión:", error);
        alert("⚠️ Asegúrate de tener encendido tu archivo app.py en la terminal ejecutando 'python app.py'.");
    } finally {
        btnSubmit.innerHTML = textoOriginal;
    }
});

function renderizarGraficas(soh, anios_uso, colorPrincipal) {
    if (chartDona) chartDona.destroy();
    if (chartCurva) chartCurva.destroy();

    const desgaste_total = 100.0 - soh;
    const desgaste_uso = desgaste_total * 0.65;
    const desgaste_tiempo = desgaste_total * 0.35;

    const ctxDona = document.getElementById('graficaDona').getContext('2d');
    chartDona = new Chart(ctxDona, {
        type: 'doughnut',
        data: {
            labels: ['Salud (SoH)', 'Desgaste Operativo', 'Degradación por Edad'],
            datasets: [{
                data: [soh.toFixed(1), desgaste_uso.toFixed(1), desgaste_tiempo.toFixed(1)],
                backgroundColor: [colorPrincipal, '#3b82f6', '#64748b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8' } }
            }
        }
    });

    const degradacion_promedio = (100.0 - soh) / Math.max(1, anios_uso);
    const soh_hist = [
        Math.min(100.0, soh + (degradacion_promedio * 2)),
        Math.min(100.0, soh + degradacion_promedio),
        soh,
        Math.max(0.0, soh - (degradacion_promedio * 1.5)),
        Math.max(0.0, soh - (degradacion_promedio * 3.5))
    ];
    const estres = [degradacion_promedio*0.8, degradacion_promedio*0.9, degradacion_promedio, degradacion_promedio*1.3, degradacion_promedio*1.8];

    const ctxCurva = document.getElementById('graficaCurva').getContext('2d');
    chartCurva = new Chart(ctxCurva, {
        type: 'line',
        data: {
            labels: ["Hace 2 años", "Hace 1 año", "Año Actual", "Próximo Año", "En 2 Años"],
            datasets: [
                {
                    label: 'Salud (SoH %)',
                    data: soh_hist,
                    borderColor: colorPrincipal,
                    backgroundColor: colorPrincipal,
                    borderWidth: 3,
                    tension: 0.4,
                    type: 'line',
                    order: 0
                },
                {
                    label: 'Estrés Operativo',
                    data: estres,
                    backgroundColor: 'rgba(59, 130, 246, 0.4)',
                    type: 'bar',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8' } }
            }
        }
    });
}

// --- SISTEMA DE ALMACENAMIENTO Y EXPORTACIÓN A EXCEL ---

function guardarEnHistorial(datos) {
    let historial = JSON.parse(localStorage.getItem('diseb_historial')) || [];
    datos.fecha = new Date().toLocaleString();
    historial.push(datos);
    localStorage.setItem('diseb_historial', JSON.stringify(historial));
}

window.exportarExcel = function() {
    const historial = JSON.parse(localStorage.getItem('diseb_historial')) || [];
    
    if (historial.length === 0) {
        alert("No hay diagnósticos guardados para exportar.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Fecha,Marca,Quimica,Odometro,Ciclos,Terreno,Carga,SoH_Estimado,Estado\n";

    historial.forEach(row => {
        let fila = [
            `"${row.fecha}"`,
            `"${row.marca}"`,
            `"${row.quimica}"`,
            row.odometro,
            row.ciclos,
            `"${row.terreno}"`,
            `"${row.metodoCarga}"`,
            row.soh,
            `"${row.estado}"`
        ];
        csvContent += fila.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Historial_Diagnosticos_DISEB.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}