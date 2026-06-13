import re

with open('scratch_index_remote.tsx', 'r') as f:
    remote_content = f.read()

with open('scratch_index_genouk.tsx', 'r') as f:
    genouk_content = f.read()

genouk_app_match = re.search(r'const App = \(\) => \{(.*?)\n\};\n\nconst root = createRoot', genouk_content, re.DOTALL)
if genouk_app_match:
    genouk_app_body = genouk_app_match.group(1)
    genouk_pet_comp = f"const GenoukPet = () => {{{genouk_app_body}\n}};\n"
else:
    print("Failed to find App in genouk")
    exit(1)

# Modify remote App to include GenoukPet at the bottom of the container.
old_end = "        </div>\n      )}\n    </div>\n  );\n};\n\nconst root = createRoot"
if old_end not in remote_content:
    print("Failed to find end of App in remote")
    exit(1)

new_remote_app_end = "        </div>\n      )}\n      <GenoukPet />\n    </div>\n  );\n};\n\n" + genouk_pet_comp + "\nconst root = createRoot"

new_content = remote_content.replace(old_end, new_remote_app_end)

# Also need to extract greetings and add them if not present.
greetings_match = re.search(r'const greetings = \[.*?\];', genouk_content, re.DOTALL)
if greetings_match and 'const greetings =' not in new_content:
    new_content = new_content.replace('const vscode = window.acquireVsCodeApi();\n', 'const vscode = window.acquireVsCodeApi();\n\n' + greetings_match.group(0) + '\n')

with open('src/webviews/genouk-app/index.tsx', 'w') as f:
    f.write(new_content)

print("Merge complete")
