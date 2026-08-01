from pathlib import Path

path = Path("scripts/structured-listing-price-offers-v1.test.mjs")
text = path.read_text(encoding="utf-8")
start_marker = '  assert.match(fixture, /offerRole/);\n'
end_marker = '  assert.match(fixture, /initialIncomingOffer/);'
start = text.find(start_marker)
if start < 0:
    raise SystemExit("fixture role assertion marker missing")
start += len(start_marker)
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit("fixture offer assertion marker missing")
replacement = '''  assert.match(fixture, /offersMatch = path\\.match/);
  assert.match(fixture, /offerMatch = path\\.match/);
  assert.match(fixture, /Boolean\\(offersMatch\\)/);
  assert.match(fixture, /Boolean\\(offerMatch\\)/);
'''
path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")
