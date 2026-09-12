"""El panel de servicios: lo que ve el cliente al abrir Race Core Studio.

Sustituye a la consola negra. Arranca todo solo, enseña en qué estado
está cada pieza y deja corregir a mano lo que haga falta.

Tres servicios, con el nombre que entiende quien lo usa:

    Base de datos          MongoDB, servicio de Windows
    Servidor de gráficos   CasparCG
    Race Core Studio       el backend, que sirve también el panel web

Backend y frontend van juntos en una sola fila a propósito: para el
cliente son lo mismo, se sirven del mismo puerto y no tiene sentido
pedirle que distinga dos cosas que nunca arrancan por separado.

La ventana se dibuja con tkinter, que viene con Python: un panel de
control no justifica arrastrar un kit gráfico entero dentro del .exe.
"""

import queue
import threading
import tkinter as tk
import webbrowser
from tkinter import font as tkfont

# ─── Colores, los de la marca ────────────────────────────────

FONDO      = "#0f0f10"
FONDO_CAB  = "#161617"
FONDO_PIE  = "#131314"
LINEA      = "#202022"
TEXTO      = "#f0f0f0"
TENUE      = "#7a7a7a"
ROJO       = "#d32027"
ROJO_OSC   = "#a4151b"
VERDE      = "#22c55e"
AMBAR      = "#eab308"
GRIS       = "#6b7280"

# Estado → (color del punto, rótulo)
ESTADOS = {
    "on":    (VERDE, "EN MARCHA"),
    "aire":  (VERDE, "AL AIRE"),
    "wait":  (AMBAR, "ARRANCANDO"),
    "off":   (GRIS,  "DETENIDO"),
    "espera": (GRIS, "EN ESPERA"),
    "error": (ROJO,  "NO RESPONDE"),
}


class Servicio:
    """Una fila. Sabe pintarse y poco más; quién arranca qué va fuera."""

    def __init__(self, padre, nombre, detalle, acciones):
        self.marco = tk.Frame(padre, bg=FONDO)
        self.marco.pack(fill="x")

        fila = tk.Frame(self.marco, bg=FONDO)
        fila.pack(fill="x", padx=22, pady=13)

        self.punto = tk.Canvas(fila, width=11, height=11, bg=FONDO,
                               highlightthickness=0)
        self._circulo = self.punto.create_oval(1, 1, 10, 10, fill=GRIS, outline="")
        self.punto.pack(side="left", padx=(0, 14))

        texto = tk.Frame(fila, bg=FONDO)
        texto.pack(side="left", fill="x", expand=True)
        tk.Label(texto, text=nombre, bg=FONDO, fg=TEXTO,
                 font=("Segoe UI", 10, "bold"), anchor="w").pack(fill="x")
        tk.Label(texto, text=detalle, bg=FONDO, fg=TENUE,
                 font=("Segoe UI", 8), anchor="w").pack(fill="x")

        self.rotulo = tk.Label(fila, text="", bg=FONDO, fg=TENUE,
                               font=("Segoe UI", 8, "bold"), width=13, anchor="e")
        self.rotulo.pack(side="left", padx=(0, 12))

        self.botones = {}
        caja = tk.Frame(fila, bg=FONDO)
        caja.pack(side="left")
        for etiqueta, accion in acciones:
            b = tk.Button(caja, text=etiqueta, command=accion,
                          bg="#1c1c1f", fg="#d0d0d0", activebackground="#2a2a2e",
                          activeforeground=TEXTO, relief="flat", bd=0,
                          font=("Segoe UI", 8), padx=11, pady=4, cursor="hand2")
            b.pack(side="left", padx=3)
            self.botones[etiqueta] = b

        tk.Frame(self.marco, bg=LINEA, height=1).pack(fill="x")

    def poner(self, estado: str) -> None:
        color, rotulo = ESTADOS.get(estado, ESTADOS["off"])
        self.punto.itemconfig(self._circulo, fill=color)
        self.rotulo.config(text=rotulo, fg=color if estado != "off" else TENUE)

    def mostrar_boton(self, etiqueta: str, visible: bool) -> None:
        b = self.botones.get(etiqueta)
        if b is None:
            return
        if visible:
            b.pack(side="left", padx=3)
        else:
            b.pack_forget()


