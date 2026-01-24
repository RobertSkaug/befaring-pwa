import base64

with open('/workspaces/befaring-pwa/icons/KLP_logo_koksgraa.jpg', 'rb') as f:
    encoded = base64.b64encode(f.read()).decode('utf-8')
    data_url = f"data:image/jpeg;base64,{encoded}"
    
with open('/workspaces/befaring-pwa/logo_base64.txt', 'w') as f:
    f.write(data_url)

print(f"Logo converted. Length: {len(data_url)} characters")
print(f"First 100 chars: {data_url[:100]}...")
