#ifndef AppVersion
  #error AppVersion must be supplied by the build script
#endif
#ifndef SourceDir
  #error SourceDir must be supplied by the build script
#endif

[Setup]
AppId={{C565B53E-C438-4B93-ABFA-652456E575F5}
AppName=Huddle Control Agent
AppVersion={#AppVersion}
AppPublisher=Huddle
DefaultDirName={autopf}\Huddle Control Agent
DefaultGroupName=Huddle Control Agent
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=Huddle-Control-Agent-windows-x64
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
MinVersion=10.0.19045
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
UninstallDisplayIcon={app}\HuddleControlAgent.exe

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCR; Subkey: "huddle-control"; ValueType: string; ValueName: ""; ValueData: "URL:Huddle Control Agent"; Flags: uninsdeletekey
Root: HKCR; Subkey: "huddle-control"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "huddle-control\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\HuddleControlAgent.exe"" --link ""%1"""
