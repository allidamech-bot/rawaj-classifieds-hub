import { Link } from "@tanstack/react-router";
import { MessageCircle, Pencil, Phone, Send, Store, Tag, type LucideIcon } from "lucide-react";

interface ListingContactDockProps {
  listingId: string;
  isOwner: boolean;
  canCall: boolean;
  canWhatsapp: boolean;
  callHref: string | null;
  whatsappUrl: string | null;
  onMessage: () => void;
  onOffer: () => void;
  text: (ar: string, en: string) => string;
}

export function ListingContactDock({
  listingId,
  isOwner,
  canCall,
  canWhatsapp,
  callHref,
  whatsappUrl,
  onMessage,
  onOffer,
  text,
}: ListingContactDockProps) {
  return (
    <aside
      className="rawaj-contact-dock"
      aria-label={text("إجراءات الإعلان", "Listing actions")}
      data-owner={isOwner}
      data-action-contract="conversation-and-direct-contact"
    >
      <div className="rawaj-contact-dock__inner">
        {isOwner ? (
          <>
            <Link
              to="/profile/listings/$id"
              params={{ id: listingId }}
              className="rawaj-contact-dock__primary"
            >
              <Pencil aria-hidden="true" />
              {text("إدارة الإعلان", "Manage listing")}
            </Link>
            <Link to="/profile/listings" className="rawaj-contact-dock__secondary">
              <Store aria-hidden="true" />
              {text("إعلاناتي", "My listings")}
            </Link>
          </>
        ) : (
          <>
            <button type="button" onClick={onMessage} className="rawaj-contact-dock__primary">
              <MessageCircle aria-hidden="true" />
              {text("مراسلة", "Message")}
            </button>
            <button type="button" onClick={onOffer} className="rawaj-contact-dock__offer">
              <Tag aria-hidden="true" />
              {text("قدّم عرضًا", "Make an offer")}
            </button>
            {canCall && callHref ? (
              <DockLink icon={Phone} href={callHref} label={text("اتصال", "Call")} />
            ) : null}
            {canWhatsapp && whatsappUrl ? (
              <DockLink
                icon={Send}
                href={whatsappUrl}
                label={text("واتساب", "WhatsApp")}
                external
                tone="whatsapp"
              />
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

function DockLink({
  icon: Icon,
  href,
  label,
  external,
  tone,
}: {
  icon: LucideIcon;
  href: string;
  label: string;
  external?: boolean;
  tone?: "whatsapp";
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="rawaj-contact-dock__secondary"
      data-tone={tone}
      aria-label={label}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}
