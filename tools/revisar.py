"""Comprobaciones baratas que atrapan fallos caros.

    python tools/revisar.py

Cada una está aquí porque un fallo concreto llegó a la máquina de un
cliente. No sustituyen a las pruebas: atrapan lo que las pruebas no ven
porque no llegan a importar nada.
"""

import ast
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def arranque_al_final(archivo: Path) -> list:
    """El `if __name__ == "__main__"` tiene que ser lo último.

    Si queda a mitad del archivo, todo lo definido debajo no existe aún
    cuando main() se ejecuta, y el programa muere con un NameError al
    arrancar —no al importar, ni al compilar: solo al ejecutarlo—.

    Pasó de verdad: se añadieron funciones al final con `>>` y quedaron
    detrás del bloque de arranque. Compilaba, importaba, empaquetaba, y
    reventaba en el equipo del cliente con «name ... is not defined».
    """
    arbol = ast.parse(archivo.read_text(encoding="utf-8"))
    cuerpo = [n for n in arbol.body
              if not isinstance(n, (ast.Import, ast.ImportFrom))]

    for i, nodo in enumerate(cuerpo):
        es_arranque = (
            isinstance(nodo, ast.If)
            and isinstance(nodo.test, ast.Compare)
            and isinstance(nodo.test.left, ast.Name)
            and nodo.test.left.id == "__name__"
        )
        if es_arranque and i != len(cuerpo) - 1:
            sobra = cuerpo[i + 1]
            nombre = getattr(sobra, "name", type(sobra).__name__)
            return [f"{archivo.relative_to(RAIZ)}:{nodo.lineno}: el bloque de "
                    f"arranque no es lo último; «{nombre}» (línea "
                    f"{sobra.lineno}) queda detrás y no existirá al "
                    f"ejecutar main()"]
    return []




def rutas_del_instalador(iss: Path, payload: Path) -> list:
    r"""Todo {app}\... que el instalador EJECUTA tiene que existir.

    El guion de Inno referencia archivos por su ruta, en texto. Nadie los
    comprueba: ni el compilador de Inno —que no sabe qué habrá en {app}
    cuando alguien instale— ni Python, que ni se entera de que existe ese
    archivo.

    Pasó de verdad: el backend se movió a su propia carpeta, se actualizó
    el flujo de compilación y el lanzador, y se olvidó el [Run] que lo
    ejecuta. El instalador copió los 250 MB, fue a configurar y murió con
    «CreateProcess falló; código 2».
    """
    import re

    if not payload.is_dir():
        return []

    texto = iss.read_text(encoding="utf-8-sig")
    problemas = []

    for linea in texto.splitlines():
        limpia = linea.strip()
        if not limpia.startswith("Filename:"):
            continue
        # Solo los que salen del paquete; {sys}\net.exe es de Windows.
        m = re.search(r'Filename:\s*"\{app\}\\([^"]+)"', limpia)
        if not m:
            continue

        relativa = m.group(1)
        # Las constantes del guion (#Ejecutable y demás) se resuelven
        # mirando su #define.
        for nombre, valor in re.findall(r'#define\s+(\w+)\s+"([^"]+)"', texto):
            relativa = relativa.replace("{#" + nombre + "}", valor)

        if "{#" in relativa:
            continue                      # constante que no se supo resolver

        if not (payload / relativa.replace("\\", "/")).exists():
            problemas.append(
                f"{iss.name}: el instalador ejecuta «{relativa}», "
                f"que no está en el paquete")

    return problemas


