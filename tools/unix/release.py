#!/usr/bin/env python3
import os
import sys
import json
import shutil
import zipfile

# Colors
YELLOW = "\033[93m"
WHITE = "\033[1m\033[37m"
DARK_GRAY = "\033[90m"
RESET = "\033[0m"
CYAN = "\033[96m"
GREEN = "\033[92m"

def clear_screen():
    os.system('clear' if os.name != 'nt' else 'cls')

def prompt_confirm():
    clear_screen()
    border = "=" * 58
    print(f"{YELLOW}{border}{RESET}")
    print(f"{YELLOW}          AETHELGRAD AUTO-RELEASE ENGINE (UNIX)          {RESET}")
    print(f"{YELLOW}{border}{RESET}")
    print("  This script will:")
    print("  1. [Optional] Increment the manifest version (odometer).")
    print("  2. Compile and build the Behavior & Resource Pack files.")
    print("  3. Save backups and releases directly in your workspace.")
    print(f"{DARK_GRAY}----------------------------------------------------------{RESET}")
    print(f"  Press {YELLOW}[ENTER]{RESET} to execute release runner | \033[91m[Ctrl+C]\033[0m to cancel")
    print(f"{YELLOW}{border}{RESET}")
    try:
        input()
    except (KeyboardInterrupt, EOFError):
        print("\n\033[91mOperation cancelled.\033[0m")
        sys.exit(0)

def get_key():
    """Reads a single keypress from the terminal without requiring Enter."""
    if not sys.stdin.isatty():
        try:
            return sys.stdin.readline().strip()
        except Exception:
            return ""

    if os.name == 'nt':
        try:
            import msvcrt
            while msvcrt.kbhit():
                msvcrt.getch()
            ch = msvcrt.getch()
            try:
                char_str = ch.decode('utf-8', errors='ignore')
            except Exception:
                char_str = ch.decode('cp1252', errors='ignore')
            return char_str
        except Exception:
            pass

    try:
        import tty
        import termios
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            ch = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        return ch
    except Exception:
        pass

    try:
        return sys.stdin.readline().strip()
    except Exception:
        return ""

def prompt_bump_version(current_version_str):
    """Ask whether to bump the manifest version. Returns True to bump, False to skip."""
    border = "-" * 58
    print(f"{DARK_GRAY}{border}{RESET}")
    print(f"  Current version: {YELLOW}{current_version_str}{RESET}")
    print(f"  Bump manifest version? {GREEN}[Y]{RESET}/{DARK_GRAY}/{RESET}\033[91m[n]\033[0m")
    print(f"{DARK_GRAY}{border}{RESET}")
    try:
        key = get_key()
        if key in ('\x03', '\x04'):
            raise KeyboardInterrupt()
        choice = key.strip().lower()
        if choice:
            print(choice)
        else:
            print()
        return choice in ("", "y")
    except (KeyboardInterrupt, EOFError):
        print("\n\033[91mOperation cancelled.\033[0m")
        sys.exit(0)

# allowZip64=False forces standard ZIP 2.0 format — same as 7-zip output.
# Minecraft's importer rejects ZIP64 archives produced by default ZipFile settings.
def zip_folder(folder_path, output_zip):
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED, allowZip64=False) as zipf:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, folder_path)
                zipf.write(full_path, rel_path)

