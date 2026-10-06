"""Cache the official pinned browser SDK for offline emulator integration tests."""
import concurrent.futures,hashlib,pathlib,urllib.request
root=pathlib.Path(__file__).resolve().parents[2]/'.test-cache/firebase-sdk'
root.mkdir(parents=True,exist_ok=True)
FILES={
 'firebase-app.js':'08b83f02859328aabb9acea9370d600ffe739d9e2c251b6668b6f6ff56a2e1d1',
 'firebase-auth.js':'9b2ebba6ffced4657e12300f4187d53c8fc1762e98188e5e2005407a86e926b6',
 'firebase-firestore.js':'aecb2b5b722d1a45426326cd144bc025d5bea8c48f3a53eca3914ad587361bd4',
 'firebase-storage.js':'ed550180b319f62991edcdbf2f2049124ac4d7e01d7fd86e7d91f07a7b962cc9'
}
def prepare(name):
 p=root/name;data=p.read_bytes() if p.exists() else urllib.request.urlopen('https://www.gstatic.com/firebasejs/10.12.2/'+name,timeout=60).read()
 if hashlib.sha256(data).hexdigest()!=FILES[name]:raise RuntimeError('SDK integrity mismatch: '+name)
 p.write_bytes(data)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(prepare,FILES))
print('Pinned SDK verified for local emulator tests.')
