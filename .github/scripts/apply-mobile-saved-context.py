from pathlib import Path

path = Path("src/routes/listings.$id.tsx")
text = path.read_text(encoding="utf-8")
old = '''                    <button
                      type="button"
                      onClick={() => void toggleFavorite()}
                      aria-label={text("حفظ في المفضلة", "Save to favorites")}
                      className="rawaj-icon-button h-9 w-9 bg-card/88 backdrop-blur"
                    >
                      <Heart
                        className={`h-4 w-4 ${fav ? "fill-destructive text-destructive" : ""}`}
                      />
                    </button>
'''
new = '''                    <button
                      type="button"
                      onClick={() => void toggleFavorite()}
                      aria-label={
                        fav
                          ? text("إزالة من المفضلة", "Remove from favorites")
                          : text("حفظ في المفضلة", "Save to favorites")
                      }
                      className={
                        fav
                          ? "inline-flex h-9 items-center gap-1.5 rounded-full bg-card/88 px-2.5 text-[10px] font-bold text-foreground shadow-soft backdrop-blur"
                          : "rawaj-icon-button h-9 w-9 bg-card/88 backdrop-blur"
                      }
                    >
                      <Heart
                        className={`h-4 w-4 ${fav ? "fill-destructive text-destructive" : ""}`}
                      />
                      {fav && <span>{text("محفوظ", "Saved")}</span>}
                    </button>
'''
count = text.count(old)
if count != 1:
    raise RuntimeError(f"mobile favorite anchor count={count}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Applied explicit mobile saved listing context")
