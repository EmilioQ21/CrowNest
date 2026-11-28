import json
import subprocess
import urllib.request

API = 'https' + '://' + 'api.github.com/repos/EmilioQ21/CrowNest'

def leer(ruta):
    peticion = urllib.request.Request(API + ruta, headers={'User-Agent': 'calidad'})
    return json.load(urllib.request.urlopen(peticion))

main = leer('/branches/main')
print('main protegida:', 'si' if main['protected'] else 'no')
issues = [i for i in leer('/issues?state=all&per_page=100') if 'pull_request' not in i]
print('Issues registrados:', len(issues))
print('Versiones (tags):', len(leer('/tags')))
try:
    leer('/contents/.github/workflows?ref=main')
    print('Pipeline en main: si')
except Exception:
    print('Pipeline en main: no')
archivos = subprocess.run(['git', 'ls-tree', '-r', '--name-only', 'origin/main'], capture_output=True, text=True).stdout.splitlines()
print('Archivos de ADR en el repo:', len([a for a in archivos if 'adr' in a.lower().split('/')[-1] or '/adr' in a.lower()]))
