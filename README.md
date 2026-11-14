# Python 3.10 — Local Setup

> **IMPORTANT: Navigate to the project directory before running any commands!**
>
> All commands must be executed from the folder containing `requirements.txt`.

## 1. Check Python 3.10

Make sure Python 3.10 is installed.

**Windows (CMD):**
```cmd
py -3.10 --version
```

**Linux / macOS:**
```bash
python3.10 --version
```
## DONT FORGET to go to project folder
```cmd
cd your/project/path
```
## 2. Create a virtual environment

**Windows (CMD):**
```cmd
py -3.10 -m venv .venv
```

**Linux / macOS:**
```bash
python3.10 -m venv .venv
```

## 3. Activate the environment

**Windows (CMD):**
```cmd
.venv\Scripts\activate.bat
```

**Linux / macOS:**
```bash
source .venv/bin/activate
```

After activation, your terminal should display `(.venv)`.

## 4. Install dependencies

```bash
python -m pip install -r requirements.txt
```

This installs all dependencies from the existing `requirements.txt` file.

## 5. Verify installation

```bash
python --version
python -m pip list
```

Python should report version **3.10.x**.

## 6. Deactivate

When finished:

```bash
deactivate
```

Next time, navigate to the project directory and activate `.venv` again. You don't need to reinstall dependencies unless they change.

## Git

Add the virtual environment to `.gitignore`:

```gitignore
.venv/
```
