from pathlib import Path

route_path = Path("src/routes/profile/listings.$id.tsx")
transformer_path = Path("scripts/integrate-edit-listing-dynamic-all-categories-v1.py")

route_source = route_path.read_text(encoding="utf-8")
if "<DynamicListingFields" in route_source:
    print("Governed edit integration already present.")
    raise SystemExit(0)

source = transformer_path.read_text(encoding="utf-8")

old_helper = '''def replace_once(label: str, old: str, new: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, found {count}")
    source = source.replace(old, new, 1)
'''
new_helper = '''def replace_once(label: str, old: str, new: str) -> None:
    global source
    count = source.count(old)
    if label == "save loading guard":
        if count not in (1, 2):
            raise SystemExit(
                f"{label}: expected one or two markers, found {count}"
            )
    elif count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, found {count}")
    source = source.replace(old, new, 1)
'''
if old_helper not in source:
    raise SystemExit("Transformer helper marker missing")
source = source.replace(old_helper, new_helper, 1)

ui_start_marker = 'replace_once(\n    "dynamic fields UI",'
condition_helper_marker = 'replace_once(\n    "dynamic condition helper",'
ui_start = source.find(ui_start_marker)
ui_end = source.find(condition_helper_marker, ui_start)
if ui_start < 0 or ui_end < 0:
    raise SystemExit("Transformer dynamic UI block markers missing")

ui_transform = '''dynamic_fields_pattern = re.compile(
    r''' + "'''" + r'''            <CategorySpecificFields\s*\n
\s+kind=\{categoryFieldKind\}\s*\n
\s+values=\{categoryDetails\}\s*\n
\s+disabled=\{!isEditable\}\s*\n
(?:\s+onChange=\{setCategoryDetails\}\s*\n\s+text=\{text\}|\s+text=\{text\}\s*\n\s+onChange=\{setCategoryDetails\})\s*\n
\s*/>\s*\n''' + "'''" + r''',
)
dynamic_fields_replacement = ''' + "'''" + '''            {dynamicSchemaLoading ? (
              <div className="mt-4 rounded-[1.15rem] border border-border/60 bg-card-warm/65 p-4 text-xs text-muted-foreground">
                {text(
                  "جارٍ تجهيز الحقول الخاصة بالتصنيف...",
                  "Preparing category-specific fields...",
                )}
              </div>
            ) : dynamicSchemaActive && dynamicSchema ? (
              <DynamicListingFields
                schema={dynamicSchema}
                values={dynamicValues}
                onChange={handleDynamicValuesChange}
                language={language}
                text={text}
                errors={dynamicFieldErrors}
                disabled={!isEditable || saving || resubmitting}
              />
            ) : (
              <CategorySpecificFields
                kind={categoryFieldKind}
                values={categoryDetails}
                disabled={!isEditable}
                onChange={setCategoryDetails}
                text={text}
              />
            )}
            {dynamicSchemaError ? (
              <p className="mt-3 rounded-xl border border-warning/20 bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
                {text(
                  "تعذر تحميل بعض الحقول المنظمة، لذلك تم الحفاظ على نموذج التوافق والبيانات القديمة.",
                  "Some governed fields could not load, so the compatibility form and legacy data were preserved.",
                )}
              </p>
            ) : null}
''' + "'''" + '''
source, count = dynamic_fields_pattern.subn(dynamic_fields_replacement, source, count=1)
if count != 1:
    raise SystemExit(f"dynamic fields UI replacement count: {count}")

'''
source = source[:ui_start] + ui_transform + source[ui_end:]

namespace = {
    "__name__": "__main__",
    "__file__": str(transformer_path),
}
try:
    exec(compile(source, str(transformer_path), "exec"), namespace)
except BaseException as error:
    print(f"Governed edit integration failed: {error}")
    raise

integrated = route_path.read_text(encoding="utf-8")
required_markers = (
    "fetchOwnerListingAttributes",
    "<DynamicListingFields",
    "replaceOwnerListingAttributes",
    "validateDynamicListingFields",
    "dynamicSchemaUsesListingCondition",
)
missing = [marker for marker in required_markers if marker not in integrated]
if missing:
    raise SystemExit(f"Integrated route is missing markers: {', '.join(missing)}")

print("Governed edit integration completed and verified.")
