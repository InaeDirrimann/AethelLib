#!/usr/bin/env python3
import os
import sys
import shutil
import zipfile

# Colors
GREEN = "\033[92m"
WHITE = "\033[1m\033[37m"
DARK_GRAY = "\033[90m"
RESET = "\033[0m"

def clear_screen():
    os.system('clear' if os.name != 'nt' else 'cls')

def prompt_confirm():
    clear_screen()
    border = "=" * 58
    print(f"{GREEN}{border}{RESET}")
    print(f"{GREEN}               AETHELGRAD ADDON PACKAGER (UNIX)          {RESET}")
    print(f"{GREEN}{border}{RESET}")
    print("  This script will:")
    print("  1. Sync current Behavior and Resource Pack files.")
    print("  2. Compile them into a clean .mcaddon archive.")
    print("  3. Save AethelLib.mcaddon at the workspace root.")
    print(f"{DARK_GRAY}----------------------------------------------------------{RESET}")
    print(f"  Press {GREEN}[ENTER]{RESET} to execute packager | \033[91m[Ctrl+C]\033[0m to cancel")
    print(f"{GREEN}{border}{RESET}")
    try:
        input()
    except (KeyboardInterrupt, EOFError):
        print("\n\033[91mOperation cancelled.\033[0m")
        sys.exit(0)

# allowZip64=False forces standard ZIP 2.0 format — same as 7-zip output.
# Minecraft's importer rejects ZIP64 archives that Compress-Archive / default ZipFile produce.
def zip_folder(folder_path, output_zip):
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED, allowZip64=False) as zipf:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, folder_path)
                zipf.write(full_path, rel_path)

def main():
    if "-y" not in sys.argv and "--yes" not in sys.argv:
        prompt_confirm()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    tools_dir = os.path.dirname(script_dir)
    project_root = os.path.dirname(tools_dir)
    output_dir = os.path.join(tools_dir, "Output")
    os.makedirs(output_dir, exist_ok=True)
    build_dir = os.path.join(project_root, "build")
    out_file = os.path.join(output_dir, "AethelLib.mcaddon")

    print("[Packager] Cleaning build workspace...")
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    if os.path.exists(out_file):
        os.remove(out_file)
    
    os.makedirs(build_dir, exist_ok=True)

    bp_temp = os.path.join(build_dir, "AethelLib_BP")
    rp_temp = os.path.join(build_dir, "AethelLib_RP")
    os.makedirs(bp_temp, exist_ok=True)
    os.makedirs(rp_temp, exist_ok=True)

    # 1. Copy Behavior Pack assets
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

    # 2. Copy Resource Pack assets
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

    # 3. Create standalone .mcpack files in Output
    print("[Packager] Compressing standalone Packs...")
    bp_zip = os.path.join(output_dir, "AethelLib_BP.mcpack")
    rp_zip = os.path.join(output_dir, "AethelLib_RP.mcpack")

    zip_folder(bp_temp, bp_zip)
    zip_folder(rp_temp, rp_zip)

    # 4. Create final .mcaddon (direct pack folders, standard ZIP container, no ZIP64)
    # Direct folder root allows Bedrock on mobile & desktop to import both packs simultaneously in a single pass.
    print(f"{GREEN}[Packager] Creating final AethelLib.mcaddon (direct folder tree)...{RESET}")
    with zipfile.ZipFile(out_file, 'w', zipfile.ZIP_DEFLATED, allowZip64=False) as addon_zip:
        for folder_name, folder_path in [("AethelLib_BP", bp_temp), ("AethelLib_RP", rp_temp)]:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.join(folder_name, os.path.relpath(full_path, folder_path))
                    addon_zip.write(full_path, rel_path)

    # 5. Cleanup
    shutil.rmtree(build_dir)
    print(f"{GREEN}[Packager] Build successful! Addon packaged at: {out_file}{RESET}")

if __name__ == "__main__":
    main()
