import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PlaceholderArt } from "./PlaceholderArt";
import type { Category } from "@/types";

interface Props {
  category: Category;
  count: number;
}

export function CategoryCard({ category, count }: Props) {
  return (
    <Link
      to="/listings"
      search={{ category: category.id }}
      className="group flex items-center gap-3 rounded-2xl bg-card p-3 hairline shadow-soft transition-shadow hover:shadow-premium"
    >
      <div className="w-16 shrink-0">
        <PlaceholderArt type={category.placeholder} aspect="square" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-foreground">{category.nameAr}</h3>
        <p className="truncate text-xs text-muted-foreground">{category.hintAr}</p>
        <p className="mt-0.5 text-[11px] text-gold">{count} إعلان</p>
      </div>
      <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
    </Link>
  );
}
