from flask import Flask, request, jsonify, render_template, send_file
from queue import PriorityQueue
import numpy as np, io

app = Flask(__name__)

fmt  = lambda x: (lambda f: int(f) if f == int(f) else round(f,6))(float(x))
snap = lambda pq: [{'val':fmt(v),'fi':fi} for v,fi in pq.queue]
step = lambda **kw: kw  # dict shorthand

def merge(group, steps, p, g):
    pq, ptrs = PriorityQueue(), [0]*len(group)
    for fi,ck in enumerate(group): pq.put((float(ck[0]),fi)); ptrs[fi]=1
    s = snap(pq)
    steps.append(step(type='init-heap', heap=s, ptrs=ptrs[:], chunks=[c.tolist() for c in group],
                      msg=f'[P{p}/G{g}] Merge {len(group)} chunk · root={s[0]["val"] if s else "∅"}'))
    out = []
    while not pq.empty():
        val,fi = pq.get(); out.append(fmt(val))
        pushed = None
        if ptrs[fi] < len(group[fi]):
            nxt = float(group[fi][ptrs[fi]]); pq.put((nxt,fi)); pushed={'val':fmt(nxt),'fi':fi}; ptrs[fi]+=1
        s = snap(pq)
        steps.append(step(type='extract', extracted=fmt(val), fromFile=fi, pushed=pushed,
                          heap=s, ptrs=ptrs[:], chunks=[c.tolist() for c in group], output=out[:],
                          msg=f'[P{p}/G{g}] Extract {fmt(val)} (f{fi}) · root={s[0]["val"] if s else "∅"}'))
    return np.array(out, dtype=float)

def build(arr, cs, k):
    a, steps, chunks = np.array(arr, dtype=float), [], []
    for i in range(0, len(a), cs):
        ch = a[i:i+cs].copy(); ci = len(chunks)
        steps.append(step(type='load-ram', chunk=ch.tolist(), msg=f'[RAM] Load chunk {ci}'))
        ch = np.sort(ch); steps.append(step(type='sort-ram', chunk=ch.tolist(), msg=f'[RAM→Disk] Sort chunk {ci}'))
        chunks.append(ch); steps.append(step(type='write-hdd', chunks=[c.tolist() for c in chunks], msg=f'[Disk] {len(chunks)} file'))
    if not chunks: return [step(type='done', output=[], msg='[DONE] []')]
    p = 1
    while len(chunks) > 1:
        steps.append(step(type='phase3', msg=f'[Pass {p}] {len(chunks)} chunk → nhóm ≤{k}'))
        nxt = []
        for gi in range(0, len(chunks), k):
            nxt.append(merge(chunks[gi:gi+k], steps, p, gi//k))
            steps.append(step(type='write-hdd', chunks=[c.tolist() for c in nxt], msg=f'[P{p}/G{gi//k}] → {len(nxt)} file'))
        chunks = nxt; p += 1
    out = [fmt(x) for x in chunks[0].tolist()]
    steps.append(step(type='done', output=out, msg=f'[DONE] {out}'))
    return steps

@app.route('/')
def index(): return render_template('index.html')

@app.route('/api/build-steps', methods=['POST'])
def api_build():
    d = request.get_json()
    nums, cs, k = d.get('nums',[]), d.get('chunkSize',4), max(2,int(d.get('k',999)))
    if len(nums) < 2: return jsonify({'error':'Cần ≥2 số'}), 400
    return jsonify({'steps': build(nums, cs, k)})

@app.route('/api/upload-bin', methods=['POST'])
def api_upload():
    raw = request.files.get('file', None)
    if not raw or not (data := raw.read()): return jsonify({'error':'File rỗng hoặc thiếu'}), 400
    try: tokens = data.decode('utf-8').split()
    except: return jsonify({'error':'Cần UTF-8'}), 400
    for i,t in enumerate(tokens):
        if not all(c in '01' for c in t): return jsonify({'error':f'"{t}" không phải nhị phân'}), 400
    nums = [int(t,2) for t in tokens]
    return jsonify({'nums':nums, 'count':len(nums)})

@app.route('/api/download-txt', methods=['POST'])
def api_download():
    nums = request.get_json().get('nums',[])
    if not nums: return jsonify({'error':'Không có dữ liệu'}), 400
    buf = io.BytesIO(('\n'.join(map(str,nums))+'\n').encode())
    buf.seek(0)
    return send_file(buf, mimetype='text/plain', as_attachment=True, download_name='sorted_output.txt')

if __name__ == '__main__': app.run(debug=True)
