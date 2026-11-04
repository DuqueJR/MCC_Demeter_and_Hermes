# Identidad del firmware: entorno de PlatformIO y commit (con + si hay cambios sin commit).
# Va a un encabezado generado en la carpeta de compilacion, asi solo recompila quien lo incluye cuando cambia.
Import("env")
import os, subprocess


def git(*a):
    try:
        return subprocess.check_output(["git"] + list(a), cwd=env.subst("$PROJECT_DIR"), stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        return ""


h = git("rev-parse", "--short=7", "HEAD") or "sin_git"
if git("status", "--porcelain", "--untracked-files=no"):
    h += "+"
gen = os.path.join(env.subst("$BUILD_DIR"), "gen")
os.makedirs(gen, exist_ok=True)
txt = '#pragma once\n#define FW_ENV "%s"\n#define FW_GIT "%s"\n' % (env.subst("$PIOENV"), h)
p = os.path.join(gen, "fw_build.h")
if not os.path.exists(p) or open(p).read() != txt:
    open(p, "w").write(txt)
env.Append(CPPPATH=[gen])
print("firmware: %s %s" % (env.subst("$PIOENV"), h))
