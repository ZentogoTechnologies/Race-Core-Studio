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
LicenseFile=licencia-de-uso.txt

; Lo que se ve en «Agregar o quitar programas».
UninstallDisplayName={#Nombre} {#Version}
UninstallDisplayIcon={app}\{#Ejecutable}

; Sin comprimir dos veces: CasparCG y MongoDB ya vienen comprimidos y
; volver a pasarles LZMA solo alarga la compilación sin ganar tamaño.
Compression=lzma2/max
SolidCompression=yes

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "..\..\payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#Nombre}";           Filename: "{app}\{#Ejecutable}"
Name: "{autodesktop}\{#Nombre}";     Filename: "{app}\{#Ejecutable}"; Tasks: escritorio

[Tasks]
Name: "escritorio"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos:"

[Run]
; MongoDB, registrado como servicio para que arranque con Windows. El
; lanzador solo comprueba que responde; quien lo levanta es Windows,
; antes de que nadie toque nada.
Filename: "{app}\mongodb\bin\mongod.exe"; \
    Parameters: "--dbpath ""{commonappdata}\{#Nombre}\db"" --logpath ""{commonappdata}\{#Nombre}\logs\mongod.log"" --install --serviceName ""{#Servicio}"" --serviceDisplayName ""{#Nombre} — Base de datos"""; \
    StatusMsg: "Registrando la base de datos..."; Flags: runhidden waituntilterminated

Filename: "{sys}\net.exe"; Parameters: "start ""{#Servicio}"""; \
    StatusMsg: "Arrancando la base de datos..."; Flags: runhidden waituntilterminated

; Valida la licencia, la ata a este equipo, escribe la configuración y
; genera el token del asistente. Antes de arrancar nada: si la clave no
; vale, la instalación no debe darse por buena.
Filename: "{app}\race-core-backend.exe"; \
    Parameters: "--configurar --correo ""{code:CorreoLicencia}"" --clave ""{code:ClaveLicencia}"""; \
    StatusMsg: "Comprobando la licencia..."; Flags: runhidden waituntilterminated

Filename: "{app}\{#Ejecutable}"; Description: "Abrir el asistente de configuración"; \
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
    'Licencia del producto',
    'Introduzca los datos que recibió de {#Empresa}.',
    'La licencia se comprueba antes de copiar nada, y quedará asociada a este equipo.');

  PaginaLicencia.Add('Correo de la licencia:', False);
  PaginaLicencia.Add('Clave del producto:', False);
  PaginaLicencia.Add('Nombre del autódromo o circuito:', False);
end;

function CorreoLicencia(Valor: String): String;
begin
  Result := Trim(PaginaLicencia.Values[0]);
end;

function ClaveLicencia(Valor: String): String;
begin
  Result := Trim(PaginaLicencia.Values[1]);
end;

function NombreCliente(Valor: String): String;
begin
  Result := Trim(PaginaLicencia.Values[2]);
end;

function NextButtonClick(PaginaActual: Integer): Boolean;
begin
  Result := True;

  if PaginaActual = PaginaLicencia.ID then
  begin
    if (Trim(PaginaLicencia.Values[0]) = '') or (Trim(PaginaLicencia.Values[1]) = '') then
    begin
      MsgBox('Hacen falta el correo y la clave de la licencia.', mbError, MB_OK);
      Result := False;
    end
    else if Pos('RCS1-', UpperCase(Trim(PaginaLicencia.Values[1]))) <> 1 then
    begin
      // Solo la forma. Si la clave es válida de verdad lo dice el
      // backend al configurar, que es quien lleva el validador; aquí
      // solo se atajan las erratas evidentes antes de copiar 250 MB.
      MsgBox('La clave empieza por RCS1- y lleva cinco bloques.' + #13#10 +
             'Ejemplo:  RCS1-XXXX-XXXX-XXXX-XXXX', mbError, MB_OK);
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

procedure CurStepChanged(Paso: TSetupStep);
begin
  if Paso = ssPostInstall then
    RenombrarDesinstalador;
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

  Respuesta := MsgBox(
    'Se va a quitar Race Core Studio de este equipo.' + #13#10#13#10 +
    'Los datos del autódromo —pilotos, vehículos, categorías, históricos ' +
    'de carreras, logos y configuración— están en:' + #13#10#13#10 +
    Datos + #13#10#13#10 +
    '¿Desea CONSERVARLOS?' + #13#10#13#10 +
    'Sí = se conservan (recomendado).' + #13#10 +
    'No = se borran. Se hará una copia en el Escritorio antes.',
    mbConfirmation, MB_YESNOCANCEL);

  if Respuesta = IDCANCEL then
    Result := False;

  // TODO: con IDNO, copiar a Escritorio y borrar. Y la casilla de
  // MongoDB, que solo se quita si no lo usa otro programa.
end;
