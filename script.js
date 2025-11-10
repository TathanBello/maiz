/* script.js — Simulación, gráficas, predicción de sequía y DFA funcional (acepta t then h)
   Requiere Chart.js (incluido en index.html via CDN).
*/
document.addEventListener("DOMContentLoaded", () => {
  // ---- UI elementos ----
  const tempEl = document.getElementById("temp");
  const humEl = document.getElementById("hum");
  const precEl = document.getElementById("prec");
  const windEl = document.getElementById("wind");
  const pressEl = document.getElementById("press");
  const alertsEl = document.getElementById("alertsList");

  const barTemp = document.getElementById("barTemp");
  const barHum = document.getElementById("barHum");
  const barPrec = document.getElementById("barPrec");

  const speedInput = document.getElementById("speed");
  const noiseInput = document.getElementById("noise");
  const toggleBtn = document.getElementById("toggleSim");
  const resetBtn = document.getElementById("resetSim");
  const simModeEl = document.getElementById("simMode");

  const predTempEl = document.getElementById("predTemp");
  const predConfEl = document.getElementById("predConf");
  const droughtEl = document.getElementById("droughtRisk");
  const summaryHum = document.getElementById("summaryHum");
  const summaryPrec = document.getElementById("summaryPrec");
  const summaryList = document.getElementById("summaryList");

  const ctx = document.getElementById("chartTemp").getContext("2d");

  // Autómata UI
  const inputTemp = document.getElementById("inputTemp");
  const inputHum = document.getElementById("inputHum");
  const inputPrec = document.getElementById("inputPrec");
  const inputWind = document.getElementById("inputWind");
  const inputPress = document.getElementById("inputPress");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const fromSensorsBtn = document.getElementById("fromSensorsBtn");
  const seqEl = document.getElementById("generatedSeq");
  const dfaResultEl = document.getElementById("dfaResult");
  const dfaExplainEl = document.getElementById("dfaExplain");

  // Header / logout
  const welcomeEl = document.getElementById("welcome");
  const logoutBtn = document.getElementById("logoutBtn");
  const logged = localStorage.getItem("loggedUser");
  if (logged) welcomeEl.innerHTML = `👋 Bienvenido, <b>${logged}</b>`;
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedUser");
    window.location.href = "login.html";
  });

  // ---- Chart.js setup ----
  const chartData = {
    labels: [],
    datasets: [{
      label: "Temperatura (°C)",
      data: [],
      borderColor: "#66fcf1",
      backgroundColor: "#66fcf133",
      tension: 0.25,
      fill: true
    }]
  };

  const chart = new Chart(ctx, {
    type: "line",
    data: chartData,
    options: {
      responsive: true,
      animation: false,
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: { x: { ticks: { color: "#ddd" } }, y: { ticks: { color: "#ddd" } } }
    }
  });

  // ---- Simulación ----
  let running = false;
  let intervalId = null;
  let accumPrec = 0;
  let humHistory = [];

  function randomNoise(noise) { return (Math.random() - 0.5) * (noise / 10); }

  function generateReading() {
    const noise = Number(noiseInput ? noiseInput.value : 8);
    const baseTemp = 22 + Math.sin(Date.now() / 60000) * 4;
    const temp = +(baseTemp + Math.random() * 4 + randomNoise(noise)).toFixed(1);
    const hum = +(40 + Math.random() * 50 + randomNoise(noise)).toFixed(1);
    const prec = +(Math.random() * 6 * (Math.random() < 0.7 ? 0.2 : 1)).toFixed(1); // 🔹 70-30 en alertas
    const wind = +(Math.random() * 8).toFixed(1);
    const press = +(1010 + (Math.random() - 0.5) * 20).toFixed(1);
    return { temp, hum, prec, wind, press };
  }

  function pushToChart(temp) {
    const now = new Date().toLocaleTimeString();
    chartData.labels.push(now);
    chartData.datasets[0].data.push(temp);
    if (chartData.labels.length > 30) {
      chartData.labels.shift();
      chartData.datasets[0].data.shift();
    }
    chart.update();
  }

  function updateUI(reading) {
    tempEl.textContent = `${reading.temp} °C`;
    humEl.textContent = `${reading.hum} %`;
    precEl.textContent = `${reading.prec} mm`;
    windEl.textContent = `${reading.wind} m/s`;
    pressEl.textContent = `${reading.press} hPa`;

    barTemp.style.width = `${Math.min(100, reading.temp * 3)}%`;
    barHum.style.width = `${Math.min(100, reading.hum)}%`;
    barPrec.style.width = `${Math.min(100, reading.prec * 20)}%`;

    accumPrec = +(accumPrec + reading.prec);
    humHistory.push(reading.hum);
    if (humHistory.length > 30) humHistory.shift();

    // --- Alertas: 30% de probabilidad de generarlas ---
    const alerts = [];
    if (Math.random() < 0.3) {
      if (reading.temp >= 35) alerts.push("🔥 Temperatura muy alta");
      if (reading.temp <= 5) alerts.push("❄️ Temperatura muy baja");
      if (reading.prec > 3) alerts.push("🌧️ Lluvia intensa");
      if (reading.hum < 30) alerts.push("💨 Humedad muy baja");
    }
    alertsEl.innerHTML = alerts.length ? alerts.join(" · ") : "No hay alertas.";

    const avgHum = humHistory.length ? (humHistory.reduce((a,b)=>a+Number(b),0)/humHistory.length).toFixed(1) : "--";
    summaryHum.textContent = `Humedad promedio: ${avgHum} %`;
    summaryPrec.textContent = `Precip. acumulada (sim): ${accumPrec.toFixed(1)} mm`;
    summaryList.querySelector("li").textContent = `Última actualización: ${new Date().toLocaleString()}`;
  }

  // ---- Predicción ----
  function computePrediction(useInputs = false) {
    let arr = chartData.datasets[0].data.map(Number);
    if (useInputs) {
      const t = parseFloat(inputTemp.value);
      if (!isNaN(t)) arr.push(t);
    }
    if (!arr.length) {
      predTempEl.textContent = "-- °C";
      predConfEl.textContent = "-- %";
      return;
    }

    const avg = arr.reduce((a,b)=>a+Number(b),0)/arr.length;
    const trend = arr.length >= 2 ? (arr[arr.length-1] - arr[0]) / arr.length : 0;
    const pred = +(avg + trend * 6).toFixed(1);
    const conf = Math.max(30, Math.min(95, 90 - (Math.abs(trend) * 10)));

    predTempEl.textContent = `${pred} °C`;
    predConfEl.textContent = `${Math.round(conf)} %`;

    const avgHum = humHistory.length ? (humHistory.reduce((a,b)=>a+Number(b),0)/humHistory.length) : 50;
    const prec = accumPrec;

    // --- Riesgo de sequía con 70/30 y lógica ambiental ---
    let risk = "Bajo";
    const rand = Math.random();

    if (avgHum < 35 && prec < 10 && pred > 28) {
      if (rand < 0.5) risk = "Alto";
      else risk = "Medio";
    } else if (avgHum < 50 && prec < 15 && pred > 26) {
      if (rand < 0.3) risk = "Medio";
      else risk = "Bajo";
    } else {
      if (rand < 0.2) risk = "Medio";
      else risk = "Bajo";
    }

    droughtEl.textContent = risk;
    droughtEl.style.color = (risk==="Alto") ? "#ff6b6b" : (risk==="Medio") ? "#ffd166" : "#9ef6c1";
  }

  function tick() {
    const r = generateReading();
    updateUI(r);
    pushToChart(r.temp);
    computePrediction();
  }

  toggleBtn.addEventListener("click", () => {
    if (running) {
      clearInterval(intervalId);
      running = false;
      toggleBtn.textContent = "Iniciar";
      simModeEl.textContent = "Local";
    } else {
      const speed = Number(speedInput ? speedInput.value : 800);
      intervalId = setInterval(tick, speed);
      running = true;
      toggleBtn.textContent = "Detener";
      simModeEl.textContent = "Simulación";
    }
  });

  resetBtn.addEventListener("click", () => {
    clearInterval(intervalId);
    running = false;
    toggleBtn.textContent = "Iniciar";
    simModeEl.textContent = "Local";
    chartData.labels = [];
    chartData.datasets[0].data = [];
    chart.update();
    tempEl.textContent = "-- °C";
    humEl.textContent = "-- %";
    precEl.textContent = "-- mm";
    windEl.textContent="-- m/s";
    pressEl.textContent="-- hPa";
    alertsEl.textContent = "No hay alertas.";
    predTempEl.textContent="-- °C";
    predConfEl.textContent="-- %";
    accumPrec = 0;
    humHistory = [];
    summaryHum.textContent = `Humedad promedio: --`;
    summaryPrec.textContent = `Precip. acumulada (sim): 0 mm`;
    summaryList.querySelector("li").textContent = `Última actualización: --`;
  });

  for (let i=0;i<6;i++){ const r=generateReading(); updateUI(r); pushToChart(r.temp); }
  computePrediction();

  // ---- DFA funcional ----
  function generateSequenceFromInputs(temp, hum, prec, wind, press){
    const t = Number(temp); const h = Number(hum); const p = Number(prec);
    const s1 = (t >= 25) ? 't' : 'x';
    const s2 = (h >= 60) ? 'h' : 'x';
    const s3 = (p > 0) ? 'r' : 'x';
    return [s1, s2, s3];
  }

  function resetStates() {
    ["s_q0","s_q1","s_q2","s_qacc"].forEach(id=>{
      const g=document.getElementById(id);
      if(!g)return;
      const c=g.querySelector("circle");const t=g.querySelector("text");
      if(c){c.setAttribute("fill","#222");c.setAttribute("stroke","#333");}
      if(t)t.setAttribute("fill","#fff");
    });
    ["l_q0_q1","l_q1_q2","l_q2_qacc"].forEach(id=>{
      const L=document.getElementById(id);
      if(L)L.setAttribute("stroke","#333");
    });
  }

  function highlightState(id, fill="#66fcf1", text="#071014") {
    const g=document.getElementById(id);
    if(!g)return;
    const c=g.querySelector("circle");const t=g.querySelector("text");
    if(c)c.setAttribute("fill",fill);
    if(t)t.setAttribute("fill",text);
  }

  function sequenceHasTH(seq){
    for(let i=0;i<seq.length-1;i++){
      if(seq[i]==='t' && seq[i+1]==='h') return true;
    }
    return false;
  }

  function animateDFASequence(seq, stepMs=700) {
    resetStates();
    seqEl.textContent = seq.join(' ');
    dfaResultEl.textContent = "EJECUTANDO...";
    dfaExplainEl.textContent = "Procesando...";
    highlightState("s_q0", "#3fcf9f", "#071014");
    let i=0;
    const iv=setInterval(()=>{
      if(i>=seq.length){
        clearInterval(iv);
        const accepted=sequenceHasTH(seq);
        dfaResultEl.textContent = accepted ? "ACEPTADA" : "RECHAZADA";
        dfaExplainEl.innerHTML = accepted
          ? `Se encontró la subsecuencia <code>t h</code> (temperatura seguida de humedad).`
          : `No se encontró <code>t h</code> en la secuencia.`;
        computePrediction(true); 
        return;
      }
      const sym=seq[i];
      if(sym==='t'){document.getElementById("l_q0_q1")?.setAttribute("stroke","#66fcf1");highlightState("s_q1","#66fcf1","#071014");}
      else if(sym==='h'){document.getElementById("l_q2_qacc")?.setAttribute("stroke","#ffd700");highlightState("s_qacc","#ffd700","#071014");}
      else if(sym==='r'){highlightState("s_q0","#3fb6b0","#071014");}
      else{highlightState("s_q0","#ff7b7b","#071014");}
      i++;
    },stepMs);
  }

  function analyzeFromInputs(temp, hum, prec, wind, press){
    const seq=generateSequenceFromInputs(temp, hum, prec, wind, press);
    animateDFASequence(seq,700);
  }

  analyzeBtn.addEventListener("click",()=>analyzeFromInputs(inputTemp.value,inputHum.value,inputPrec.value,inputWind.value,inputPress.value));
  fromSensorsBtn.addEventListener("click",()=>{
    const t=parseFloat((tempEl.textContent||"").replace("°C",""))||Number(inputTemp.value);
    const h=parseFloat((humEl.textContent||"").replace("%",""))||Number(inputHum.value);
    const p=parseFloat((precEl.textContent||"").replace("mm",""))||Number(inputPrec.value);
    const w=parseFloat((windEl.textContent||"").replace("m/s",""))||Number(inputWind.value);
    const pr=parseFloat((pressEl.textContent||"").replace("hPa",""))||Number(inputPress.value);
    inputTemp.value=t;inputHum.value=h;inputPrec.value=p;inputWind.value=w;inputPress.value=pr;
    analyzeFromInputs(t,h,p,w,pr);
  });

  resetStates();
});
