import requests
import time
import json

url = "https://staging.cookdesign.es/utils/translatev3" 

for i in range(0, 1000, 25):
    limit = 25
    skip = i
    print("step:")
    print(i)
    params = {"collection": "packaging", "sourceLang": "es", "targetLang": "en", "limit":limit, "skip":skip}
    request = requests.get(url=url,params=params)
    data = request.json()
    print(data)

print("///////////////////////////////////////////////////////////////")
print("Script finished successfully")
print("///////////////////////////////////////////////////////////////")