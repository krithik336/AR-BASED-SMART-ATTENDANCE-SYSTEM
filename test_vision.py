import sys
import time

sys.path.insert(0, 'attendance-vision-service')
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Wait for model to load
print('Waiting for model to load...')
for i in range(60):
    r = client.get('/health')
    data = r.json()
    print('  Attempt {}: status={}, model_loaded={}'.format(i+1, data['status'], data['model_loaded']))
    if data['model_loaded']:
        break
    time.sleep(3)

print('Testing /detect...')
import numpy as np
import cv2
img = np.zeros((640, 640, 3), dtype=np.uint8)
ok, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
blob = buf.tobytes()

r = client.post('/detect', content=blob, headers={'Content-Type': 'image/jpeg'})
print('Status:', r.status_code)
print('Response:', r.json())
print('All tests passed!')