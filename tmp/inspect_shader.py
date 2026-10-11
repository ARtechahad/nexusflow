with open('/tmp/antigravity_particles.js') as f:
    text = f.read()

import re
vshaders = re.findall(r'vertexShader:`(.*?)`', text, re.DOTALL)
fshaders = re.findall(r'fragmentShader:`(.*?)`', text, re.DOTALL)

for i, s in enumerate(vshaders):
    print(f"=== VERTEX SHADER {i} ===")
    print(s)

for i, s in enumerate(fshaders):
    print(f"=== FRAGMENT SHADER {i} ===")
    print(s)
