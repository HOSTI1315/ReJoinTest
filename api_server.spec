# -*- mode: python ; coding: utf-8 -*-
# Build: pyinstaller api_server.spec --noconfirm

from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("starlette")
    + collect_submodules("fastapi")
    + collect_submodules("pydantic")
    + collect_submodules("anyio")
    + [
        "pydantic_core",
        "h11",
        "sniffio",
        "httptools",
        "requests",
        "psutil",
        "charset_normalizer",
        "idna",
        "urllib3",
        "certifi",
        "multiprocessing",
    ]
)

a = Analysis(
    ["api_server.py"],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="api_server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
