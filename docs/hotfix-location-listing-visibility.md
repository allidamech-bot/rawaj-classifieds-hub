# Location submit and listing visibility hotfix

- Canonical location selection no longer fails merely because the legacy governorate state was empty.
- Listing writes resolve the effective legacy governorate by walking the selected canonical node ancestry.
- Canonical location remains the source of truth while legacy governorate compatibility is derived at the API boundary.
- Public listing results progressively load additional cursor pages as the user approaches the end of the grid.
- Appended pages are deduplicated by listing id and retain the manual Load more control as a fallback.
- Regression coverage explicitly preserves legacy district writes and rejects canonical nodes that cannot resolve to any governorate.
