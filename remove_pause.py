import re

with open('deploy.bat', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\npause\n', '\nREM pause\n')

with open('deploy.bat', 'w', encoding='utf-8') as f:
    f.write(content)

print('pause removed')
