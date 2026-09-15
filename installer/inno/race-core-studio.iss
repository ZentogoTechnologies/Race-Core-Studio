; ─────────────────────────────────────────────────────────────
;  Race Core Studio — instalador de Windows
;
;  Se compila con Inno Setup 6:   ISCC.exe race-core-studio.iss
;
;  Este script NO compila nada del producto: da por hecho que en
;  ..\payload\ está todo ya construido —backend congelado, panel,
;  lanzador, CasparCG y MongoDB—. Compilar en la máquina del cliente
;  es lo que hacía el instalador viejo, y de ahí salieron la mitad de
;  los fallos: versiones de Python, rutas, PATH, antivirus.
;
;  ⚠ Sin verificar todavía en Windows. Se escribe aquí para fijar las
;    decisiones; hasta que exista el payload no hay nada que compilar.
; ─────────────────────────────────────────────────────────────

#define Nombre        "Race Core Studio"
#define Empresa       "Zentogo Technologies"
#define Version       "1.0.0"
#define Ejecutable    "race-core-studio.exe"
#define Desinstalador "uninstaller.exe"
#define Servicio      "RaceCoreStudioDB"

; Fijo y para siempre: es lo que permite que la próxima versión se
; reconozca como actualización y no como un segundo programa.
#define AppId         "{{8F3A6C41-5D2E-4B79-9A1C-7E0D4F82B653}"

