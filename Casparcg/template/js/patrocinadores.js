/* ==========================================================================
   PATROCINADORES

   El logo del autódromo fijo y los patrocinadores rotando debajo, en la
   esquina superior derecha, sin parar mientras el gráfico esté al aire.

   Dos cosas gobiernan este archivo, y las dos vienen de lo que costó la
   barra inferior:

   1. No se rehace nada por vuelta. Los logos se montan una sola vez y
      la rotación solo mueve una clase de un elemento a otro. Un gráfico
      que va a estar horas puesto no puede construir DOM en cada ciclo.

   2. La lista se vuelve a pedir cada tanto. Así un patrocinador subido
      a mitad de evento entra solo, sin bajar el gráfico y volverlo a
      subir, que en directo es un parpadeo en la esquina. Pero solo se
      reconstruye si de verdad cambió: se compara antes.
========================================================================== */

/* La direccion del backend.

   Dentro de CasparCG la plantilla se abre desde file://, que no tiene
   origen del que colgarse, asi que ahi hace falta escribirla entera.

   Pero la misma plantilla corre tambien dentro de la vista previa del
   panel, servida por HTTP desde el propio backend. Alli esa direccion
   fija es justo la equivocada: si el panel se abre desde otra maquina o
   a traves del tunel, 127.0.0.1 es el ordenador de quien mira, no el
   servidor, y el navegador ademas bloquea una peticion http desde una
   pagina https. El grafico salia con su cabecera y sin una sola fila.

   Por eso, servida por HTTP se le pregunta a quien la sirvio. */
var PATROCINIO_API = (location.protocol === "file:")
    ? "http://127.0.0.1:8080/api/v1"
    : location.origin + "/api/v1";

/* Cada cuánto se vuelve a preguntar por la lista. Treinta segundos: no
   es un dato que cambie en vivo como el cronometraje, y preguntarlo más
   a menudo sería gasto sin nada a cambio. */
var PATROCINIO_CADA = 30000;

var paCaja      = null;
var paRotacion  = null;
var paLogo      = null;

var paMarcas    = [];     // los <div> ya montados, en orden
var paIndice    = 0;
var paGiro      = null;   // el temporizador de la rotación
var paSondeo    = null;   // el que vuelve a pedir la lista
var paFirma     = "";     // para no reconstruir si no cambió
var paSegundos  = 6;


function configurarPatrocinio(api){
    if (api) PATROCINIO_API = api;
}


/* ===================================
   PEDIR LA LISTA
=================================== */

async function patrocinioPedir(){

    try {
        const r = await fetch(PATROCINIO_API + "/sponsors/", { cache: "no-store" });
        if (!r.ok) return null;

        /* Los logos llegan con la direccion entera, que fuera de
           CasparCG apunta al ordenador equivocado. */
        return reorientar(await r.json());

    } catch (e) {
        /* Sin backend no se toca nada: lo que ya está montado sigue
           rotando. Un corte de red no puede dejar la esquina en blanco
           en mitad de la transmisión. */
        return null;
    }
}


/* ===================================
   MONTAR

   Solo cuando la lista cambió. Reconstruir con los mismos logos
   reiniciaría la rotación y haría parpadear al que estuviera puesto.
=================================== */

function patrocinioPintar(datos){

    const marcas = datos.patrocinadores || [];
    const firma  = marcas.map(m => m.url).join("|") + "#" + (datos.logo || "");

    if (firma === paFirma) {
        // La lista es la misma; el ritmo sí puede haber cambiado.
        patrocinioRitmo(datos.segundos);
        return;
    }
    paFirma = firma;

    if (paLogo) paLogo.src = datos.logo || "";

    paRotacion.innerHTML = "";
    paMarcas = marcas.map(function(m){
        const hueco = document.createElement("div");
        hueco.className = "pa-marca";

        const img = document.createElement("img");
        img.src = m.url;
        img.alt = "";
        hueco.appendChild(img);

        paRotacion.appendChild(hueco);
        return hueco;
    });

    // Sin patrocinadores la caja es solo el logo, y la raya que los
    // separaría no tiene nada que separar.
    paCaja.classList.toggle("con-rotacion", paMarcas.length > 0);

    paIndice = 0;
    if (paMarcas.length) paMarcas[0].classList.add("activa");

    patrocinioRitmo(datos.segundos);
}


