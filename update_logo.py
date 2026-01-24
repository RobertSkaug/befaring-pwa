#!/usr/bin/env python3
import base64
import re

# Read the logo and convert to base64
with open('/workspaces/befaring-pwa/icons/KLP_logo_koksgraa.jpg', 'rb') as f:
    logo_data = base64.b64encode(f.read()).decode('utf-8')
    logo_url = f"data:image/jpeg;base64,{logo_data}"

# Read the app.js file
with open('/workspaces/befaring-pwa/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the old SVG logo with the new JPG logo
# Find the line with klpLogoSVG
old_line_start = content.find('const klpLogoSVG = ')
if old_line_start == -1:
    print("ERROR: Could not find klpLogoSVG definition")
    exit(1)
    
old_line_end = content.find(';', old_line_start)
new_logo_line = f'const klpLogo = `{logo_url}`;'

content = content[:old_line_start] + new_logo_line + content[old_line_end+1:]

# Also update the variable name in the img tag
content = content.replace('${klpLogoSVG}', '${klpLogo}')

# Write back
with open('/workspaces/befaring-pwa/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Logo updated successfully!")
print(f"  Logo size: {len(logo_data)} characters")