[Setup]
AppId={#AppId}
AppName={#Nombre}
AppVersion={#Version}
AppVerName={#Nombre} {#Version}
AppPublisher={#Empresa}
VersionInfoVersion={#Version}

DefaultDirName={autopf}\{#Nombre}
DefaultGroupName={#Nombre}
DisableProgramGroupPage=yes
OutputBaseFilename=rcs-setup
OutputDir=..\..\dist

; Hace falta para registrar MongoDB como servicio y abrir el puerto.
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible

WizardStyle=modern
WizardSizePercent=120
SetupIconFile=..\..\launcher\race-core-studio.ico
WizardImageFile=marca-lateral.bmp
WizardSmallImageFile=marca-cabecera.bmp

; El idioma, lo primero de todo. Ver la nota de [Languages].
ShowLanguageDialog=yes

; Lo que se ve en «Agregar o quitar programas».
UninstallDisplayName={#Nombre} {#Version}
UninstallDisplayIcon={app}\{#Ejecutable}

; Sin comprimir dos veces: CasparCG y MongoDB ya vienen comprimidos y
; volver a pasarles LZMA solo alarga la compilación sin ganar tamaño.
Compression=lzma2/max
SolidCompression=yes

[Languages]
; Dos idiomas, asi que Inno enseña su dialogo de seleccion antes que
; nada. ShowLanguageDialog=yes y no «auto»: auto lo salta cuando el
; idioma de Windows coincide con uno de los de la lista, y entonces un
; equipo en español nunca llegaria a ver la pregunta.
;
; Los nombres —es, en— son los mismos que usa el producto para su
; idioma, asi que lo que se elige aqui se pasa tal cual al backend.
;
; Cada uno con su contrato: Inno no traduce el texto de la licencia, y
; enseñarla en español a quien eligio ingles es enseñarle algo que no
; puede leer antes de pedirle que lo acepte.
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"; LicenseFile: "licencia-de-uso.txt"
Name: "en"; MessagesFile: "compiler:Default.isl";            LicenseFile: "licencia-de-uso-en.txt"

[CustomMessages]
; Todo el texto propio del instalador, en los dos idiomas. Lo que viene
; de Inno —botones, «Siguiente», la pagina de la carpeta— lo traducen
; sus .isl; esto es solo lo nuestro.
;
; Con acentos: este archivo lleva marca BOM al principio, asi que Inno 6
; lo lee como UTF-8 y llegan bien a la pantalla. Sin la marca lo leeria
; como ANSI y «configuración» saldria como «configuraciÃ³n».
; %n es salto de linea; %1 lo rellena FmtMessage.

es.TareaEscritorio=Crear acceso directo en el escritorio
en.TareaEscritorio=Create a desktop shortcut

es.GrupoAccesos=Accesos:
en.GrupoAccesos=Shortcuts:

es.PasoRegistrarDB=Registrando la base de datos...
en.PasoRegistrarDB=Registering the database...

es.PasoArrancarDB=Arrancando la base de datos...
en.PasoArrancarDB=Starting the database...

es.PasoLicencia=Comprobando la licencia...
en.PasoLicencia=Checking the licence...

es.AbrirAsistente=Abrir el asistente de configuración
en.AbrirAsistente=Open the setup wizard

; ── La pagina de la licencia ──
es.LicenciaTitulo=Licencia del producto
en.LicenciaTitulo=Product licence

es.LicenciaCabecera=Introduzca los datos que recibió de Zentogo Technologies.
en.LicenciaCabecera=Enter the details you received from Zentogo Technologies.

es.LicenciaNota=La licencia se comprueba antes de copiar nada, y quedará asociada a este equipo.
en.LicenciaNota=The licence is checked before anything is copied, and will be tied to this computer.

es.LicenciaCorreo=Correo de la licencia:
en.LicenciaCorreo=Licence e-mail:

es.LicenciaClave=Clave del producto:
en.LicenciaClave=Product key:

es.LicenciaFaltan=Hacen falta el correo y la clave de la licencia.
en.LicenciaFaltan=Both the licence e-mail and the product key are required.

es.LicenciaForma=La clave empieza por RCS1- y lleva cinco bloques.%nEjemplo:  RCS1-XXXX-XXXX-XXXX-XXXX
en.LicenciaForma=The key starts with RCS1- and has five blocks.%nExample:  RCS1-XXXX-XXXX-XXXX-XXXX

; ── CasparCG ──
es.CasparComprobando=Comprobando el servidor de gráficos...
en.CasparComprobando=Checking the graphics server...

es.CasparNoSePudo=No se pudo comprobar el servidor de gráficos.%n%nLa instalación termina igual. Si al abrir Race Core Studio el servidor de gráficos no arranca, avise a soporte.
en.CasparNoSePudo=The graphics server could not be checked.%n%nSetup will finish anyway. If the graphics server does not start when you open Race Core Studio, please contact support.

es.CasparNoArranco=El servidor de gráficos (CasparCG) no arrancó en este equipo.%n%nLa instalación termina igual y el panel funcionará con normalidad, pero no saldrá ningún gráfico al aire hasta resolverlo.%n%nSuele ser la tarjeta de vídeo o sus controladores. El detalle está en el registro, que se abre desde el propio programa.
en.CasparNoArranco=The graphics server (CasparCG) did not start on this computer.%n%nSetup will finish anyway and the control panel will work normally, but no graphics will go on air until this is resolved.%n%nThis is usually the video card or its drivers. The details are in the log, which opens from within the program.

es.CasparAbierto=El servidor de gráficos funciona correctamente.%n%nNo se pudo cerrar solo, así que quedó una ventana abierta (CasparCG). Ciérrela a mano antes de continuar.
en.CasparAbierto=The graphics server works correctly.%n%nIt could not close itself, so a window was left open (CasparCG). Please close it by hand before continuing.

; ── Al desinstalar ──
es.DesinstalarDatos=Se va a quitar Race Core Studio de este equipo.%n%nLos datos del autódromo —pilotos, vehículos, categorías, históricos de carreras, logos y configuración— están en:%n%n%1%n%n¿Desea CONSERVARLOS?%n%nSí = se conservan (recomendado).%nNo = se borran. Se hará una copia en el Escritorio antes.
en.DesinstalarDatos=Race Core Studio is about to be removed from this computer.%n%nThe circuit's data --drivers, vehicles, categories, race history, logos and settings-- is in:%n%n%1%n%nDo you want to KEEP it?%n%nYes = keep it (recommended).%nNo = delete it. A copy will be made on the Desktop first.

; ── Nombre del servicio de MongoDB, que se ve en Servicios de Windows ──
es.ServicioDB=Race Core Studio — Base de datos
en.ServicioDB=Race Core Studio - Database

[Files]
Source: "..\..\payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#Nombre}";           Filename: "{app}\{#Ejecutable}"
Name: "{autodesktop}\{#Nombre}";     Filename: "{app}\{#Ejecutable}"; Tasks: escritorio

[Tasks]
Name: "escritorio"; Description: "{cm:TareaEscritorio}"; GroupDescription: "{cm:GrupoAccesos}"

[InstallDelete]
; El backend pasa de ser un .exe suelto a una carpeta. Sin esto, el de
; la version anterior se quedaria ahi, y el lanzador podria encontrarlo
; antes que el nuevo.
Type: files; Name: "{app}\race-core-backend.exe"

[Run]
; MongoDB, registrado como servicio para que arranque con Windows. El
; lanzador solo comprueba que responde; quien lo levanta es Windows,
; antes de que nadie toque nada.
Filename: "{app}\mongodb\bin\mongod.exe"; \
    Parameters: "--dbpath ""{commonappdata}\{#Nombre}\db"" --logpath ""{commonappdata}\{#Nombre}\logs\mongod.log"" --install --serviceName ""{#Servicio}"" --serviceDisplayName ""{cm:ServicioDB}"""; \
    StatusMsg: "{cm:PasoRegistrarDB}"; Flags: runhidden waituntilterminated

Filename: "{sys}\net.exe"; Parameters: "start ""{#Servicio}"""; \
    StatusMsg: "{cm:PasoArrancarDB}"; Flags: runhidden waituntilterminated

; Valida la licencia, la ata a este equipo, escribe la configuración y
; genera el token del asistente. Antes de arrancar nada: si la clave no
; vale, la instalación no debe darse por buena.
Filename: "{app}\backend\race-core-backend.exe"; \
    Parameters: "--configurar --correo ""{code:CorreoLicencia}"" --clave ""{code:ClaveLicencia}"" --idioma ""{code:IdiomaElegido}"""; \
    StatusMsg: "{cm:PasoLicencia}"; Flags: runhidden waituntilterminated

Filename: "{app}\{#Ejecutable}"; Description: "{cm:AbrirAsistente}"; \
    Flags: nowait postinstall skipifsilent

[UninstallRun]
; Al desinstalar, en orden inverso: primero parar, después quitar el
; servicio. Los datos no se tocan aquí; de eso se ocupa el código.
Filename: "{sys}\net.exe"; Parameters: "stop ""{#Servicio}"""; \
    Flags: runhidden; RunOnceId: "PararMongo"
Filename: "{app}\mongodb\bin\mongod.exe"; Parameters: "--remove --serviceName ""{#Servicio}"""; \
    Flags: runhidden; RunOnceId: "QuitarMongo"

[Dirs]
; La base de datos y los registros, donde se puede escribir. Nunca bajo
; «Archivos de programa», que es de solo lectura para el operador.
; La raiz tambien: ahi van .env, la licencia y el token del asistente.
; ProgramData deja crear archivos pero no modificar los que creo otro, y
; eso sale como un permiso denegado al reconfigurar o renovar.
Name: "{commonappdata}\{#Nombre}";      Permissions: users-modify
Name: "{commonappdata}\{#Nombre}\db";   Permissions: users-modify
Name: "{commonappdata}\{#Nombre}\logs"; Permissions: users-modify

; CasparCG escribe en las suyas mientras emite: clips que se le manden,
; registros y datos de sesión. En «Archivos de programa» no puede.
Name: "{commonappdata}\{#Nombre}\casparcg\media"; Permissions: users-modify
Name: "{commonappdata}\{#Nombre}\casparcg\log";   Permissions: users-modify
Name: "{commonappdata}\{#Nombre}\casparcg\data";  Permissions: users-modify

; Las plantillas las siembra el backend al arrancar, pero CasparCG
; arranca antes que él y exige que la carpeta exista. Que esté vacía la
; primera vez no importa: nadie saca un gráfico al aire en el segundo
; que va de un arranque al otro.
Name: "{commonappdata}\{#Nombre}\plantillas\img";     Permissions: users-modify
Name: "{commonappdata}\{#Nombre}\casparcg\cef-cache"; Permissions: users-modify

[UninstallDelete]
; Lo que el programa escribe dentro de su propia carpeta y que Inno no
; puso ahí, así que no sabe que existe.
Type: filesandordirs; Name: "{app}\logs"

[Code]
var
  PaginaLicencia: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  PaginaLicencia := CreateInputQueryPage(wpSelectDir,
    ExpandConstant('{cm:LicenciaTitulo}'),
    ExpandConstant('{cm:LicenciaCabecera}'),
    ExpandConstant('{cm:LicenciaNota}'));

  // Solo esto. El nombre del autodromo, el logo, las cuentas y el resto
  // se preguntan en la configuracion, desde el navegador: repetirlos
  // aqui seria pedir dos veces lo mismo.
  PaginaLicencia.Add(ExpandConstant('{cm:LicenciaCorreo}'), False);
  PaginaLicencia.Add(ExpandConstant('{cm:LicenciaClave}'), False);
end;

function CorreoLicencia(Valor: String): String;
begin
  Result := Trim(PaginaLicencia.Values[0]);
end;

function ClaveLicencia(Valor: String): String;
begin
  Result := Trim(PaginaLicencia.Values[1]);
end;

// ── El idioma elegido, para el producto ──────────────────────
//
// Lo que se eligio en la primera pantalla no se queda en el instalador:
// se le pasa al backend, que lo deja en IDIOMA del .env, y de ahi lo
// toma en el primer arranque para dejar el panel y los rotulos de los
// graficos en ese idioma. Sin esto habria que elegirlo dos veces —una
// para instalar y otra en Ajustes— y la segunda no es evidente.
//
// ActiveLanguage devuelve el Name de [Languages]: «es» o «en», que son
// los mismos identificadores que usa el producto.

function IdiomaElegido(Valor: String): String;
begin
  Result := ActiveLanguage;
end;

function NextButtonClick(PaginaActual: Integer): Boolean;
begin
  Result := True;

  if PaginaActual = PaginaLicencia.ID then
  begin
    if (Trim(PaginaLicencia.Values[0]) = '') or (Trim(PaginaLicencia.Values[1]) = '') then
    begin
      MsgBox(ExpandConstant('{cm:LicenciaFaltan}'), mbError, MB_OK);
      Result := False;
    end
    else if Pos('RCS1-', UpperCase(Trim(PaginaLicencia.Values[1]))) <> 1 then
    begin
      // Solo la forma. Si la clave es válida de verdad lo dice el
      // backend al configurar, que es quien lleva el validador; aquí
      // solo se atajan las erratas evidentes antes de copiar 250 MB.
      MsgBox(ExpandConstant('{cm:LicenciaForma}'), mbError, MB_OK);
      Result := False;
    end;
  end;
end;

// ── Renombrar el desinstalador ───────────────────────────────
//
// Inno lo llama unins000.exe y no tiene directiva para cambiarlo. Se
// renombra al terminar, y son DOS archivos: el .exe y su .dat, porque
// el desinstalador busca su datos por su propio nombre y sin el .dat
// no sabe qué deshacer.
//
// Y hay que arreglar el registro: «Agregar o quitar programas» guarda
// la ruta al viejo nombre, así que sin esto el botón «Desinstalar»
// apunta a un archivo que ya no existe.

procedure RenombrarDesinstalador;
var
  Viejo, Nuevo, ViejoDat, NuevoDat, Clave: String;
begin
  Viejo    := ExpandConstant('{app}\unins000.exe');
  Nuevo    := ExpandConstant('{app}\{#Desinstalador}');
  ViejoDat := ExpandConstant('{app}\unins000.dat');
  NuevoDat := ExpandConstant('{app}\uninstaller.dat');

  if not FileExists(Viejo) then
    Exit;

  // El .dat primero: si el .exe ya se llamara distinto y esto fallara,
  // quedaría un desinstalador incapaz de encontrar sus datos.
  if FileExists(ViejoDat) then
    RenameFile(ViejoDat, NuevoDat);

  if RenameFile(Viejo, Nuevo) then
  begin
    Clave := 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#AppId}_is1';
    RegWriteStringValue(HKLM, Clave, 'UninstallString', '"' + Nuevo + '"');
    RegWriteStringValue(HKLM, Clave, 'QuietUninstallString', '"' + Nuevo + '" /SILENT');
  end;
end;

// ── Cerrar lo que este corriendo ─────────────────────────────
//
// Windows no deja sobrescribir un .exe en uso. Si Race Core Studio esta
// abierto cuando se instala encima, los archivos bloqueados NO se
// reemplazan y la instalacion termina diciendo que todo fue bien con la
// version vieja todavia en el disco: el cliente actualiza, no ve ningun
// cambio, y nada le dice por que.
//
// Asi que se cierran antes de copiar. Es lo que hace cualquier
// instalador; lo raro era no hacerlo.

procedure CerrarLoQueEsteAbierto;
var
  Codigo: Integer;
  i: Integer;
  Procesos: array[0..2] of String;
begin
  Procesos[0] := 'race-core-studio.exe';
  Procesos[1] := 'race-core-backend.exe';
  Procesos[2] := 'casparcg.exe';

  for i := 0 to 2 do
    Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM ' + Procesos[i],
         '', SW_HIDE, ewWaitUntilTerminated, Codigo);
end;

function PrepareToInstall(var NecesitaReiniciar: Boolean): String;
begin
  CerrarLoQueEsteAbierto;
  Result := '';
end;

// ── Comprobar que CasparCG levanta en este equipo ────────────
//
// Se arranca una vez, se mira que conteste en el 5250 y se cierra. La
// idea es no dejar que el cliente descubra en su primera carrera que el
// servidor de graficos no funciona en su maquina: si falla —permisos,
// tarjeta de video, un codec— que se sepa ahora, con el instalador
// todavia delante y con alguien mirando.
//
// Nunca impide terminar la instalacion: el panel funciona sin CasparCG,
// solo que no saldrian graficos al aire.

procedure ComprobarCasparCG;
var
  Codigo: Integer;
begin
  WizardForm.StatusLabel.Caption := ExpandConstant('{cm:CasparComprobando}');

  if not Exec(ExpandConstant('{app}\{#Ejecutable}'), '--comprobar-casparcg',
              '', SW_HIDE, ewWaitUntilTerminated, Codigo) then
  begin
    MsgBox(ExpandConstant('{cm:CasparNoSePudo}'), mbInformation, MB_OK);
    Exit;
  end;

  if Codigo = 1 then
    // Ojo: #13#10 nunca al principio de linea. El preprocesador de Inno
    // toma cualquier linea que empiece por # como directiva suya y aborta
    // con «Unknown preprocessor directive».
    MsgBox(ExpandConstant('{cm:CasparNoArranco}'), mbError, MB_OK)

  else if Codigo = 2 then
    MsgBox(ExpandConstant('{cm:CasparAbierto}'), mbInformation, MB_OK);
end;

procedure CurStepChanged(Paso: TSetupStep);
begin
  if Paso = ssPostInstall then
  begin
    RenombrarDesinstalador;
    ComprobarCasparCG;
  end;
end;

// ── Al desinstalar ───────────────────────────────────────────
//
// Los datos del autódromo viven en ProgramData y NO se tocan por
// defecto: son suyos, y quien desinstala para reinstalar no espera
// perder el histórico de carreras. Solo se borran si lo pide.

function InitializeUninstall: Boolean;
var
  Respuesta: Integer;
  Datos: String;
begin
  Result := True;
  Datos := ExpandConstant('{commonappdata}\{#Nombre}');

  if not DirExists(Datos) then
    Exit;

  Respuesta := MsgBox(FmtMessage(CustomMessage('DesinstalarDatos'), [Datos]),
                      mbConfirmation, MB_YESNOCANCEL);

  if Respuesta = IDCANCEL then
    Result := False;

  // TODO: con IDNO, copiar a Escritorio y borrar. Y la casilla de
  // MongoDB, que solo se quita si no lo usa otro programa.
end;
