"""Check repository-local Markdown/HTML links without external dependencies."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def anchors(path):
    values, counts, fenced = set(), {}, False
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.lstrip().startswith(('```', '~~~')):
            fenced = not fenced
        if fenced or not re.match(r'^#{1,6}\s', line):
            continue
        title = re.sub(r'^#{1,6}\s+', '', line).strip().rstrip('#').strip()
        slug = re.sub(r'[^\w\- ]', '', title.lower()).replace(' ', '-')
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        values.add(slug + ('-' + str(count) if count else ''))
    return values


def check():
    files = [ROOT/'README.md', ROOT/'CONTRIBUTING.md', *sorted((ROOT/'docs').rglob('*.md'))]
    checked, errors = 0, []
    for source in files:
        content = source.read_text(encoding='utf-8')
        links = re.findall(r'\[[^\]]*\]\(([^)]+)\)', content)
        links += re.findall(r'(?:href|src)="([^"]+)"', content)
        for link in links:
            parsed = urlsplit(link)
            if parsed.scheme or parsed.netloc:
                continue
            checked += 1
            target = (source.parent / unquote(parsed.path)).resolve() if parsed.path else source
            if not target.is_relative_to(ROOT) or not target.exists():
                errors.append(f'{source.relative_to(ROOT)}: missing local target {link}')
            elif parsed.fragment and target.suffix == '.md' and unquote(parsed.fragment) not in anchors(target):
                errors.append(f'{source.relative_to(ROOT)}: missing heading {link}')
    if errors:
        print('\n'.join(errors))
        return 1
    print(f'Checked {checked} local links/assets across {len(files)} Markdown files: no broken targets or headings.')
    return 0


if __name__ == '__main__':
    sys.exit(check())
