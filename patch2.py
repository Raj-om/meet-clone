import os

path = r'c:\Users\DELL\OneDrive\Desktop\meet-clone\src\app\meet\[id]\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''    const sidebarTabs: { key: SidebarTab; icon: string; label: string }[] = [
        { key: 'scam', icon: '🛡️', label: 'Scam AI' },'''

target = '''    useEffect(() => {
        if (!socket) return
        socket.on("mode-select", (mode: any) => setRoomMode(mode))
        return () => { socket.off("mode-select") }
    }, [socket])

    if (roomMode === null) {
        return <ModeSelectionScreen 
            meetingId={meetingId}
            displayName={displayName}
            isHost={isHost}
            onSelectMode={(mode) => {
                setRoomMode(mode)
                if (socket) socket.emit("mode-select", mode)
            }}
            onSkip={() => setRoomMode('office')}
        />
    }

''' + replacement

content = content.replace(replacement, target, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Mode selector patched in.')