def main():
    prompt_confirm()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    tools_dir = os.path.dirname(script_dir)
    project_root = os.path.dirname(tools_dir)
    manifest_path = os.path.join(project_root, "manifest.json")

    output_dir = os.path.join(tools_dir, "Output")
    backup_dir = os.path.join(output_dir, "backups")
    release_dir = os.path.join(output_dir, "releases")
    build_dir = os.path.join(project_root, "build")

    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(backup_dir, exist_ok=True)
    os.makedirs(release_dir, exist_ok=True)

    print(f"{CYAN}=========================================={RESET}")
    print(f"{CYAN}     AETHELGRAD AUTO-RELEASE SYSTEM       {RESET}")
    print(f"{CYAN}=========================================={RESET}")

    # 1. READ & INCREMENT VERSION (Base-10 Odometer)
    if not os.path.exists(manifest_path):
        print("\033[91mmanifest.json not found in workspace!\033[0m")
        sys.exit(1)

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    version = manifest["header"]["version"]
    major = int(version[0])
    minor = int(version[1])
    patch = int(version[2])

    old_version_str = f"{major}.{minor}.{patch}"

    # Ask whether to bump the version or keep it as-is
    bump = prompt_bump_version(old_version_str)

    if bump:
        # Increment logic (Base-10 Odometer roll-over)
        if patch < 9:
            patch += 1
        elif minor < 9:
            patch = 0
            minor += 1
        else:
            patch = 0
            minor = 0
            major += 1

        new_version_str = f"{major}.{minor}.{patch}"
        new_version_array = [major, minor, patch]

        print(f"{GREEN}[Version] Bumping: {old_version_str} -> {new_version_str}{RESET}")

        # Update manifest
        manifest["header"]["version"] = new_version_array
        for module in manifest["modules"]:
            module["version"] = new_version_array

        # Save manifest back with clean standard formatting
        dep = manifest["dependencies"]
        clean_json = f"""{{\n    "format_version": {manifest["format_version"]},\n    "header": {{\n        "name": "{manifest["header"]["name"]}",\n        "description": "{manifest["header"]["description"]}",\n        "uuid": "{manifest["header"]["uuid"]}",\n        "version": [{major}, {minor}, {patch}],\n        "min_engine_version": [{', '.join(str(x) for x in manifest["header"]["min_engine_version"])}],\n        "license": "{manifest["header"]["license"]}"\n    }},\n    "modules": [\n        {{\n            "description": "{manifest["modules"][0]["description"]}",\n            "type": "{manifest["modules"][0]["type"]}",\n            "uuid": "{manifest["modules"][0]["uuid"]}",\n            "version": [{major}, {minor}, {patch}]\n        }},\n        {{\n            "description": "{manifest["modules"][1]["description"]}",\n            "language": "{manifest["modules"][1]["language"]}",\n            "type": "{manifest["modules"][1]["type"]}",\n            "uuid": "{manifest["modules"][1]["uuid"]}",\n            "entry": "{manifest["modules"][1]["entry"]}",\n            "version": [{major}, {minor}, {patch}]\n        }}\n    ],\n    "dependencies": [\n        {{\n            "module_name": "{dep[0]["module_name"]}",\n            "version": "{dep[0]["version"]}"\n        }},\n        {{\n            "module_name": "{dep[1]["module_name"]}",\n            "version": "{dep[1]["version"]}"\n        }}\n    ]\n}}"""
        with open(manifest_path, 'w', encoding='utf-8') as f:
            f.write(clean_json)
    else:
        new_version_str = old_version_str
        print(f"{YELLOW}[Version] Skipping bump — keeping v{new_version_str}{RESET}")

    # 2. RUN BUILD & COMPRESS
    print("[Packager] Cleaning build workspace...")
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    os.makedirs(build_dir, exist_ok=True)

    bp_temp = os.path.join(build_dir, "AethelLib_BP")
    rp_temp = os.path.join(build_dir, "AethelLib_RP")
    os.makedirs(bp_temp, exist_ok=True)
    os.makedirs(rp_temp, exist_ok=True)

    # Copy Behavior Pack assets
    print("[Packager] Copying Behavior Pack assets...")
    bp_files = ["manifest.json", "pack_icon.png", "scripts", "entities"]
    for item in bp_files:
        src = os.path.join(project_root, item)
        if os.path.exists(src):
            dst = os.path.join(bp_temp, item)
            if os.path.isdir(src):
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)

    # Copy Resource Pack assets
    print("[Packager] Copying Resource Pack assets...")
    rp_source = os.path.join(project_root, "AethelLib (RP)")
    if os.path.exists(rp_source):
        for item in os.listdir(rp_source):
            src = os.path.join(rp_source, item)
            dst = os.path.join(rp_temp, item)
            if os.path.isdir(src):
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)

    # Compress packs
    print("[Packager] Compressing Packs...")
    bp_zip = os.path.join(build_dir, "AethelLib_BP.mcpack")
    rp_zip = os.path.join(build_dir, "AethelLib_RP.mcpack")

    zip_folder(bp_temp, bp_zip)
    zip_folder(rp_temp, rp_zip)

    # Packaging final .mcaddon (direct folder tree, standard ZIP container, no ZIP64)
    print("[Packager] Packaging final .mcaddon (direct folder tree)...")
    addon_zip_path = os.path.join(build_dir, "AethelLib.mcaddon")
    with zipfile.ZipFile(addon_zip_path, 'w', zipfile.ZIP_DEFLATED, allowZip64=False) as addon_zip:
        for folder_name, folder_path in [("AethelLib_BP", bp_temp), ("AethelLib_RP", rp_temp)]:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.join(folder_name, os.path.relpath(full_path, folder_path))
                    addon_zip.write(full_path, rel_path)

    # Define paths
    release_file = os.path.join(release_dir, f"AethelLib_v{new_version_str}.mcaddon")
    backup_file = os.path.join(backup_dir, f"AethelLib_backup_v{new_version_str}.mcaddon")
    dev_file = os.path.join(output_dir, "AethelLib.mcaddon")

    # Copy to destinations
    shutil.copy2(addon_zip_path, release_file)
    shutil.copy2(release_file, backup_file)
    shutil.copy2(release_file, dev_file)

    # Cleanup
    shutil.rmtree(build_dir)

    print(f"{GREEN}=========================================={RESET}")
    print(f"{GREEN}   RELEASE BUILD v{new_version_str} SUCCESSFUL!   {RESET}")
    print(f"{GREEN}=========================================={RESET}")
    print(f"  -> Release: {release_file}")
    print(f"  -> Backup:  {backup_file}")
    print(f"  -> Dev:     {dev_file}")
    print(f"{GREEN}=========================================={RESET}")

if __name__ == "__main__":
    main()
