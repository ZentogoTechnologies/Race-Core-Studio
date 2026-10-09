/* ==========================================================================
   BARRA INFERIOR

   La clasificación de la tanda desfilando de derecha a izquierda, en
   bucle y sin pausas.

   Dos ideas sostienen todo lo de aquí abajo:

   El desplazamiento lo lleva una animación del navegador —la Web
   Animations API— y no un bucle de requestAnimationFrame. Se probó con
   rAF y no servía: en un lienzo que no se está componiendo en pantalla
   no llega ni un cuadro, y la cinta se quedaba congelada con los datos
   actualizándose por detrás. Una animación la compone el motor por su
   cuenta, igual que las transiciones del tótem, que sí funcionan al
   aire.

   Y la lista va escrita varias veces seguidas. Cuando la primera copia
   termina de salir por la izquierda, la siguiente ya ocupa su sitio, así
   que la animación solo tiene que recorrer el ancho de una copia y
   volver a empezar: la costura cae justo donde las dos encajan y no se
   ve. Al llegar datos nuevos se rehace la cinta pero se le devuelve el
   punto en que iba, para que no pegue un salto al principio cada pocos
   segundos.
========================================================================== */


let barraConfig = {
    /* Cuántas posiciones entran en la cinta. Alto porque aquí caben: no
       es una torre de diez, es una vuelta completa a la clasificación. */
    limite: 30,

    /* Píxeles por segundo. 90 deja leer cómodo un nombre al pasar; más
       rápido cansa y más lento aburre. */
    velocidad: 90,

    /* Cada cuanto se le pregunta al backend. Tres segundos y no medio
       como el totem: una fila tarda mas de un minuto en cruzar la
       pantalla, asi que afinar su tiempo diez veces mientras viaja no se
       nota al aire y si se nota en lo que trabaja el reproductor. */
    cada: 3000,

    /* Una sola clase de la tanda, o null para todas. El backend filtra y
       renumera; aquí solo se le pide. */
    clase: null,

    /* Qué tiempo se enseña: "best" la mejor vuelta, "last" la última,
       "leader" la diferencia contra el primero. */
    tiempo: "best",

    marca: true,
};

let barraElemento = null;
let barraVentana  = null;
let barraCinta    = null;
let barraGrupo    = null;
let barraCabecera = { grupo: null, heat: null };

let barraAnchoCopia = 0;
let barraCopias = 2;
let barraAnimacion = null;

/* Dos firmas y no una. La de estructura dice quien corre y en que orden;
   la de contenido, sus tiempos. Los tiempos cambian cada pocos segundos
   y el orden casi nunca, asi que separarlas permite rehacer la cinta
   solo cuando de verdad cambia la parrilla y limitarse a reescribir
   numeros el resto del tiempo. */
let barraFirmaEstructura = null;
let barraFirmaContenido = null;


/* ─── Utilidades ─────────────────────────────────────────────── */

