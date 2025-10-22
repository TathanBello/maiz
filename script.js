/* script.js: dinámica mejorada con fallback para Chart.js y anime.js */

/* --- Estado global --- */
let simInterval = null;
const base = { temp: 23, hum: 55, prec: 0, wind: 2.5, press: 1013 };
const history = { temp: [], hum: [], prec: [] };

/* --- Utilidades --- */
function randn(mean=0, sd=1){ let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*sd + mean; }
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

/* --- UI updates --- */
function setText(id, txt){ const el=document.getElementById(id); if(el) el.textContent = txt; }
function setBar(id, pct){ const el=document.getElementById(id); if(el) el.style.width = pct + '%'; }

/* --- Update UI with readings --- */
function updateUI(r){
  setText('temp', r.temp.toFixed(1) + ' °C');
  setText('hum', r.hum.toFixed(1) + ' %');
  setText('prec', r.prec.toFixed(1) + ' mm');
  setText('wind', r.wind.toFixed(1) + ' m/s');
  setText('press', r.press.toFixed(0) + ' hPa');

  // animate bars: map sensible ranges
  const tPct = clamp(((r.temp - 5) / (45 - 5)) * 100, 0, 100);
  const hPct = clamp(r.hum, 0, 100);
  const pPct = clamp((r.prec / 30) * 100, 0, 100);
  setBar('barTemp', tPct);
  setBar('barHum', hPct);
  setBar('barPrec', pPct);
}

/* --- Alerts --- */
function checkAlerts(r){
  const arr=[];
  if(r.temp > 25 && r.hum < 40) arr.push('⚠️ Alerta de SEQUÍA: temperatura alta y humedad baja.');
  if(r.hum > 85 && r.prec > 10) arr.push('⚠️ Alerta de INUNDACIÓN: humedad y precipitación altas.');
  const html = arr.length ? arr.join('<br>') : 'No hay alertas.';
  document.getElementById('alertsList').innerHTML = html;
}

/* --- Predicción simple --- */
function predictTempSimple(data){
  if(!data.length) return {pred: base.temp, conf: 50};
  if(data.length < 2) return {pred: data[0]||base.temp, conf:50};
  const alpha = 0.4; let s = data[0];
  for(let i=1;i<data.length;i++) s = alpha*data[i] + (1-alpha)*s;
  const pred = s + (data[data.length-1]-data[data.length-2])*0.6;
  const mean = data.reduce((a,b)=>a+b,0)/data.length;
  const variance = data.reduce((a,b)=>a+Math.pow(b-mean,2),0)/data.length;
  const conf = Math.max(30, Math.round(100 - Math.min(80, variance*4)));
  return {pred, conf};
}

/* --- Chart.js or fallback drawing --- */
let chartInstance = null;
function initChart(){
  const ctx = document.getElementById('chartTemp').getContext('2d');
  if(window.Chart){
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [{ label:'Temp (°C)', data: [], borderColor:'#0077b6', backgroundColor:'rgba(0,119,182,0.08)', tension:0.3 }] },
      options: { animation:false, scales:{ x:{display:false}, y:{min:0} } }
    });
    document.getElementById('simMode').textContent = 'Con librerías (Chart.js)';
  } else {
    // fallback: just clear canvas
    ctx.clearRect(0,0,700,160);
    document.getElementById('simMode').textContent = 'Local (sin Chart.js)';
  }
}
function updateChart(){
  if(chartInstance){
    const data = history.temp.slice(-40);
    chartInstance.data.labels = data.map((_,i)=>i);
    chartInstance.data.datasets[0].data = data;
    chartInstance.update();
  } else {
    // fallback draw
    const c = document.getElementById('chartTemp').getContext('2d');
    c.clearRect(0,0,700,160);
    if(history.temp.length < 2) return;
    c.strokeStyle = '#0077b6'; c.lineWidth = 2; c.beginPath();
    const slice = history.temp.slice(-40);
    const minVal = Math.min(...slice)-1, maxVal = Math.max(...slice)+1;
    slice.forEach((v,i)=>{
      const x = 20 + (660/(slice.length-1))*i;
      const y = 140 - ((v-minVal)/(maxVal-minVal||1))*120;
      i===0?c.moveTo(x,y):c.lineTo(x,y);
    });
    c.stroke();
  }
}

/* --- Simulation step --- */
function simulateStep(){
  const noise = parseFloat(document.getElementById('noise').value);
  const lastT = history.temp.length?history.temp[history.temp.length-1]:base.temp;
  const temp = clamp(lastT + randn(0, noise/40), 5, 45);
  const hum = clamp(55 + randn(0, noise/10), 2, 100);
  const rainEvent = Math.random() < 0.06;
  let prec = history.prec.length ? history.prec[history.prec.length-1] : base.prec;
  prec = rainEvent ? Math.max(0, prec + Math.abs(randn(6,3))) : Math.max(0, prec - 0.05);
  const wind = clamp(base.wind + randn(0, noise/80), 0, 30);
  const press = clamp(base.press + randn(0, noise/6), 900, 1050);

  history.temp.push(temp); history.hum.push(hum); history.prec.push(prec);
  if(history.temp.length>200){ history.temp.shift(); history.hum.shift(); history.prec.shift(); }

  const r = {temp, hum, prec, wind, press};
  updateUI(r); checkAlerts(r);

  const pred = predictTempSimple(history.temp);
  setText('predTemp', pred.pred.toFixed(1) + ' °C'); setText('predConf', pred.conf + ' %');
  updateChart();
}

