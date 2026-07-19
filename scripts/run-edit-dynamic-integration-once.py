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
    expected_count = 2 if label == "save loading guard" else 1
    count = source.count(old)
    if count != expected_count:
        raise SystemExit(
            f"{label}: expected {expected_count} marker(s), found {count}"
        )
    source = source.replace(old, new, 1)
'''
if old_helper not in source:
    raise SystemExit("Transformer helper marker missing")
source = source.replace(old_helper, new_helper, 1)

expected_ui_marker = '''            <CategorySpecificFields
              kind={categoryFieldKind}
              values={categoryDetails}
              disabled={!isEditable}
              text={text}
              onChange={(nextDetails) => {
                setCategoryDetails(nextDetails);
                if (categoryFieldKind === "vehicles" || categoryFieldKind === "electronics") {
                  setCondition(categoryDetailsGlobalCondition(categoryFieldKind, nextDetails));
                }
              }}
            />
'''
actual_ui_marker = '''            <CategorySpecificFields
              kind={categoryFieldKind}
              values={categoryDetails}
              disabled={!isEditable}
              onChange={setCategoryDetails}
              text={text}
            />
'''
if expected_ui_marker not in source:
    raise SystemExit("Transformer UI search marker missing")
source = source.replace(expected_ui_marker, actual_ui_marker, 1)

namespace = {
    "__name__": "__main__",
    "__file__": str(transformer_path),
}
exec(compile(source, str(transformer_path), "exec"), namespace)

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
