import re

with open('scratch_index_genouk.tsx', 'r') as f:
    genouk_content = f.read()

# extract ChromaVideo
chroma_match = re.search(r'(interface ChromaVideoProps \{.*?)const App =', genouk_content, re.DOTALL)
if chroma_match:
    chroma_code = chroma_match.group(1)
else:
    print("Failed to find ChromaVideo")
    exit(1)

with open('src/webviews/genouk-app/index.tsx', 'r') as f:
    index_content = f.read()

index_content = index_content.replace('];\n\ninterface SessionTask', '];\n\n' + chroma_code + '\ninterface SessionTask')

with open('src/webviews/genouk-app/index.tsx', 'w') as f:
    f.write(index_content)

print("Fixed")
