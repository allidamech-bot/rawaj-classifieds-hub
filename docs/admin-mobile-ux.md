# RAWAJ Admin Mobile UX

The admin shell is mobile-first without changing the five-item public BottomNav.

- Admin navigation is a sticky, horizontally scrollable workspace rail on small screens.
- The current workspace is named above the rail so deep admin routes remain orientable.
- Navigation items use 44px minimum touch targets, snap scrolling, active-route semantics, and hidden scrollbars.
- Only routes granted by the effective permission matrix are rendered.
- No queue badge is displayed unless a real measured count exists; the shell does not fabricate counts.
- Bottom safe-area padding prevents controls from colliding with device home indicators.
- Desktop keeps the existing lightweight horizontal navigation behavior.