/* ===================================
   ROTAR

   Mover una clase, nada más. Con uno solo no se arranca el temporizador:
   estaría despertando cada seis segundos para apagar y encender la misma
   imagen.
=================================== */

function patrocinioGirar(){

    if (paMarcas.length < 2) return;

    paMarcas[paIndice].classList.remove("activa");
    paIndice = (paIndice + 1) % paMarcas.length;
    paMarcas[paIndice].classList.add("activa");
}


function patrocinioRitmo(segundos){

    const s = parseFloat(segundos);
    if (!isNaN(s) && s > 0) paSegundos = s;

    if (paGiro) { clearInterval(paGiro); paGiro = null; }
    if (paMarcas.length > 1) {
        paGiro = setInterval(patrocinioGirar, paSegundos * 1000);
    }
}


/* ===================================
   ENTRADA Y SALIDA
=================================== */

async function arrancarPatrocinio(opciones){

    const o = opciones || {};
    if (o.api) configurarPatrocinio(o.api);

    paCaja     = document.getElementById("patrocinio");
    paRotacion = document.getElementById("rotacion");
    paLogo     = document.getElementById("logo");

    const datos = await patrocinioPedir();
    if (datos) patrocinioPintar(datos);

    /* Se enseña después de tener los logos: entrando antes, la caja
       aparecería vacía y se llenaría a la vista de todos.

       Con un reflow forzado y no con requestAnimationFrame. La
       transición necesita que el navegador haya calculado el estado de
       partida antes de que cambie la clase, y leer offsetWidth lo
       obliga. rAF también servía, pero solo dispara si la página se
       está pintando: dentro de la vista previa, con el panel en una
       pestaña de fondo, no se llamaba nunca y la caja se quedaba
       fuera de pantalla para siempre. */
    void paCaja.offsetWidth;
    paCaja.classList.add("visible");

    if (paSondeo) clearInterval(paSondeo);
    paSondeo = setInterval(async function(){
        const nuevos = await patrocinioPedir();
        if (nuevos) patrocinioPintar(nuevos);
    }, PATROCINIO_CADA);
}


function detenerPatrocinio(){

    /* Los dos temporizadores se paran. Sin esto seguirían latiendo con
       el gráfico fuera de aire: el de la rotación moviendo clases en un
       DOM que nadie ve, y el del sondeo pidiéndole la lista al backend
       cada treinta segundos para siempre. */
    if (paGiro)   { clearInterval(paGiro);   paGiro = null; }
    if (paSondeo) { clearInterval(paSondeo); paSondeo = null; }

    if (paCaja) paCaja.classList.remove("visible");
}


function actualizarPatrocinio(data){

    /* Acepta {"segundos":4} y {"api":"http://otra-maquina:8080/api/v1"}.
       La lista no se manda desde el panel: la pide el gráfico. */
    try {
        const d = typeof data === "string" ? JSON.parse(data) : (data || {});

        if (d.api) {
            configurarPatrocinio(d.api);
            paFirma = "";   // otra máquina, otras URL: hay que repintar
        }

        if (d.segundos !== undefined) patrocinioRitmo(d.segundos);

        // Un refresco a mano, para no esperar al sondeo.
        if (d.refrescar) {
            patrocinioPedir().then(function(nuevos){
                if (nuevos) patrocinioPintar(nuevos);
            });
        }

    } catch (e) { /* un UPDATE con basura no puede tumbar el gráfico */ }
}
