import re

with open('frontend/business-pages.mjs', 'r', encoding='utf-8') as f:
    text = f.read()

search_box = '<div class="hd-search-box" data-hd-search-wrap style="margin-bottom:1.5rem;"><label for="hd-public-search" class="u-sr-only">Cari layanan atau panduan</label><div class="vy-input-group" style="position:relative;"><input type="search" id="hd-public-search" class="vy-input" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="hd-search-suggestions" aria-activedescendant="" placeholder="Cari layanan, panduan, atau informasi TIK..." autocomplete="off"><ul id="hd-search-suggestions" class="hd-suggestions-list" role="listbox" hidden style="position:absolute;top:100%;left:0;right:0;z-index:50;background:#fff;border:1px solid #ccc;list-style:none;padding:0;margin:0;max-height:240px;overflow-y:auto;"></ul></div></div>'

target = "if (kind === 'catalog') main = banner('Katalog layanan', 'Pilih layanan yang sesuai kebutuhan. Daftar dan formulir mengikuti audience serta hak akses akun Anda.') + session + '"
replacement = "if (kind === 'catalog') main = banner('Katalog layanan', 'Pilih layanan yang sesuai kebutuhan. Daftar dan formulir mengikuti audience serta hak akses akun Anda.') + session + '" + search_box

if target in text:
    text = text.replace(target, replacement)
    print("Replaced catalog banner search box")

nav_target = '<option value="memberships">Membership dan izin</option></select>'
nav_replacement = '<option value="memberships">Membership dan izin</option><option value="navigation">Navigasi portal (M2)</option><option value="articles">Artikel konten (M8)</option></select>'

if nav_target in text:
    text = text.replace(nav_target, nav_replacement)
    print("Replaced admin master kind select")

with open('frontend/business-pages.mjs', 'w', encoding='utf-8') as f:
    f.write(text)

print("Done updating business-pages.mjs")
