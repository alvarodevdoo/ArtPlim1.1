import os
import platform

command = "cloudflared tunnel run sistema"

print(f"Rodando o comando: {command}")

if platform.system() == "Windows":
    os.system(f"start cmd /k {command}")
else:
    # Para Linux/macOS, pode ser necessario ajustar como voce abre um novo terminal
    # Este exemplo usa x-terminal-emulator, que e comum em sistemas baseados em Debian
    # Voce pode precisar altera-lo para 'gnome-terminal', 'konsole', etc.
    
    os.system(f"x-terminal-emulator -e 'bash -c \"{command}; exec bash\"'")
