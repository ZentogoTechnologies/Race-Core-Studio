/* ==========================================================================
   LA DIRECCION DE LAS IMAGENES

   El backend manda fotos y logos con su direccion entera —«http://127.0.0.1
   :8080/public/marcas/honda.png»— porque CasparCG abre la plantilla desde
   file://, donde una ruta relativa apuntaria a la raiz del disco.

   Servida por HTTP, esa direccion es la equivocada por lo mismo que lo era
   la del API: desde otra maquina o a traves del tunel, 127.0.0.1 es el
   ordenador de quien mira. Las imagenes no cargaban y el grafico salia con
   los huecos de las marcas vacios.

   Se reescribe por el camino —/public/ y /media/, que son los dos montajes
   del backend— y no por host, para que siga valiendo si algun dia se
   cambia PUBLIC_BASE_URL.
========================================================================== */

var _RUTA_SERVIDA = /^https?:\/\/[^/]+(\/(?:public|media)\/.*)$/;

function reorientar(valor){

    /* Dentro de CasparCG no se toca nada: ahi la direccion entera es la
       unica que funciona. */
    if (location.protocol === "file:") return valor;

    if (typeof valor === "string") {
        var m = valor.match(_RUTA_SERVIDA);
        return m ? location.origin + m[1] : valor;
    }
    if (Array.isArray(valor)) return valor.map(reorientar);
    if (valor && typeof valor === "object") {
        var salida = {};
        for (var k in valor) salida[k] = reorientar(valor[k]);
        return salida;
    }
    return valor;
}

