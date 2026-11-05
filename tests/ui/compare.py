#!/usr/bin/env python3
# compare.py <bootstrap.json> <cleanx.json> — CleanX vs Bootstrap interaction audit report
import json, sys, re
from collections import defaultdict, Counter

def load(p):
    d = json.load(open(p))
    return d['results'], d.get('errors', [])

def ctxnorm(c):
    return re.sub(r' > dep:.*$', ' > dep', c)

def knorm(k):
    return re.sub(r'new[0-9a-f]{6}', 'new*', k)

B, Berr = load(sys.argv[1])
C, Cerr = load(sys.argv[2])
key = lambda r: (r['page'], ctxnorm(r['ctx']), r['kind'], knorm(r['key']), r['check'])
bmap = {}
for r in B: bmap.setdefault(key(r), r)
cmap = {}
for r in C: cmap.setdefault(key(r), r)

# CleanX-created helper controls have no Bootstrap counterpart
cx_only_ui = lambda r: re.search(r'Save & Apply|⋯|cleanx', r['key'])

regress, cxonly, both = [], [], []
for k, r in cmap.items():
    if r['ok']: continue
    b = bmap.get(k)
    if b is None: cxonly.append(r)
    elif b['ok']: regress.append(r)
    else: both.append(r)

seenC = {(r['page'], ctxnorm(r['ctx']), r['kind'], knorm(r['key'])) for r in C}
hidden = []
for r in B:
    if r['check'] != 'reachable' or not r['ok']: continue
    k = (r['page'], ctxnorm(r['ctx']), r['kind'], knorm(r['key']))
    if k not in seenC and not r['ctx'].count('dep:'): hidden.append(r)

def show(title, rows, limit=400):
    print(f'\n### {title}: {len(rows)}')
    by = defaultdict(list)
    for r in rows: by[r['page']].append(r)
    n = 0
    for pg, rs in by.items():
        print(f'  {pg}')
        for r in rs:
            n += 1
            if n > limit: return
            print(f"    [{r['check']}] {r['ctx'][:46]:46s} {r['kind']:13s} {r['key'][:62]:62s} {r.get('detail','')[:90]} {'#'+str(r['shot']) if r.get('shot') else ''}")

print(f"checks: bootstrap={len(B)} cleanx={len(C)}  failed: bootstrap={sum(not r['ok'] for r in B)} cleanx={sum(not r['ok'] for r in C)}")
print('dialogs opened: bootstrap=%d cleanx=%d' % (sum(r['check']=='opens-dialog' for r in B), sum(r['check']=='opens-dialog' for r in C)))
show('CleanX REGRESSIONS (pass in Bootstrap, fail in CleanX)', regress)
show('Visible in Bootstrap but never found in CleanX', hidden)
show('Fail in CleanX, no Bootstrap counterpart', cxonly)
show('Fail in both themes (not theme related)', both, 60)
print('\nJS errors bootstrap:', Berr[:5])
print('JS errors cleanx:', Cerr[:5])

print('\n### Checks per page/dialog (bootstrap vs cleanx) where they differ')
cb=Counter((r['page'], ctxnorm(r['ctx'])) for r in B); cc=Counter((r['page'], ctxnorm(r['ctx'])) for r in C)
for k in sorted(set(cb)|set(cc)):
    if cb[k]!=cc[k]: print(f"  {k[0]:34s} {k[1][:50]:50s} bootstrap={cb[k]:4d} cleanx={cc[k]:4d}")

problems = len(regress) + len(cxonly) + len(hidden)
print(f"\nVERDICT: {'PASS' if problems == 0 else 'FAIL'} — {len(regress)} regressions, {len(cxonly)} CleanX-only failures, {len(hidden)} controls hidden by CleanX")
sys.exit(1 if problems else 0)
