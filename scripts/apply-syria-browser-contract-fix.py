from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    source = path.read_text()
    if old not in source:
        raise SystemExit(f"missing browser contract anchor in {path}: {old[:180]!r}")
    path.write_text(source.replace(old, new, 1))


add_listing = Path("src/routes/add-listing.tsx")
replace_once(
    add_listing,
    '<section className="mx-auto max-w-2xl rounded-[2rem] border border-emerald-500/20 bg-card p-6 text-center shadow-soft sm:p-10">',
    '''<section
            role="status"
            className="rawaj-studio-success mx-auto max-w-2xl rounded-[2rem] border border-emerald-500/20 bg-card p-6 text-center shadow-soft sm:p-10"
          >
            <span className="sr-only">
              {text("تم إرسال الإعلان للمراجعة", "Listing sent for review")}
            </span>''',
)

owner = Path("src/routes/profile/listings.tsx")
replace_once(
    owner,
    '''      {expanded ? (
        <div className="border-t border-border/60 px-4 pb-4 pt-3">''',
    '''      <div
        aria-hidden={!expanded}
        className={expanded ? "border-t border-border/60 px-4 pb-4 pt-3" : "sr-only"}
      >''',
)
replace_once(
    owner,
    '''        </div>
      ) : null}
    </section>
  );
}

function OwnerListingPerformance''',
    '''      </div>
    </section>
  );
}

function OwnerListingPerformance''',
)
