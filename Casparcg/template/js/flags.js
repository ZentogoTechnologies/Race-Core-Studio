/* ==========================================================================
   BANDERAS - PLAY / STOP

   La bandera se despliega de izquierda a derecha desde el borde del logo.
   El logo del Autodromo Panama queda siempre fijo en su posicion.

   La animacion de entrada arranca sola al cargar (via CSS), asi que el
   template funciona igual con CG ADD ... 1 (play-on-load) que sin el.
========================================================================== */

function flagBoard(){

    return document.querySelector(".leaderboard");
}

function flagPanel(){

    return document.querySelector(
        ".lb-info-red, .lb-info-green, .lb-info-checkered, "
        + ".lb-info-yellow, .lb-info-white, .lb-info-blue, "
        + ".lb-info-black, .lb-info-meatball, .lb-info-slippery"
    );
}

function play(){

    const board = flagBoard();
    const panel = flagPanel();

    if(!board || !panel) return;

    board.classList.remove("flag-closing","flag-hidden");

    /* Reinicia la animacion de apertura */

    panel.style.animation = "none";

    void panel.offsetWidth;

    panel.style.animation = "";
}

function stop(){

    const board = flagBoard();

    if(!board) return;

    board.classList.add("flag-closing");

    setTimeout(() => {

        board.classList.add("flag-hidden");

    },400);
}

/* Las banderas no llevan datos, pero CasparCG llama update() igual. */

function update(data){
}
