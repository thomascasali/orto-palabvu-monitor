const socket = io();

function aggiornaUltimeLetture(tipo, valore, ora) {
    document.getElementById('ultimaLettura' + tipo).innerText = valore;
    document.getElementById('oraUltimaLettura').innerText = ora;
}

function formattaOra() {
    const now = new Date();
    return now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
}

// ── Umidita Terreno (con soglie annotate) ────────────────────
const ctx = document.getElementById('umiditaTerrenoChart').getContext('2d');
const umiditaTerrenoChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Umidità terreno',
            data: [],
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
            borderColor: 'rgba(0, 123, 255, 1)',
            borderWidth: 1,
            pointRadius: 1
        }]
    },
    options: {
        scales: {
            y: { beginAtZero: true }
        },
        plugins: {
            annotation: {
                annotations: [
                    {
                        type: 'line',
                        yMin: 2.5, yMax: 2.5,
                        borderColor: 'red', borderWidth: 1,
                        label: { content: 'Terreno secco', enabled: true, position: 'end' }
                    },
                    {
                        type: 'line',
                        yMin: 1.8, yMax: 1.8,
                        borderColor: 'yellow', borderWidth: 1,
                        label: { content: 'Terreno poco umido', enabled: true, position: 'end' }
                    },
                    {
                        type: 'line',
                        yMin: 1.2, yMax: 1.2,
                        borderColor: 'green', borderWidth: 1,
                        label: { content: 'Terreno umido', enabled: true, position: 'end' }
                    },
                    {
                        type: 'line',
                        yMin: 0.6, yMax: 0.6,
                        borderColor: 'blue', borderWidth: 1,
                        label: { content: 'Terreno bagnato', enabled: true, position: 'end' }
                    }
                ]
            }
        }
    }
});

socket.on('umiditaTerrenoStorico', (datiStorici) => {
    datiStorici.forEach(dato => {
        const dataOra = new Date(dato.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!umiditaTerrenoChart.data.labels.includes(oraMinuti)) {
            umiditaTerrenoChart.data.labels.push(oraMinuti);
            umiditaTerrenoChart.data.datasets[0].data.push(dato.value);
        }
    });
    umiditaTerrenoChart.update();

    if (datiStorici.length > 0) {
        const ultimo = datiStorici[datiStorici.length - 1];
        const dataOra = new Date(ultimo.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        aggiornaUltimeLetture('UmiditaTerreno', ultimo.value, oraMinuti);
    }
});

socket.on('umiditaTerrenoUpdate', (message) => {
    const ora = formattaOra();
    umiditaTerrenoChart.data.labels.push(ora);
    umiditaTerrenoChart.data.datasets[0].data.push(message);
    umiditaTerrenoChart.update();
    aggiornaUltimeLetture('UmiditaTerreno', message, ora);

    if (umiditaTerrenoChart.data.labels.length > 50) {
        umiditaTerrenoChart.data.labels.shift();
        umiditaTerrenoChart.data.datasets[0].data.shift();
    }
});

// ── Temperatura Aria ─────────────────────────────────────────
const ctx1 = document.getElementById('temperaturaChart').getContext('2d');
const temperaturaChart = new Chart(ctx1, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temperatura aria',
            data: [],
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
            borderColor: 'rgba(0, 123, 255, 1)',
            borderWidth: 1,
            pointRadius: 1
        }]
    },
    options: {
        scales: {
            y: { beginAtZero: true }
        }
    }
});

socket.on('temperaturaAriaStorico', (datiStorici) => {
    datiStorici.forEach(dato => {
        const dataOra = new Date(dato.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!temperaturaChart.data.labels.includes(oraMinuti)) {
            temperaturaChart.data.labels.push(oraMinuti);
            temperaturaChart.data.datasets[0].data.push(dato.value);
        }
    });
    temperaturaChart.update();

    if (datiStorici.length > 0) {
        const ultimo = datiStorici[datiStorici.length - 1];
        const dataOra = new Date(ultimo.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        aggiornaUltimeLetture('Temperatura', ultimo.value, oraMinuti);
    }
});

socket.on('temperaturaUpdate', (message) => {
    const ora = formattaOra();
    temperaturaChart.data.labels.push(ora);
    temperaturaChart.data.datasets[0].data.push(message);
    temperaturaChart.update();
    aggiornaUltimeLetture('Temperatura', message, ora);

    if (temperaturaChart.data.labels.length > 50) {
        temperaturaChart.data.labels.shift();
        temperaturaChart.data.datasets[0].data.shift();
    }
});

// ── Umidita Aria ─────────────────────────────────────────────
const ctx2 = document.getElementById('umiditaAriaChart').getContext('2d');
const umiditaAriaChart = new Chart(ctx2, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Umidità aria',
            data: [],
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
            borderColor: 'rgba(0, 123, 255, 1)',
            borderWidth: 1,
            pointRadius: 1
        }]
    },
    options: {
        scales: {
            y: { beginAtZero: true }
        }
    }
});

