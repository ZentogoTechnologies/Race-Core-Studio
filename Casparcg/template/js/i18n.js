/* ==========================================================================
   TEXTOS DE LOS GRAFICOS

   Los rotulos fijos del arte —"Mejor", "CATEGORIA", "Starting Grid"— salen
   de aqui y no escritos a mano en cada plantilla.

   Las traducciones viven en i18n/*.json, que es lo que se edita. Pero
   CasparCG abre las plantillas con file://, y ahi fetch() de un JSON esta
   bloqueado por CORS: no hay forma de leerlo desde la propia plantilla.
   Asi que el backend vuelca el idioma elegido en idioma_activo.js, que si
   se puede cargar con un <script src>, igual que hace con el CSS de la
   tipografia.

   Si ese archivo no existiera todavia, T() devuelve el respaldo que se le
   pase, que siempre es el texto en español. Un grafico al aire nunca se
   queda con un hueco por culpa del idioma.
========================================================================== */

function T(clave, porDefecto){

    const textos = (typeof window !== "undefined" && window.TEXTOS) || null;
    if (!textos) return porDefecto;

    let valor = textos;
    for (const parte of String(clave).split(".")) {
        if (valor == null || typeof valor !== "object") return porDefecto;
        valor = valor[parte];
    }

    return (typeof valor === "string" && valor) ? valor : porDefecto;
}


/* Escribe en el documento los rotulos marcados con data-t="clave". Se
   llama al cargar y ahorra tener que tocar cada plantilla con JavaScript
   propio: el texto del HTML queda como respaldo visible. */
function traducirDocumento(raiz){

    (raiz || document).querySelectorAll("[data-t]").forEach(el => {
        el.textContent = T(el.getAttribute("data-t"), el.textContent);
    });
}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => traducirDocumento());
}
