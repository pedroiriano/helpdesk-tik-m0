"""Check operational HTML text and accessible labels in the published build."""
from html.parser import HTMLParser
from pathlib import Path
import re

DIST = Path(__file__).resolve().parents[1] / 'frontend' / 'dist'
FORBIDDEN = re.compile(r'\b(?:DEMO|prototipe|pengembangan|sintetis|lab|UAT|M[1-9]|M11)\b', re.I)
ATTRIBUTES = {'aria-label', 'title', 'alt', 'placeholder'}


class UIParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.raw = None
        self.matches = []

    def check(self, value):
        if value and FORBIDDEN.search(value):
            self.matches.append((self.getpos()[0], value.strip()[:100]))

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style'}:
            self.raw = tag
        for name, value in attrs:
            if name in ATTRIBUTES:
                self.check(value)

    def handle_endtag(self, tag):
        if self.raw == tag:
            self.raw = None

    def handle_data(self, data):
        if self.raw is None:
            self.check(data)


def main():
    paths = {
        *DIST.glob('*.html'), *(DIST / 'admin').glob('*.html'),
        *(DIST / 'admin/app').glob('*/index.html'),
        DIST / 'admin/auth/login.html', DIST / 'admin/app/tickets/detail.html',
    }
    assert DIST.joinpath('index.html').is_file(), 'Build the frontend first'
    issues = []
    for path in sorted(paths):
        parser = UIParser()
        parser.feed(path.read_text(encoding='utf-8'))
        for number, copy in parser.matches:
            issues.append(f'{path.relative_to(DIST)}:{number}: {copy}')
    assert not issues, '\n'.join(issues)
    for form in ['akses.html', 'daftar.html', 'lapor.html', 'admin/auth/login.html']:
        assert 'data-hd-environment hidden' in DIST.joinpath(form).read_text(encoding='utf-8'), form
    print(f'PASS {len(paths)} HTML files, operational text and accessible labels')


if __name__ == '__main__':
    main()