socket.on('umiditaAriaStorico', (datiStorici) => {
    datiStorici.forEach(dato => {
        const dataOra = new Date(dato.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!umiditaAriaChart.data.labels.includes(oraMinuti)) {
            umiditaAriaChart.data.labels.push(oraMinuti);
            umiditaAriaChart.data.datasets[0].data.push(dato.value);
        }
    });
    umiditaAriaChart.update();

    if (datiStorici.length > 0) {
        const ultimo = datiStorici[datiStorici.length - 1];
        const dataOra = new Date(ultimo.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        aggiornaUltimeLetture('UmiditaAria', ultimo.value, oraMinuti);
    }
});

socket.on('umiditaAriaUpdate', (message) => {
    const ora = formattaOra();
    umiditaAriaChart.data.labels.push(ora);
    umiditaAriaChart.data.datasets[0].data.push(message);
    umiditaAriaChart.update();
    aggiornaUltimeLetture('UmiditaAria', message, ora);

    if (umiditaAriaChart.data.labels.length > 50) {
        umiditaAriaChart.data.labels.shift();
        umiditaAriaChart.data.datasets[0].data.shift();
    }
});

// ── Pressione ────────────────────────────────────────────────
const ctx3 = document.getElementById('pressioneChart').getContext('2d');
const pressioneChart = new Chart(ctx3, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Pressione atmosferica',
            data: [],
            backgroundColor: 'rgba(255, 206, 86, 0.5)',
            borderColor: 'rgba(255, 206, 86, 1)',
            borderWidth: 1,
            pointRadius: 1
        }]
    },
    options: {
        scales: {
            y: { beginAtZero: false }
        }
    }
});

socket.on('pressioneStorico', (datiStorici) => {
    datiStorici.forEach(dato => {
        const dataOra = new Date(dato.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!pressioneChart.data.labels.includes(oraMinuti)) {
            pressioneChart.data.labels.push(oraMinuti);
            pressioneChart.data.datasets[0].data.push(dato.value);
        }
    });
    pressioneChart.update();

    if (datiStorici.length > 0) {
        const ultimo = datiStorici[datiStorici.length - 1];
        const dataOra = new Date(ultimo.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        aggiornaUltimeLetture('Pressione', ultimo.value, oraMinuti);
    }
});

socket.on('pressioneUpdate', (message) => {
    const ora = formattaOra();
    pressioneChart.data.labels.push(ora);
    pressioneChart.data.datasets[0].data.push(message);
    pressioneChart.update();
    aggiornaUltimeLetture('Pressione', message, ora);

    if (pressioneChart.data.labels.length > 50) {
        pressioneChart.data.labels.shift();
        pressioneChart.data.datasets[0].data.shift();
    }
});

// ── Temperatura Terreno ──────────────────────────────────────
const ctx4 = document.getElementById('temperaturaTerrenoChart').getContext('2d');
const temperaturaTerrenoChart = new Chart(ctx4, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temperatura terreno',
            data: [],
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
            borderColor: 'rgba(0, 123, 255, 1)',
            borderWidth: 1,
            pointRadius: 1
        }]
    },
    options: {
        scales: {
            y: { beginAtZero: true }
        }
    }
});

socket.on('temperaturaTerrenoStorico', (datiStorici) => {
    datiStorici.forEach(dato => {
        const dataOra = new Date(dato.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!temperaturaTerrenoChart.data.labels.includes(oraMinuti)) {
            temperaturaTerrenoChart.data.labels.push(oraMinuti);
            temperaturaTerrenoChart.data.datasets[0].data.push(dato.value);
        }
    });
    temperaturaTerrenoChart.update();

    if (datiStorici.length > 0) {
        const ultimo = datiStorici[datiStorici.length - 1];
        const dataOra = new Date(ultimo.timestamp);
        const oraMinuti = dataOra.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        aggiornaUltimeLetture('TemperaturaTerreno', ultimo.value, oraMinuti);
    }
});

socket.on('temperaturaTerrenoUpdate', (message) => {
    const ora = formattaOra();
    temperaturaTerrenoChart.data.labels.push(ora);
    temperaturaTerrenoChart.data.datasets[0].data.push(message);
    temperaturaTerrenoChart.update();
    aggiornaUltimeLetture('TemperaturaTerreno', message, ora);

    if (temperaturaTerrenoChart.data.labels.length > 50) {
        temperaturaTerrenoChart.data.labels.shift();
        temperaturaTerrenoChart.data.datasets[0].data.shift();
    }
});
