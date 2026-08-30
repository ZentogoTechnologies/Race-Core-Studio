/* ==========================================================================
   TORRE DE CLASIFICACIÓN

   Los cuatro tótems —nombre completo, nombre corto, al líder e intervalo—
   son la misma torre con distinta configuración. Antes cada uno llevaba su
   copia del mismo código, y por eso el rediseño se quedó a medias: se hizo
   en el de nombre completo y los otros tres siguieron con el diseño viejo.

   Aquí vive todo lo común. Cada plantilla solo declara en qué se diferencia:

       arrancarTorre({
           columna: "leader",       // qué diferencia se muestra, si alguna
           etiqueta: "LÍDER",       // qué pone en la fila del primero
           marca: false,            // logo de la marca del carro
           dorsalIzquierda: true,   // el dorsal ocupa el sitio del logo
           retraso: 0,              // segundos de nombre completo; 0 = corto
       });

   Depende de timing.js, que es quien consulta al backend.
========================================================================== */


/* Las banderas de MyLaps al color de la banda superior. */
const TORRE_BANDERAS = {
    red:        { clase: "roja",     texto: "BANDERA ROJA · SESIÓN DETENIDA" },
    yellow:     { clase: "amarilla", texto: "BANDERA AMARILLA" },
    green:      { clase: "verde",    texto: "PISTA VERDE" },
    white:      { clase: "blanca",   texto: "ÚLTIMA VUELTA" },
    checkered:  { clase: "cuadros",  texto: "BANDERA A CUADROS" },
    finish:     { clase: "cuadros",  texto: "FIN DE CARRERA" },
};


let torreConfig = {
    limite: 20,
    retraso: 6,
    columna: null,
    etiqueta: "",
    marca: true,
    dorsalIzquierda: false,
};

let torreCuerpo = null;
let torreElemento = null;
let torreTemporizador = null;
let torreFirma = null;


