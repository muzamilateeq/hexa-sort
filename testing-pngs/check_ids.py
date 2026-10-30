import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('js/game.js', 'r', encoding='utf-8') as f:
    game = f.read()

ids = re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", game)
missing = [i for i in set(ids) if f'id="{i}"' not in html and f"id='{i}'" not in html]

print("MISSING IDS IN HTML (referenced in game.js):")
for m in sorted(missing):
    print(f"  - {m}")
