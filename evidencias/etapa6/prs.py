import json
import statistics
import urllib.parse
import urllib.request
from datetime import datetime

API = 'https' + '://' + 'api.github.com/repos/EmilioQ21/CrowNest'

def leer(ruta, **params):
    url = API + ruta
    if params:
        url = url + '?' + urllib.parse.urlencode(params)
    peticion = urllib.request.Request(url, headers={'User-Agent': 'calidad'})
    return json.load(urllib.request.urlopen(peticion))

def fecha(texto):
    return datetime.strptime(texto, '%Y-%m-%dT%H:%M:%SZ')

prs = sorted(leer('/pulls', state='all', per_page=100), key=lambda p: p['number'])
filas = []
for p in prs:
    ajenas = [r for r in leer('/pulls/%d/reviews' % p['number']) if r['user']['login'] != p['user']['login']]
    horas = None
    if p['merged_at']:
        horas = (fecha(p['merged_at']) - fecha(p['created_at'])).total_seconds() / 3600
    estado = 'integrado' if p['merged_at'] else p['state']
    filas.append((p['number'], p['user']['login'], estado, horas, len(ajenas)))

print('PR    autor       estado      horas  revisiones')
for f in filas:
    horas = '-' if f[3] is None else '%.1f' % f[3]
    print('#%-4d %-11s %-10s %6s  %d' % (f[0], f[1], f[2], horas, f[4]))

integrados = [f for f in filas if f[2] == 'integrado']
con_revision = [f for f in integrados if f[4] > 0]
tiempos = [f[3] for f in integrados]
print()
print('PR en total:', len(filas), '| integrados:', len(integrados), '| abiertos:', len([f for f in filas if f[2] == 'open']))
print('Integrados con al menos 1 revision:', len(con_revision), 'de', len(integrados))
print('Horas hasta integrar: mediana %.1f, maxima %.1f' % (statistics.median(tiempos), max(tiempos)))