def almohadillas_sueltas(iss: Path) -> list:
    """Ninguna linea del guion de Inno puede empezar por #, salvo #define.

    El preprocesador de Inno toma cualquier linea que empiece por # como
    una directiva suya. Un salto de linea de Pascal partido —#13#10 al
    empezar la linea siguiente— le parece una directiva desconocida y
    aborta la compilacion entera:

        Error on line 286: Unknown preprocessor directive.
        Compile aborted.

    Solo se ve compilando en Windows, asi que sin esto la vuelta cuesta
    una compilacion de siete minutos.
    """
    problemas = []
    directivas = ("define", "include", "if", "ifdef", "ifndef", "else",
                  "elif", "endif", "error", "pragma", "expr", "insert",
                  "append", "emit", "file", "sub", "endsub", "for")

    for n, linea in enumerate(iss.read_text(encoding="utf-8-sig").splitlines(), 1):
        limpia = linea.lstrip()
        if not limpia.startswith("#"):
            continue
        palabra = limpia[1:].split()[0].lower() if limpia[1:].split() else ""
        if not palabra.startswith(directivas):
            problemas.append(
                f"{iss.name}:{n}: la linea empieza por «{limpia[:14]}» y el "
                f"preprocesador de Inno la tomara por una directiva. "
                f"Pon el #13#10 al final de la linea anterior")

    return problemas


def mensajes_en_los_dos_idiomas(iss: Path) -> list:
    """Cada {cm:Clave} definida y traducida en TODOS los idiomas.

    Inno no se queja de un mensaje que falta: lo sustituye por nada. Una
    clave definida solo en «es.» deja al cliente inglés un botón sin
    etiqueta, un aviso en blanco o una página de licencia sin título, y
    eso no se ve compilando —se ve instalando, y en el otro idioma—.

    Se comprueban las tres direcciones:

        · toda clave usada con {cm:...} está definida
        · toda clave definida lo está en todos los idiomas
        · el archivo de licencia de cada idioma existe

    Lo último por lo mismo: Inno aborta si falta, pero el error llega
    siete minutos después, en Windows.
    """
    problemas = []
    texto = iss.read_text(encoding="utf-8-sig")

    idiomas = re.findall(r'^\s*Name:\s*"([^"]+)"\s*;\s*MessagesFile',
                         texto, re.M)
    if len(idiomas) < 2:
        return []

    # Definidas, por idioma: «es.Clave=...» dentro de [CustomMessages].
    seccion = re.split(r"^\[", texto, flags=re.M)
    cuerpo = next((s for s in seccion if s.startswith("CustomMessages]")), "")
    definidas = {i: set() for i in idiomas}
    for linea in cuerpo.splitlines():
        m = re.match(r"\s*([A-Za-z]{2,5})\.([A-Za-z0-9_]+)\s*=", linea)
        if m and m.group(1) in definidas:
            definidas[m.group(1)].add(m.group(2))

    usadas = set(re.findall(r"\{cm:([A-Za-z0-9_]+)", texto))
    usadas |= set(re.findall(r"CustomMessage\(\s*'([A-Za-z0-9_]+)'", texto))

    todas = set().union(*definidas.values()) if definidas else set()

    for clave in sorted(usadas - todas):
        problemas.append(f"{iss.name}: se usa {{cm:{clave}}} y no está "
                         f"definida en [CustomMessages]")

    for idioma in idiomas:
        for clave in sorted(todas - definidas[idioma]):
            problemas.append(f"{iss.name}: «{clave}» no está traducida al "
                             f"idioma «{idioma}»; Inno la dejará vacía")

    for idioma, archivo in re.findall(
            r'^\s*Name:\s*"([^"]+)".*?LicenseFile:\s*"([^"]+)"', texto, re.M):
        if not (iss.parent / archivo).is_file():
            problemas.append(f"{iss.name}: el idioma «{idioma}» apunta a "
                             f"{archivo}, que no existe")

    return problemas


def main() -> int:
    problemas = []

    for archivo in (RAIZ / "launcher" / "race_core_studio.py",
                    RAIZ / "Backend" / "servidor.py",
                    RAIZ / "installer" / "setup.py",
                    RAIZ / "installer" / "instalar.py"):
        if archivo.is_file():
            problemas += arranque_al_final(archivo)

    iss = RAIZ / "installer" / "inno" / "race-core-studio.iss"
    if iss.is_file():
        problemas += rutas_del_instalador(iss, RAIZ / "payload")
        problemas += almohadillas_sueltas(iss)
        problemas += mensajes_en_los_dos_idiomas(iss)

    if problemas:
        for p in problemas:
            print(f"  {p}")
        return 1

    print("Revisión pasada.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