function barraEscapar(texto){
    return String(texto === undefined || texto === null ? "" : texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}


function barraNombre(piloto){
    const completo = [piloto.name, piloto.last_name]
        .filter(Boolean).join(" ").trim();

    return completo || piloto.full_name || "";
}


function barraTiempo(piloto){
    if (barraConfig.tiempo === "last")   return piloto.last_time || "--";
    if (barraConfig.tiempo === "leader") return piloto.leader || "";
    return piloto.best_time || "--";
}


/* ─── Pintado ────────────────────────────────────────────────── */

function barraFila(piloto){
    const clases = ["bi-piloto"];
    if (piloto.position === 1) clases.push("lider");
    if (piloto.is_best_lap)    clases.push("rapida");

    let html = `<div class="${clases.join(" ")}">`;
    html += `<span class="bi-pos">${barraEscapar(piloto.position)}</span>`;

    if (barraConfig.marca && piloto.brand_logo) {
        html += `<span class="bi-marca">`
              + `<img src="${barraEscapar(piloto.brand_logo)}" alt="">`
              + `</span>`;
    }

    if (piloto.number) {
        html += `<span class="bi-dorsal">${barraEscapar(piloto.number)}</span>`;
    }

    html += `<span class="bi-nombre">${barraEscapar(barraNombre(piloto))}</span>`;

    const tiempo = barraTiempo(piloto);
    if (tiempo) {
        html += `<span class="bi-tiempo">${barraEscapar(tiempo)}</span>`;
    }

    return html + `</div>`;
}


function barraPintarFilas(standings){
    const filas = (standings || []).slice(0, barraConfig.limite);

    if (!filas.length) {
        barraPararAnimacion();
        barraCinta.innerHTML = `<div class="bi-vacio">`
                             + `${T("barra.sin_datos", "Esperando cronometraje")}</div>`;
        barraAnchoCopia = 0;
        barraCinta.style.transform = "translateX(0)";
        return;
    }

    const grupo = `<div class="bi-grupo-filas">`
                + filas.map(barraFila).join("")
                + `</div>`;

    /* Dónde iba la cinta, para devolverla ahí después de rehacerla. Si no,
       cada vez que cambia un tiempo —y cambian cada pocos segundos— la
       cinta pegaría un salto al principio. */
    const ibaPor = barraAnimacion ? barraAnimacion.currentTime : 0;

    /* Una primera copia para medirla. Cuántas hacen falta de verdad no se
       sabe hasta saber lo que ocupa una. */
    barraCinta.innerHTML = grupo;
    const unaCopia = barraCinta.querySelector(".bi-grupo-filas").offsetWidth;

    /* Con pocos pilotos una copia no llena la pantalla y entre el final de
       una y el principio de la siguiente quedaría un hueco negro. Se
       repiten las que hagan falta para que siempre haya cinta de sobra a
       la derecha. */
    const ancho = barraVentana ? barraVentana.offsetWidth : 1920;
    barraCopias = unaCopia > 0
        ? Math.max(2, Math.ceil(ancho / unaCopia) + 1)
        : 2;

    barraCinta.innerHTML = grupo.repeat(barraCopias);
    barraGrupo = barraCinta.querySelector(".bi-grupo-filas");
    barraAnchoCopia = unaCopia;

    barraArrancarMovimiento(ibaPor);
    barraRemedirConLogos();
}


/* Un logo que llega tarde ensancha la copia y descuadra el bucle: la
   animación recorrería menos de lo que mide y se vería el salto. Se
   vuelve a medir cuando terminan de cargar. */
function barraRemedirConLogos(){
    const imagenes = barraCinta.querySelectorAll("img");
    let pendientes = 0;

    imagenes.forEach(function (img){
        if (img.complete) return;
        pendientes++;
        img.addEventListener("load", alCargar, { once: true });
        img.addEventListener("error", alCargar, { once: true });
    });

    function alCargar(){
        pendientes--;
        if (pendientes > 0 || !barraGrupo) return;

        const ahora = barraGrupo.offsetWidth;
        if (ahora && Math.abs(ahora - barraAnchoCopia) > 1) {
            barraAnchoCopia = ahora;
            barraArrancarMovimiento(barraAnimacion ? barraAnimacion.currentTime : 0);
        }
    }
}


function barraPintarCabecera(datos){
    if (barraCabecera.grupo) {
        barraCabecera.grupo.textContent = datos.group_name || datos.group || "";
    }
    if (barraCabecera.heat) {
        barraCabecera.heat.textContent = datos.heat || datos.run_name || "";
    }
}


function barraPintar(datos){
    if (!datos) return;

    barraPintarCabecera(datos);

    const standings = (datos.standings || []).slice(0, barraConfig.limite);

    /* Quien corre y en que orden. Mientras esto no cambie, la cinta de
       veinte mil pixeles se queda donde esta y solo se le reescriben los
       tiempos: rehacerla entera dos veces por segundo durante una
       carrera de una hora son miles de reconstrucciones, y eso es lo que
       acaba ahogando al reproductor de CasparCG. */
    const estructura = timingFirma(standings,
        ["position", "number", "name", "last_name", "brand_logo"]);

    const contenido = timingFirma(standings,
        ["best_time", "last_time", "leader", "is_best_lap"]);

    if (estructura !== barraFirmaEstructura) {
        barraFirmaEstructura = estructura;
        barraFirmaContenido = contenido;
        barraPintarFilas(standings);
        return;
    }

    if (contenido !== barraFirmaContenido) {
        barraFirmaContenido = contenido;
        barraRefrescarTiempos(standings);
    }
}


/**
 * Reescribe solo lo que cambia: el tiempo de cada fila y si tiene la
 * vuelta rapida.
 *
 * Toca todas las copias de la cinta, porque la misma fila aparece una
 * vez en cada una y si se actualizara solo la primera, al dar la vuelta
 * el bucle enseñaria tiempos viejos.
 *
 * No toca el ancho ni el orden, asi que la animacion sigue corriendo sin
 * enterarse.
 */
function barraRefrescarTiempos(standings){
    const copias = barraCinta.querySelectorAll(".bi-grupo-filas");

    copias.forEach(function (copia){
        const filas = copia.querySelectorAll(".bi-piloto");

        standings.forEach(function (piloto, i){
            const fila = filas[i];
            if (!fila) return;

            const celda = fila.querySelector(".bi-tiempo");
            const texto = barraTiempo(piloto);

            if (celda && celda.textContent !== texto) celda.textContent = texto;

            fila.classList.toggle("rapida", Boolean(piloto.is_best_lap));
        });
    });
}


/* ─── El movimiento ──────────────────────────────────────────── */

/**
 * Pone a desfilar la cinta.
 *
 * Recorre exactamente el ancho de una copia y vuelve a empezar. Como la
 * copia siguiente está pegada detrás y es idéntica, al reiniciarse la
 * imagen es la misma y la vuelta no se ve.
 *
 * `desde` son los milisegundos de animación que ya llevaba, para
 * retomarla donde iba después de rehacer la cinta.
 */
function barraArrancarMovimiento(desde){
    barraPararAnimacion();

    if (!barraCinta || barraAnchoCopia <= 0) return;

    const duracion = (barraAnchoCopia / barraConfig.velocidad) * 1000;

    barraAnimacion = barraCinta.animate(
        [
            { transform: "translateX(0px)" },
            { transform: "translateX(" + (-barraAnchoCopia) + "px)" },
        ],
        { duration: duracion, iterations: Infinity, easing: "linear" }
    );

    /* Se retoma por donde iba, dando la vuelta si la duración nueva es
       más corta que lo que llevaba recorrido. */
    if (desde) barraAnimacion.currentTime = desde % duracion;
}


function barraPararAnimacion(){
    if (barraAnimacion) {
        barraAnimacion.cancel();
        barraAnimacion = null;
    }
}


/* ─── Lo que usan las plantillas ─────────────────────────────── */

function arrancarBarra(opciones){

    barraConfig = Object.assign({}, barraConfig, opciones || {});

    barraElemento = document.getElementById("barra");
    barraVentana  = document.getElementById("ventana");
    barraCinta    = document.getElementById("cinta");

    barraCabecera.grupo = document.getElementById("grupo");
    barraCabecera.heat  = document.getElementById("heat");

    arrancarTiming({
        limite: barraConfig.limite,
        clase: barraConfig.clase,
        cada: barraConfig.cada,
        alRecibir: barraPintar,
    });

    /* Un cuadro de margen antes de subirla: si se añade la clase en el
       mismo turno en que se pinta, el navegador no llega a ver el estado
       de partida y la barra aparece de golpe en vez de deslizarse. */
    requestAnimationFrame(function (){
        requestAnimationFrame(function (){
            barraElemento.classList.add("visible");
        });
    });
}


function detenerBarra(){
    barraPararAnimacion();
    detenerTiming();

    if (barraElemento) barraElemento.classList.remove("visible");
}


function actualizarBarra(data){

    /* Acepta {"clase":"STREET LEGAL B"}, {"velocidad":120},
       {"limite":20}, {"tiempo":"last"|"best"|"leader"} y
       {"api":"http://otra-maquina:8080/api/v1"} */

    try {
        const d = typeof data === "string" ? JSON.parse(data) : (data || {});

        if (d.api) configurarTiming(d.api);

        if (d.velocidad !== undefined) {
            const v = parseFloat(d.velocidad);
            if (!isNaN(v) && v > 0) {
                barraConfig.velocidad = v;
                /* Sin el punto de partida: cambiar de velocidad es una
                   decisión de quien opera y que la cinta vuelva al
                   principio no molesta. */
                barraArrancarMovimiento(0);
            }
        }

        if (d.tiempo !== undefined) {
            barraConfig.tiempo = d.tiempo || "best";
            barraFirmaEstructura = null;
            barraPintar(timingUltimo());
        }

        if (d.marca !== undefined) {
            barraConfig.marca = Boolean(d.marca);
            barraFirmaEstructura = null;
            barraPintar(timingUltimo());
        }

        /* Clase y límite obligan a volver a preguntarle al backend: es el
           que filtra y renumera. */
        if (d.clase !== undefined || d.limite !== undefined) {
            if (d.clase !== undefined)  barraConfig.clase = d.clase || null;
            if (d.limite !== undefined) {
                barraConfig.limite = parseInt(d.limite, 10) || barraConfig.limite;
            }

            barraFirmaEstructura = null;
            arrancarTiming({
                limite: barraConfig.limite,
                clase: barraConfig.clase,
                cada: barraConfig.cada,
                alRecibir: barraPintar,
            });
        }
    } catch (e) {
        /* Un UPDATE con basura no puede tumbar el gráfico al aire. */
    }
}