class Panel:
    """La ventana. El trabajo de verdad ocurre en otro hilo.

    tkinter no es seguro desde varios hilos: arrancar CasparCG tarda
    segundos y hacerlo aquí congelaría la ventana. El hilo de trabajo
    deja recados en una cola y la ventana los recoge cada poco.
    """

    def __init__(self, version: str, mando):
        self.mando = mando           # quien sabe arrancar y detener
        self.recados = queue.Queue()
        self.raiz = tk.Tk()
        self.raiz.title("Race Core Studio")
        self.raiz.configure(bg=FONDO)
        self.raiz.geometry("560x430")
        self.raiz.resizable(False, False)

        self._cabecera(version)
        self._servicios()
        self._pie()

        self.raiz.after(250, self._recoger)

    # ── Partes ──

    def _cabecera(self, version: str) -> None:
        cab = tk.Frame(self.raiz, bg=FONDO_CAB, height=64)
        cab.pack(fill="x")
        cab.pack_propagate(False)

        titulo = tk.Frame(cab, bg=FONDO_CAB)
        titulo.pack(side="left", padx=22)
        tk.Label(titulo, text="RACE CORE STUDIO", bg=FONDO_CAB, fg=TEXTO,
                 font=("Segoe UI", 15, "bold")).pack(anchor="w")

        tk.Label(cab, text=f"v{version}", bg=FONDO_CAB, fg="#6a6a6a",
                 font=("Segoe UI", 8)).pack(side="right", padx=22)

        tk.Frame(self.raiz, bg=LINEA, height=1).pack(fill="x")

    def _servicios(self) -> None:
        caja = tk.Frame(self.raiz, bg=FONDO)
        caja.pack(fill="x")

        # La base de datos no lleva «Detener» a propósito: es un servicio
        # de Windows, puede estar sirviendo a otra cosa, y pararla con el
        # sistema al aire es un error difícil de deshacer.
        self.mongo = Servicio(caja, "Base de datos", "MongoDB · puerto 27017",
                              [("Arrancar", self.mando.arrancar_mongo)])
        self.caspar = Servicio(caja, "Servidor de gráficos", "CasparCG · puerto 5250",
                               [("Arrancar", self.mando.arrancar_caspar),
                                ("Detener", self.mando.detener_caspar)])
        self.rcs = Servicio(caja, "Race Core Studio", "Panel y API · puerto 8080",
                            [("Arrancar", self.mando.arrancar_rcs),
                             ("Detener", self.mando.detener_rcs)])

    def _pie(self) -> None:
        pie = tk.Frame(self.raiz, bg=FONDO_PIE)
        pie.pack(fill="both", expand=True)

        self.aviso = tk.Label(pie, text="", bg=FONDO_PIE, fg="#e8a8ac",
                              font=("Segoe UI", 8), wraplength=510, justify="left")

        self.abrir = tk.Button(pie, text="ABRIENDO…", command=self.mando.abrir_panel,
                               bg=ROJO, fg="#ffffff", activebackground=ROJO_OSC,
                               activeforeground="#ffffff", relief="flat", bd=0,
                               font=("Segoe UI", 11, "bold"), pady=10, cursor="hand2",
                               state="disabled", disabledforeground="#8a7072")
        self.abrir.pack(fill="x", padx=22, pady=(16, 10))

        abajo = tk.Frame(pie, bg=FONDO_PIE)
        abajo.pack(fill="x", padx=22)

        self.red = tk.Label(abajo, text="", bg=FONDO_PIE, fg=TENUE,
                            font=("Consolas", 8))
        self.red.pack(side="left")

        tk.Button(abajo, text="Ver error.log", command=self.mando.abrir_registro,
                  bg=FONDO_PIE, fg=TENUE, activebackground=FONDO_PIE,
                  activeforeground=TEXTO, relief="flat", bd=0,
                  font=("Segoe UI", 8, "underline"), cursor="hand2").pack(side="right")

    # ── Recados del hilo de trabajo ──

    def avisar(self, clave: str, valor) -> None:
        """Lo llama el hilo de trabajo. Seguro desde cualquier hilo."""
        self.recados.put((clave, valor))

    def _recoger(self) -> None:
        while True:
            try:
                clave, valor = self.recados.get_nowait()
            except queue.Empty:
                break
            self._aplicar(clave, valor)
        self.raiz.after(250, self._recoger)

    def _aplicar(self, clave: str, valor) -> None:
        filas = {"mongo": self.mongo, "caspar": self.caspar, "rcs": self.rcs}

        if clave in filas:
            fila = filas[clave]
            fila.poner(valor)
            arrancado = valor in ("on", "aire", "wait")
            fila.mostrar_boton("Arrancar", not arrancado)
            fila.mostrar_boton("Detener", arrancado)

        elif clave == "listo":
            self.abrir.config(text="ABRIR EL PANEL", state="normal")

        elif clave == "red":
            self.red.config(text=valor)

        elif clave == "aviso":
            if valor:
                self.aviso.pack(fill="x", padx=22, pady=(12, 0), before=self.abrir)
                self.aviso.config(text=valor)
            else:
                self.aviso.pack_forget()

        elif clave == "minimizar":
            self.raiz.iconify()

    # ── Arranque ──

    def correr(self) -> None:
        """Muestra la ventana y pone a trabajar al otro hilo."""
        hilo = threading.Thread(target=self.mando.arrancar_todo, daemon=True)
        hilo.start()
        self.raiz.mainloop()


def abrir_en_navegador(url: str) -> None:
    webbrowser.open(url)