function torreEscapar(texto){

    /* Los nombres salen de la base y del XML de MyLaps. Un apellido con un
       & o un < rompería el innerHTML de la fila. */

    return String(texto == null ? "" : texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}


function torreLetra(caracter, fuera){

    /* Cada letra va en su propia caja para poder quitarle el ancho sin
       tocar a las demás: al encogerse, las que quedan se corren solas
       hacia la izquierda. */

    return `<span class="tf-ch${fuera ? " tf-fuera" : ""}">${torreEscapar(caracter)}</span>`;
}


function torreNombre(piloto){

    /* ENRIQUE NORIEGA -> E. NOR

       Se conservan la inicial del nombre, un punto que aparece al abreviar,
       el espacio y las tres primeras letras del apellido. El resto se marca
       para desaparecer.

       Se usan `name` y `last_name` por separado y no `full_name`: partir la
       cadena entera fallaría con apellidos compuestos como DE GRACIA, donde
       el espacio del medio no separa nombre de apellido. */

    const nombre   = String(piloto.name || "").toUpperCase();
    const apellido = String(piloto.last_name || "").toUpperCase();

    /* Sin apellido no hay nada que abreviar: se deja el texto tal cual. */
    if (!apellido) {
        return [...(piloto.full_name || "")].map(c => torreLetra(c, false)).join("");
    }

    let html = "";

    /* Inicial del nombre, y detrás el punto oculto. */
    if (nombre) {
        html += torreLetra(nombre[0], false);
        html += `<span class="tf-ch tf-punto">.</span>`;
        html += [...nombre.slice(1)].map(c => torreLetra(c, true)).join("");
    }

    html += torreLetra(" ", false);

    /* Tres primeras del apellido, igual que el abbr_name del backend, para
       que todos los tótems digan exactamente lo mismo. */
    html += [...apellido.slice(0, 3)].map(c => torreLetra(c, false)).join("");
    html += [...apellido.slice(3)].map(c => torreLetra(c, true)).join("");

    return html;
}


function torreProgramarCorto(){

    /* Se reprograma en cada repintado: si entra un piloto nuevo mientras
       corre la cuenta, la animación no se dispara a medias. */

    clearTimeout(torreTemporizador);

    if (torreConfig.retraso <= 0) {
        torreElemento.classList.add("corto");
        return;
    }

    torreElemento.classList.remove("corto");

    torreTemporizador = setTimeout(() => {
        torreElemento.classList.add("corto");
    }, torreConfig.retraso * 1000);
}


function torreDiferencia(piloto, indice){

    /* El primero no tiene contra quién medirse: en su fila la columna dice
       de qué diferencia se está hablando. */

    if (indice === 0) return torreConfig.etiqueta;

    return piloto[torreConfig.columna] || "";
}


function torrePintarFilas(standings){

    /* Se redibuja solo si cambió algo. Repintar diez veces por segundo hace
       parpadear los logos, que son peticiones al backend. */

    const campos = ["position", "full_name", "number", "is_best_lap"];
    if (torreConfig.marca)   campos.push("brand_logo");
    if (torreConfig.columna) campos.push(torreConfig.columna);

    const firma = timingFirma(standings, campos);
    if (firma === torreFirma) return;
    torreFirma = firma;

    torreCuerpo.innerHTML = "";

    standings.forEach((piloto, index) => {

        const fila = document.createElement("div");

        const clases = ["tf-fila"];
        if (index === 0) clases.push("lider");
        /* El backend marca quién tiene la vuelta rápida comparando el
           dorsal de la cabecera del XML con el de cada fila. */
        if (piloto.is_best_lap) clases.push("vuelta-rapida");

        fila.className = clases.join(" ");

        let columnas = `
            <div class="tf-pos">${torreEscapar(piloto.position)}</div>
            <div class="tf-barra"></div>
        `;

        if (torreConfig.marca) {
            /* Sin logo se deja el hueco vacío en vez de un roto: la columna
               tiene que seguir alineada aunque falte una marca. */
            const logo = piloto.brand_logo
                ? `<img src="${torreEscapar(piloto.brand_logo)}" alt="${torreEscapar(piloto.brand || "")}">`
                : "";
            columnas += `<div class="tf-marca">${logo}</div>`;
        }

        if (torreConfig.dorsalIzquierda) {
            columnas += `<div class="tf-dorsal izquierda">${torreEscapar(piloto.number)}</div>`;
        }

        columnas += `<div class="tf-nombre">${torreNombre(piloto)}</div>`;

        if (!torreConfig.dorsalIzquierda) {
            columnas += `<div class="tf-dorsal">${torreEscapar(piloto.number)}</div>`;
        }

        if (torreConfig.columna) {
            columnas += `<div class="tf-dif">${torreEscapar(torreDiferencia(piloto, index))}</div>`;
        }

        fila.innerHTML = columnas;

        torreCuerpo.appendChild(fila);
    });

    /* Las letras nacen enteras y se encogen después; si se pintaran ya
       encogidas no habría animación que ver. */
    torreProgramarCorto();
}


function torrePintarCabecera(datos){

    const poner = (id, texto) => {
        const el = document.getElementById(id);
        if (el) el.textContent = texto;
    };

    poner("grupo", datos.group_name || datos.group || "");
    poner("heat", datos.heat || datos.run_name || "");

    /* El backend decide si manda el reloj de carrera o la cuenta atrás, y
       manda también la etiqueta que corresponde. */
    poner("relojEtiqueta", datos.time_label || "TIME");
    poner("reloj", datos.time || "0:00");

    /* Banda de estado: solo cuando hay bandera. */
    const estado = document.getElementById("estado");
    const bandera = TORRE_BANDERAS[(datos.flag || "none").toLowerCase()];

    if (estado && bandera) {
        estado.className = "tf-estado " + bandera.clase;
        estado.textContent = bandera.texto;
        torreElemento.classList.add("con-estado");
    } else {
        torreElemento.classList.remove("con-estado");
    }
}


function torrePintar(datos){

    if (!datos) return;

    torrePintarCabecera(datos);
    torrePintarFilas(datos.standings || []);
}


/* ─── Lo que usan las plantillas ─────────────────────────────── */

function arrancarTorre(opciones){

    torreConfig = Object.assign({}, torreConfig, opciones || {});

    torreCuerpo   = document.getElementById("cuerpo");
    torreElemento = document.getElementById("torre");

    /* Sin logo la fila cambia de reparto, y eso lo decide el CSS. */
    if (!torreConfig.marca) torreElemento.classList.add("sin-marca");

    arrancarTiming({ limite: torreConfig.limite, alRecibir: torrePintar });
}


function detenerTorre(){

    clearTimeout(torreTemporizador);
    detenerTiming();
}


function actualizarTorre(data){

    /* Acepta {"limite":15}, {"retraso":10}, {"modo":"corto"|"completo"} y
       {"api":"http://otra-maquina:8080/api/v1"} */

    try {
        const d = typeof data === "string" ? JSON.parse(data) : (data || {});

        if (d.api) configurarTiming(d.api);

        if (d.retraso !== undefined) {
            torreConfig.retraso = parseInt(d.retraso, 10);
            torreProgramarCorto();
        }

        if (d.modo === "corto") {
            clearTimeout(torreTemporizador);
            torreElemento.classList.add("corto");
        } else if (d.modo === "completo") {
            clearTimeout(torreTemporizador);
            torreElemento.classList.remove("corto");
        }

        if (d.limite) {
            torreConfig.limite = parseInt(d.limite, 10) || torreConfig.limite;
            torreFirma = null;          // fuerza el repintado
            arrancarTiming({ limite: torreConfig.limite, alRecibir: torrePintar });
        }
    } catch (e) {
        /* Un UPDATE con basura no puede tumbar el gráfico al aire. */
    }
}
