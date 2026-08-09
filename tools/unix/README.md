# Aethelgrad Dev Tools - Unix Edition (macOS & Linux)

This directory contains pure Python 3 equivalents of the PowerShell scripting tools, designed to run flawlessly on both **macOS (Darwin)** and **Linux** systems.

Together with Windows (PowerShell), they complete the **OS Trinity** of compatibility!

All scripts use the Python 3 standard library and have **zero external dependencies** (no `pip install` required!).

##  Interactive Scripts

### 1. `pack.py`
*   **Purpose**: Gathers the Behavior Pack and Resource Pack files recursively, creates compressed `.mcpack` files, and packages them into a clean, unified `AethelLib.mcaddon` file at the root of your workspace.
*   **Usage**:
    ```bash
    python3 tools/unix/pack.py
    ```

### 2. `release.py`
*   **Purpose**: Auto-release and odometer version bumping system. Increments the version inside your `manifest.json`, updates module version dependencies, builds the packages, and places them in:
    *   `releases/AethelLib_v[version].mcaddon`
    *   `backups/AethelLib_backup_v[version].mcaddon`
    *   `AethelLib.mcaddon` (at the root of your workspace)
*   **Usage**:
    ```bash
    python3 tools/unix/release.py
    ```

### 3. `deploy.py`
*   **Purpose**: Directly syncs behavior and resource packs to your local BDS development directories for immediate server-side testing.
*   **Usage**:
    ```bash
    python3 tools/unix/deploy.py
    ```

##  Permissions
Before running the scripts on macOS or Linux, mark them as executable in your terminal:
```bash
chmod +x tools/unix/*.py
```

---