/* --- Simulation controls --- */
document.getElementById('toggleSim').addEventListener('click', function(e){
  if(simInterval){ clearInterval(simInterval); simInterval=null; this.textContent='Iniciar'; }
  else { const speed = parseInt(document.getElementById('speed').value); simInterval = setInterval(simulateStep, speed); this.textContent='Pausar'; }
});
document.getElementById('resetSim').addEventListener('click', ()=>{
  clearInterval(simInterval); simInterval = null; document.getElementById('toggleSim').textContent='Iniciar';
  history.temp=[]; history.hum=[]; history.prec=[]; updateUI(base); checkAlerts(base); setText('predTemp','-- °C'); setText('predConf','-- %'); updateChart();
});

/* ---------- Valores -> secuencia (t,h,r,x) ---------- */
function valoresAsecuencia(temp, hum, prec){
  let n_t = Math.round((temp - 22) / 1.4);
  let n_h = Math.round(hum / 22);
  let n_r = Math.round(prec / 5);
  let n_x = Math.round(prec / 2.5);

  n_t = clamp(n_t, 0, 10);
  n_h = clamp(n_h, 0, 10);
  n_r = clamp(n_r, 0, 8);
  n_x = clamp(n_x, 0, 10);

  let seq = '';
  seq += 't'.repeat(n_t);
  seq += 'h'.repeat(n_h);
  seq += 'r'.repeat(n_r);
  seq += 'x'.repeat(n_x);
  if(!seq) seq='n';
  return {seq, counts:{n_t,n_h,n_r,n_x}};
}

/* ---------- DFA detectors ---------- */
function dfaDetectSequia(seq){
  // t{3,}h{2,} subcadena
  return /t{3,}h{2,}/.test(seq);
}
function dfaDetectInundacion(seq){
  return /r{2,}x{3,}/.test(seq);
}

/* ---------- Animar autómata (anime.js si disponible, sino CSS) ---------- */
function highlightState(name){
  const id = 's_' + name;
  const el = document.getElementById(id);
  if(!el) return;
  // remove active from all
  document.querySelectorAll('.state').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  if(window.anime){
    anime({
      targets: '#' + id + ' circle',
      scale: [1,1.12,1],
      duration: 700,
      easing: 'easeInOutQuad'
    });
  } else {
    // CSS transition fallback handled by adding .active
    setTimeout(()=>el.classList.remove('active'),700);
  }
}

/* Visual step-through: simple mapping of seq -> states */
function animateSequence(seq){
  // map: start at q0, after first 't' -> q1, after 3rd t -> q2, after 2nd h -> qacc
  let contT=0, contH=0;
  highlightState('q0');
  let i=0;
  const interval = setInterval(()=>{
    const c = seq[i];
    if(!c){ clearInterval(interval); return; }
    if(c==='t'){ contT++; highlightState(contT>=3?'q2':'q1'); }
    else if(c==='h'){ contH++; if(contH>=2) highlightState('qacc'); else highlightState('q2'); }
    else highlightState('q0');
    i++;
    if(i>=seq.length) setTimeout(()=>clearInterval(interval),300);
  }, 200);
}

/* ---------- Form interactions ---------- */
document.getElementById('analyzeBtn').addEventListener('click', ()=>{
  const temp = parseFloat(document.getElementById('inputTemp').value) || 0;
  const hum = parseFloat(document.getElementById('inputHum').value) || 0;
  const prec = parseFloat(document.getElementById('inputPrec').value) || 0;

  const {seq, counts} = valoresAsecuencia(temp, hum, prec);
  setText('generatedSeq', seq);

  const isSequia = dfaDetectSequia(seq);
  const isInund = dfaDetectInundacion(seq);
  let result = 'Condición normal / sin patrones detectados';
  let explain = '';
  if(isSequia){ result = 'SEQUÍA (t{3,}h{2,})'; explain = 'Subcadena de varias "t" seguida de "h" detectada.'; }
  else if(isInund){ result = 'INUNDACIÓN (r{2,}x{3,})'; explain = 'Subcadena de "r" seguida de varias "x" detectada.'; }

  setText('dfaResult', result); setText('dfaExplain', explain);
  animateSequence(seq);
});

document.getElementById('fromSensorsBtn').addEventListener('click', ()=>{
  const t = history.temp.length ? history.temp[history.temp.length-1] : base.temp;
  const h = history.hum.length ? history.hum[history.hum.length-1] : base.hum;
  const p = history.prec.length ? history.prec[history.prec.length-1] : base.prec;
  document.getElementById('inputTemp').value = t.toFixed(1);
  document.getElementById('inputHum').value = h.toFixed(1);
  document.getElementById('inputPrec').value = p.toFixed(1);
  document.getElementById('analyzeBtn').click();
});

/* ---------- init ---------- */
window.addEventListener('load', ()=>{
  initChart();
  updateUI(base);
  checkAlerts(base);
  updateChart();
  // if anime present, show fancy startup pulse
  if(window.anime) anime({targets:'.card',translateY:[8,0],opacity:[0,1],duration:800,delay:100});
});
