import os
import subprocess
import sys
import time

def run_command(command, cwd=None):
    """Run a shell command."""
    print(f"Running command: {command} in {cwd}")
    result = subprocess.run(command, shell=True, cwd=cwd, text=True, capture_output=True)
    if result.returncode != 0:
        print(f"Error running command: {command}\n{result.stderr}")
        sys.exit(1)
    return result.stdout.strip()

def setup_virtualenv():
    """Create a virtual environment if it doesn't exist."""
    venv_path = os.path.join('shield-server', '.venv')
    if not os.path.exists(venv_path):
        print("Creating virtual environment...")
        run_command('python -m venv .venv', cwd='shield-server')
    else:
        print("Virtual environment already exists.")
    
    print("Contents of shield-server directory:")
    print(run_command('dir' if os.name == 'nt' else 'ls -la', cwd='shield-server'))

def install_python_dependencies():
    """Install Python dependencies after activating the virtual environment."""
    print("Installing Python dependencies...")
    
    if os.name == 'nt':
        activate_script = os.path.join('.venv', 'Scripts', 'activate.bat')
    else:
        activate_script = os.path.join('.venv', 'bin', 'activate')
    
    full_activate_path = os.path.join('shield-server', activate_script)
    if not os.path.exists(full_activate_path):
        print(f"Activate script not found: {full_activate_path}")
        print("Contents of .venv directory:")
        print(run_command('dir' if os.name == 'nt' else 'ls -la', cwd=os.path.join('shield-server', '.venv')))
        sys.exit(1)
    
    if os.name == 'nt':
        command = f'cmd /c "{activate_script} && pip install -r requirements.txt"'
    else:
        command = f'bash -c "source {activate_script} && pip install -r requirements.txt"'
    
    run_command(command, cwd='shield-server')

def setup_client():
    """Setup the client-side."""
    print("Setting up client...")
    if not os.path.exists(os.path.join('shield-client', 'node_modules')):
        print("Installing client dependencies...")
        run_command('npm install', cwd='shield-client')
    else:
        print("Client dependencies already exist.")

def launch_server_and_client():
    """Launch the Flask server in the background and Next.js client in the foreground."""
    server_dir = os.path.abspath('shield-server')
    client_dir = os.path.abspath('shield-client')

    if os.name == 'nt':
        activate_cmd = r'.venv\Scripts\activate.bat'
        server_cmd = f'start /b cmd /c "cd /d {server_dir} && {activate_cmd} && python app.py"'
        client_cmd = f'cd /d {client_dir} && npm run dev'
    else:
        activate_cmd = 'source .venv/bin/activate'
        server_cmd = f'cd {server_dir} && {activate_cmd} && python app.py &'
        client_cmd = f'cd {client_dir} && npm run dev'

    print("Starting the server...")
    subprocess.Popen(server_cmd, shell=True)
    
    print("Waiting for the server to start...")
    time.sleep(5)  # Give the server some time to start

    print("Starting the client...")
    subprocess.run(client_cmd, shell=True)

def main():
    """Main setup and launch function."""
    print("Setting up the project...")

    # Step 1: Setup virtual environment and install dependencies
    setup_virtualenv()
    install_python_dependencies()

    # Step 2: Setup client
    setup_client()

    print("Setup complete! Launching server and client...")

    # Step 3: Launch server and client
    launch_server_and_client()

if __name__ == '__main__':
    main()