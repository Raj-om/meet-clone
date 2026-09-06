Set WshShell = CreateObject("WScript.Shell")
' 0 means hide the window completely
WshShell.Run chr(34) & "C:\Users\DELL\OneDrive\Desktop\meet-clone\start-server.bat" & Chr(34), 0
Set WshShell = Nothing
