const socket = io();

function aggiornaUltimeLetture(tipo, valore, ora) {
    document.getElementById('ultimaLettura' + tipo).innerText = valore;
    document.getElementById('oraUltimaLettura').innerText = ora;
}

function creaGrafico(ctx, label, bgColor, borderColor) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                backgroundColor: bgColor,
                borderColor: borderColor,
                borderWidth: 1,
                pointRadius: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

const ctxInternaTemp = document.getElementById('temperaturaInternaChart').getContext('2d');
const temperaturaInternaChart = creaGrafico(ctxInternaTemp, 'Temperatura Interna', 'rgba(255, 99, 132, 0.5)', 'rgba(255, 99, 132, 1)');

const ctxTemperaturaTerreno = document.getElementById('temperaturaTerrenoChart').getContext('2d');
const temperaturaTerrenoChart = creaGrafico(ctxTemperaturaTerreno, 'Temperatura Terreno', 'rgba(255, 255, 0, 0.5)', 'rgba(255, 99, 99, 1)');

const ctxInternaUmidita = document.getElementById('umiditaInternaChart').getContext('2d');
const umiditaInternaChart = creaGrafico(ctxInternaUmidita, 'Umidità Interna', 'rgba(54, 162, 235, 0.5)', 'rgba(54, 162, 235, 1)');

const ctxInternaPressione = document.getElementById('pressioneInternaChart').getContext('2d');
const pressioneInternaChart = creaGrafico(ctxInternaPressione, 'Pressione Interna', 'rgba(75, 192, 192, 0.5)', 'rgba(75, 192, 192, 1)');

const ctxEsternaTemp = document.getElementById('temperaturaEsternaChart').getContext('2d');
const temperaturaEsternaChart = creaGrafico(ctxEsternaTemp, 'Temperatura Esterna', 'rgba(153, 102, 255, 0.5)', 'rgba(153, 102, 255, 1)');

const ctxEsternaUmidita = document.getElementById('umiditaEsternaChart').getContext('2d');
const umiditaEsternaChart = creaGrafico(ctxEsternaUmidita, 'Umidità Esterna', 'rgba(255, 159, 64, 0.5)', 'rgba(255, 159, 64, 1)');

const ctxEsternaPressione = document.getElementById('pressioneEsternaChart').getContext('2d');
const pressioneEsternaChart = creaGrafico(ctxEsternaPressione, 'Pressione Esterna', 'rgba(75, 192, 192, 0.5)', 'rgba(75, 192, 192, 1)');

const ctxUmiditaTerreno = document.getElementById('umiditaTerrenoChart').getContext('2d');
const umiditaTerrenoChart = creaGrafico(ctxUmiditaTerreno, 'Umidità della Sabbia (%)', 'rgba(75, 192, 192, 0.5)', 'rgba(75, 192, 192, 1)');

function aggiornaGrafico(chart, tipo, message) {
    const now = new Date();
    const time = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(message);
    chart.update();
    aggiornaUltimeLetture(tipo, message, time);

    if (chart.data.labels.length > 50) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
}

function caricaDatiStorici(chart, datiStorici, tipo) {
    datiStorici.forEach(dato => {
        const dataOra = new Date(dato.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!chart.data.labels.includes(oraMinuti)) {
            chart.data.labels.push(oraMinuti);
            chart.data.datasets[0].data.push(dato.value);
        }
    });
    chart.update();

    // Popola la tabella ultime letture con l'ultimo dato storico disponibile
    if (tipo && datiStorici.length > 0) {
        const ultimo = datiStorici[datiStorici.length - 1];
        const dataOra = new Date(ultimo.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        aggiornaUltimeLetture(tipo, ultimo.value, oraMinuti);
    }
}

// Dati storici
socket.on('temperaturaInternaStorico', (datiStorici) => caricaDatiStorici(temperaturaInternaChart, datiStorici, 'TemperaturaInterna'));
socket.on('temperaturaTerrenoStorico', (datiStorici) => caricaDatiStorici(temperaturaTerrenoChart, datiStorici, 'TemperaturaTerreno'));
socket.on('umiditaInternaStorico', (datiStorici) => caricaDatiStorici(umiditaInternaChart, datiStorici, 'UmiditaInterna'));
socket.on('pressioneInternaStorico', (datiStorici) => caricaDatiStorici(pressioneInternaChart, datiStorici, 'PressioneInterna'));
socket.on('temperaturaEsternaStorico', (datiStorici) => caricaDatiStorici(temperaturaEsternaChart, datiStorici, 'TemperaturaEsterna'));
socket.on('umiditaEsternaStorico', (datiStorici) => caricaDatiStorici(umiditaEsternaChart, datiStorici, 'UmiditaEsterna'));
socket.on('pressioneEsternaStorico', (datiStorici) => caricaDatiStorici(pressioneEsternaChart, datiStorici, 'PressioneEsterna'));

// Aggiornamenti real-time
socket.on('temperaturaInternaUpdate', (message) => aggiornaGrafico(temperaturaInternaChart, 'TemperaturaInterna', message));
socket.on('temperaturaTerrenoUpdate', (message) => aggiornaGrafico(temperaturaTerrenoChart, 'TemperaturaTerreno', message));
socket.on('umiditaInternaUpdate', (message) => aggiornaGrafico(umiditaInternaChart, 'UmiditaInterna', message));
socket.on('pressioneInternaUpdate', (message) => aggiornaGrafico(pressioneInternaChart, 'PressioneInterna', message));
socket.on('temperaturaEsternaUpdate', (message) => aggiornaGrafico(temperaturaEsternaChart, 'TemperaturaEsterna', message));
socket.on('umiditaEsternaUpdate', (message) => aggiornaGrafico(umiditaEsternaChart, 'UmiditaEsterna', message));
socket.on('pressioneEsternaUpdate', (message) => aggiornaGrafico(pressioneEsternaChart, 'PressioneEsterna', message));

// Umidita sabbia (conversione in percentuale)
function convertiInPercentuale(valore) {
    if (valore >= 3.2) return null;
    return Math.floor(100 - Math.min(100, Math.max(0, (valore / 3.2) * 100)));
}

socket.on('umiditaTerrenoStorico', (datiStorici) => {
    let ultimoValido = null;
    let ultimaOra = null;
    datiStorici.forEach(dato => {
        const valorePercentuale = convertiInPercentuale(dato.value);
        if (valorePercentuale !== null) {
            const dataOra = new Date(dato.timestamp);
            const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (!umiditaTerrenoChart.data.labels.includes(oraMinuti)) {
                umiditaTerrenoChart.data.labels.push(oraMinuti);
                umiditaTerrenoChart.data.datasets[0].data.push(valorePercentuale);
            }
            ultimoValido = valorePercentuale;
            ultimaOra = oraMinuti;
        }
    });
    umiditaTerrenoChart.update();

    // Popola tabella con ultimo dato storico valido
    if (ultimoValido !== null) {
        aggiornaUltimeLetture('UmiditaTerreno', ultimoValido, ultimaOra);
    }
});

socket.on('umiditaTerrenoUpdate', (message) => {
    const valore = parseFloat(message);
    const valorePercentuale = convertiInPercentuale(valore);
    if (valorePercentuale !== null) {
        aggiornaGrafico(umiditaTerrenoChart, 'UmiditaTerreno', valorePercentuale);
    }
});
