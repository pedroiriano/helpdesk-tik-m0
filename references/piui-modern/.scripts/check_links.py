"""
.scripts/check_links.py - Zero-Dependency Link Integrity Sentinel
Audits HTML files for broken links (404), insecure external links (missing rel="noopener noreferrer"),
and anchor validity across all platform files.
"""

import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

PROJECT_ROOT = Path('.').resolve()


def resolve_base(path, content):
    base_match = re.search(r'<base\s+[^>]*href=["\']([^"\']+)["\']', content, re.IGNORECASE)
    if not base_match:
        return path.parent.resolve()
    base_href = unquote(urlsplit(base_match.group(1)).path)
    return (path.parent / base_href).resolve()


def audit_html_file(file_path):
    print(f"\n==========================================")
    print(f"[*] Memeriksa Integritas: {file_path}")
    print(f"==========================================")
    
    path = Path(file_path)
    if not path.exists():
        print(f"[!] Berkas tidak ditemukan: {file_path}")
        return 1

    content = path.read_text(encoding='utf-8')
    issues = 0

    # 1. Periksa Tautan Eksternal target="_blank"
    all_links = re.finditer(r'<a\s+([^>]*?)>', content, re.IGNORECASE)

    for match in all_links:
        tag_attrs = match.group(1)
        href_m = re.search(r'href=["\']([^"\']+)["\']', tag_attrs, re.IGNORECASE)
        if not href_m:
            continue
        href = href_m.group(1)

        # Cek tabnabbing
        if 'target="_blank"' in tag_attrs.lower() or "target='_blank'" in tag_attrs.lower():
            if 'noopener' not in tag_attrs.lower():
                print(f"  [PERINGATAN KEAMANAN] Tautan '{href}' membuka tab baru tanpa rel='noopener'!")
                issues += 1

    # 2. Periksa semua tautan dan aset lokal, termasuk halaman Level 2 dengan <base>.
    base_dir = resolve_base(path, content)
    content_without_base = re.sub(r'<base\s+[^>]*>', '', content, flags=re.IGNORECASE)
    references = re.findall(r'(?:src|href)=["\']([^"\']+)["\']', content_without_base, re.IGNORECASE)
    checked = set()
    for reference in references:
        if reference in checked:
            continue
        checked.add(reference)
        parts = urlsplit(reference)
        if parts.scheme in {'http', 'https', 'mailto', 'tel', 'data', 'blob'} or reference.startswith('//'):
            continue

        local_path = unquote(parts.path)
        target_file = path if not local_path else (base_dir / local_path)
        if local_path.endswith('/'):
            target_file = target_file / 'index.html'
        target_file = target_file.resolve()

        try:
            target_file.relative_to(PROJECT_ROOT)
        except ValueError:
            print(f"  [TAUTAN KELUAR ROOT] Referensi '{reference}' keluar dari direktori proyek!")
            issues += 1
            continue

        if not target_file.exists():
            print(f"  [TAUTAN / ASET HILANG] '{reference}' tidak ditemukan di disk!")
            issues += 1
            continue

        if parts.fragment and target_file.suffix.lower() == '.html':
            target_content = target_file.read_text(encoding='utf-8')
            target_ids = set(re.findall(r'id=["\']([^"\']+)["\']', target_content))
            if parts.fragment not in target_ids:
                print(f"  [ANCHOR RUSAK] '{reference}' mengarah ke ID yang tidak ditemukan!")
                issues += 1

    if issues == 0:
        print("  [OK SUKSES] Semua tautan dan aset statis terverifikasi sempurna!")
    else:
        print(f"  [!] Ditemukan {issues} potensi masalah integritas tautan.")

    return issues

if __name__ == '__main__':
    if len(sys.argv) > 1:
        targets = [sys.argv[1]]
    else:
        targets = [str(p) for p in Path('.').rglob('*.html') if not any(part.startswith('.') for part in p.parts)]
    
    total_issues = 0
    for t in sorted(targets):
        total_issues += audit_html_file(t)

    print(f"\n==========================================")
    print(f"TOTAL AUDIT: {len(targets)} berkas HTML diperiksa. Masalah total: {total_issues}")
    print(f"==========================================")
    sys.exit(total_issues)
