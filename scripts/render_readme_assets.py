"""Render deterministic, dependency-free SVG artwork for the product README."""
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'docs' / 'assets'
ROOT.mkdir(parents=True, exist_ok=True)
DARK, LIME, PAPER, MUTED, BORDER = '#182B23', '#C3F76B', '#F5F7F2', '#617269', '#D7E0D7'


def text(x, y, value, size=16, color=DARK, weight=400, extra=''):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" {extra}>{escape(value)}</text>'


def rect(x, y, w, h, fill='white', stroke='none', radius=16):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}"/>'


def save(name, width, height, title, description, content):
    document = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title><desc id="desc">{escape(description)}</desc>
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8" fill="{MUTED}"/></marker></defs>
<g font-family="Segoe UI, Arial, sans-serif">{content}</g></svg>'''
    (ROOT / name).write_text(document, encoding='utf-8')


def arrow(path):
    return f'<path d="{path}" fill="none" stroke="{MUTED}" stroke-width="2" marker-end="url(#arrow)"/>'


banner = rect(0, 0, 1200, 410, DARK, radius=24)
banner += rect(44, 34, 48, 48, LIME, radius=12)
banner += '<g transform="translate(55 45) scale(1.15)" fill="none" stroke="#182B23" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h15l-5 5H9v4h5l-5 5H4z"/><circle cx="18" cy="17" r="2" fill="#182B23" stroke="none"/></g>'
banner += text(108, 68, 'Tracefold', 31, 'white', 700)
banner += text(920, 62, 'AI TESTING PLATFORM', 14, LIME, 700, 'letter-spacing="1.5"')
banner += text(44, 158, 'Confidence, backed', 48, 'white', 700)
banner += text(44, 218, 'by executable evidence.', 48, LIME, 700)
banner += text(46, 262, 'Understand the project. Review the tests.', 20, '#D6E2D6')
banner += text(46, 293, 'Run, inspect and verify the same suite after a repair.', 20, '#D6E2D6')
for x, width, label in [(44, 181, 'Repository context'), (237, 168, 'Developer approval'), (417, 105, 'Local AI'), (534, 148, 'Evidence replay')]:
    banner += rect(x, 338, width, 34, '#273D31', '#3A5142', 17)
    banner += text(x+width/2, 360, label, 13, '#E4EFDF', 600, 'text-anchor="middle"')
banner += rect(797, 113, 351, 241, '#253B2E', '#496044', 18)
banner += text(821, 145, 'THE VERIFICATION LOOP', 12, LIME, 700, 'letter-spacing="1.6"')
for y, label, value, color in [(178, 'Expected behavior', 'Defined', '#D7E5D6'), (229, 'Reviewed test suite', 'Approved', LIME), (280, 'Repair verification', 'Same tests', LIME)]:
    banner += text(821, y, label, 16, 'white', 600)
    banner += text(1124, y, value, 13, color, 600, 'text-anchor="end"')
    if y != 280:
        banner += f'<path d="M821 {y+17}H1124" stroke="#415845"/>'
banner += text(821, 327, 'Evidence stays attached to the execution.', 12, '#C8D6C6')
save('tracefold-banner.svg', 1200, 410, 'Tracefold — AI testing platform', 'Repository context, developer approval, local AI and same-suite repair verification.', banner)

flow = rect(0, 0, 1200, 712, PAPER, radius=24)
flow += text(42, 47, 'THE PRODUCT WORKFLOW', 12, MUTED, 700, 'letter-spacing="2"')
flow += text(42, 88, 'From repository to verified repair', 30, DARK, 700)
cards = [
    (42, 137, '01', 'Connect project', ['Choose repository, revision', 'and the component to verify.']),
    (428, 137, '02', 'Prepare environment', ['Select a runtime profile and', 'reproduce project dependencies.']),
    (814, 137, '03', 'Generate & approve', ['Define behavior. Review the code.', 'Approve an exact test suite.']),
    (814, 398, '04', 'Run tests', ['Execute baseline and additions.', 'Keep provenance for each case.']),
    (428, 398, '05', 'Inspect evidence', ['Understand failures, logs and', 'the execution that produced them.']),
    (42, 398, '06', 'Verify repair', ['Replay the same approved suite.', 'Compare results on the repair.']),
]
for x, y, number, title, lines in cards:
    final = number == '06'
    flow += rect(x, y, 344, 203, DARK if final else 'white', BORDER)
    flow += rect(x+22, y+22, 39, 32, LIME, radius=9)
    flow += text(x+41.5, y+44, number, 15, DARK, 700, 'text-anchor="middle"')
    flow += text(x+22, y+94, title, 23, 'white' if final else DARK, 700)
    for offset, line in enumerate(lines):
        flow += text(x+22, y+132+offset*25, line, 16, '#D7E4D3' if final else MUTED)
flow += arrow('M386 238H418') + arrow('M772 238H804') + arrow('M986 340V388')
flow += arrow('M814 499H782') + arrow('M428 499H396')
flow += text(42, 662, 'Same tests. New revision. Traceable results.', 19, DARK, 600)
save('product-workflow.svg', 1200, 712, 'Tracefold product workflow', 'Connect, prepare, generate and approve, execute, inspect evidence, then replay unchanged tests on a repaired revision.', flow)

arch = rect(0, 0, 1200, 786, PAPER, radius=24)
arch += text(42, 47, 'PLATFORM ARCHITECTURE', 12, MUTED, 700, 'letter-spacing="2"')
arch += text(42, 88, 'One product. Shared contracts. Specialized execution.', 28, DARK, 700)
for x, y, w, h, title, lines in [
    (42, 147, 243, 102, 'Repository context', ['Source · revisions · components']),
    (357, 137, 486, 122, 'Project workspace', ['Overview / Tests / Runs / AI Review']),
    (915, 147, 243, 102, 'Company AI', ['Context-aware test generation']),
    (42, 333, 243, 112, 'Execution records', ['Source + suite + environment', 'Cases, logs and artifacts']),
    (915, 333, 243, 112, 'Isolated workers', ['Prepare · build · collect · run', 'Native results and diagnostics']),
]:
    arch += rect(x, y, w, h, 'white', BORDER)
    arch += text(x+20, y+37, title, 20, DARK, 700)
    for i, line in enumerate(lines):
        arch += text(x+20, y+65+i*24, line, 13, MUTED)
arch += rect(357, 304, 486, 172, DARK)
arch += text(382, 343, 'CORE PLATFORM', 15, LIME, 700, 'letter-spacing="1"')
for x, y, title in [(382, 380, 'Snapshots'), (527, 380, 'Profiles'), (672, 380, 'Approvals'), (382, 429, 'Runs'), (527, 429, 'Evidence'), (672, 429, 'Reports')]:
    arch += rect(x, y-23, 129, 36, '#2C4334', '#425B45', 8)
    arch += text(x+64.5, y, title, 14, 'white', 600, 'text-anchor="middle"')
arch += arrow('M285 198H347') + arrow('M853 198H905') + arrow('M600 259V294')
arch += arrow('M357 389H295') + arrow('M843 389H905') + arrow('M600 476V532')
arch += rect(42, 542, 1116, 181, '#E7EEDC', '#CCD9BF', 16)
arch += text(66, 577, 'LANGUAGE & TARGET PROVIDERS', 14, DARK, 700, 'letter-spacing="1"')
arch += text(66, 607, 'Shared lifecycle and evidence, with project-specific frameworks and execution environments.', 16, MUTED)
for i, title in enumerate(['Python', '.NET', 'Java', 'Web / API', 'C / C++', 'Mobile', 'Embedded']):
    x=66+i*154
    arch += rect(x, 635, 139, 49, LIME if i==0 else 'white', '#BDCCB2', 10)
    arch += text(x+69.5, 666, title, 16, DARK, 700, 'text-anchor="middle"')
arch += text(42, 758, 'Product scope diagram. Executable provider coverage is stated in the README.', 13, MUTED)
save('platform-architecture.svg', 1200, 786, 'Tracefold platform architecture', 'A project workspace coordinates shared Core contracts, company AI, execution records, workers and language-specific providers. This is a product scope diagram, not a release support claim.', arch)
print('Rendered three Tracefold README assets.')
