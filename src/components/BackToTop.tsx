import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import { scrollPageToTop } from "@/lib/scroll-utils";
import { useUiPreferences } from "@/lib/ui-preferences";

const REVEAL_OFFSET = 700;
const MIN_SCROLLABLE_DISTANCE = 900;

export function BackToTop() {
  const { text } = useUiPreferences();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
      setVisible(window.scrollY >= REVEAL_OFFSET && scrollableDistance >= MIN_SCROLLABLE_DISTANCE);
    };

    const scheduleUpdate = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return (
    <button
      type="button"
      className="rawaj-back-to-top"
      data-visible={visible}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={text("العودة إلى أعلى الصفحة", "Back to top")}
      title={text("العودة إلى الأعلى", "Back to top")}
      onClick={scrollPageToTop}
    >
      <ArrowUp aria-hidden="true" />
    </button>
  );
}
