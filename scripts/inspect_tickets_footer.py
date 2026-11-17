import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "http://127.0.0.1:18090/admin/app/tickets/index.html"
resp = urllib.request.urlopen(url)
text = resp.read().decode('utf-8', errors='replace')

print("=== INSPEKSI RESPONSE DARI LIVE SERVER ===")
print("URL:", url)
print("Status Code:", resp.status)
print("Contains 'Pedro':", 'Pedro' in text)
print("Contains 'PIUI Zero':", 'PIUI Zero' in text)
print("Contains 'logo-pastel-mark.png':", 'logo-pastel-mark.png' in text)

# Cari semua kemunculan 'PIUI Zero'
for line_no, line in enumerate(text.splitlines(), start=1):
    if 'PIUI Zero' in line or 'Pedro' in line:
        print(f"Line {line_no}: {line[:120]}")

idx = text.find('<footer')
if idx != -1:
    end_idx = text.find('</footer>', idx) + len('</footer>')
    print("\n--- FOOTER HTML DI LIVE SERVER ---")
    print(text[idx:end_idx])
else:
    print("\n[WARNING] Tidak ditemukan elemen <footer>!")
