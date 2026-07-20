from pathlib import Path
import re

integrator_path = Path("scripts/integrate-dynamic-facets-ui-v1.py")
source = integrator_path.read_text(encoding="utf-8")

pattern = re.compile(
    r'replace_once\(\n    "loaded result count",.*?\n\)\nreplace_once\(\n    "all active chips",',
    re.S,
)
replacement = '''replace_pattern_once(
    "loaded result count",
    r'(?P<indent>\\s*)`\\$\\{visibleItems\\.length\\} نتيجة محملة حاليًا`,\\n'
    r'(?P=indent)`\\$\\{visibleItems\\.length\\} currently loaded results`,',
    lambda match: (
        match.group("indent")
        + 'totalCount === null\\n'
        + match.group("indent")
        + '  ? `${visibleItems.length} نتيجة محملة حاليًا`\\n'
        + match.group("indent")
        + '  : `${totalCount} نتيجة، تم تحميل ${visibleItems.length}`,\\n'
        + match.group("indent")
        + 'totalCount === null\\n'
        + match.group("indent")
        + '  ? `${visibleItems.length} currently loaded results`\\n'
        + match.group("indent")
        + '  : `${totalCount} results, ${visibleItems.length} loaded`,'
    ),
)
replace_once(
    "all active chips",'''

source, count = pattern.subn(lambda _match: replacement, source, count=1)
if count != 1:
    raise SystemExit(f"loaded result integrator repair count: {count}")

namespace = {
    "__name__": "__main__",
    "__file__": str(integrator_path),
}
exec(compile(source, str(integrator_path), "exec"), namespace)

toolbar_path = Path("src/features/search/SearchResultsToolbar.tsx")
toolbar = toolbar_path.read_text(encoding="utf-8")
if '  attrs: "",\n' not in toolbar:
    marker = '  salary_type: "",\n  sort: "latest" as ListingsSort,\n'
    if toolbar.count(marker) != 1:
        raise SystemExit(f"saved search attrs marker count: {toolbar.count(marker)}")
    toolbar = toolbar.replace(
        marker,
        '  salary_type: "",\n  attrs: "",\n  sort: "latest" as ListingsSort,\n',
        1,
    )
    toolbar_path.write_text(toolbar, encoding="utf-8")

print("Dynamic facets UI and saved-search state integrated.")
