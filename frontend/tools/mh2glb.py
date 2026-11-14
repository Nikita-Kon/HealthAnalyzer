import sys, json, numpy as np, trimesh
src, out_glb, out_json = sys.argv[1:4]
targets = [(a.split('=')[0], float(a.split('=')[1])) for a in sys.argv[4:]]
V=[]; faces=[]; group=None; gfaces={}
for line in open(src):
    if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('g '): group=line.split()[1]
    elif line.startswith('f '):
        idx=[int(t.split('/')[0])-1 for t in line.split()[1:]]
        gfaces.setdefault(group,[]).append(idx)
V=np.array(V)
for path,w in targets:
    for line in open(path):
        if line.startswith('#') or not line.strip(): continue
        i,x,y,z=line.split(); V[int(i)]+=w*np.array([float(x),float(y),float(z)])
# joints = centroid of each joint group
joints={}
for g,fs in gfaces.items():
    if g.startswith('joint-'):
        ids=sorted({i for f in fs for i in f}); joints[g[6:]]=V[ids].mean(0).tolist()
tris=[]
for f in gfaces['body']:
    for k in range(1,len(f)-1): tris.append([f[0],f[k],f[k+1]])
m=trimesh.Trimesh(V,np.array(tris),process=True)
m.remove_unreferenced_vertices()
print('verts',len(m.vertices),'tris',len(m.faces),'bounds',m.bounds.tolist())
m.export(out_glb)
json.dump({k:[round(c,4) for c in v] for k,v in joints.items() if not any(s in k for s in ['finger','toe','tongue','lid','eye-target','foot-'])}, open(out_json,'w'), indent=0)
