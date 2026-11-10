import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Tooltip } from "@medusajs/ui";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { mnOverrides } from "../lib/mn";
import { chosenLanguage, rememberLanguage, DEFAULT_LANG } from "../lib/lang";

// Flips the whole admin between Монгол and English. Medusa's dashboard already
// ships a complete `mn` locale, so switching languages translates the entire UI
// out of the box; on top of that we deep-merge a few X-MAS branding overrides
// (e.g. the login greeting).
//
// WHICH language the admin opens in is not decided here — see ../lib/lang. It
// is seeded into the key Medusa's own language detector reads, before the
// dashboard initialises, so every page opens in Монгол whether or not this
// widget was ever mounted. This button only switches it.
const applyOverrides = (i18n: any) => {
  i18n.addResourceBundle("mn", "translation", mnOverrides, true, true);
};

const LangToggle = () => {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<string>(() =>
    (i18n.language || chosenLanguage() || DEFAULT_LANG).startsWith("mn") ? "mn" : "en");

  useEffect(() => {
    applyOverrides(i18n);
    // The detector has already picked the language from the seeded key. Only
    // correct it if something else moved it; it must not be re-decided here,
    // or a reload would fight whatever the person just chose.
    const want = chosenLanguage() || DEFAULT_LANG;
    if (!i18n.language?.startsWith(want)) i18n.changeLanguage(want);
    setLang(want.startsWith("mn") ? "mn" : "en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = i18n.language?.startsWith("mn") ? "en" : "mn";
    if (next === "mn") applyOverrides(i18n);
    rememberLanguage(next);
    i18n.changeLanguage(next);
    setLang(next);
  };

  const isMn = lang === "mn";

  return (
    <div className="flex justify-end">
      <Tooltip content={isMn ? "Switch admin to English" : "Админыг монгол хэл рүү шилжүүлэх"}>
        <Button variant="secondary" size="small" onClick={toggle} type="button">
          <span aria-hidden>{isMn ? "🇲🇳" : "🇬🇧"}</span>
          {isMn ? "Монгол" : "English"}
        </Button>
      </Tooltip>
    </div>
  );
};

export const config = defineWidgetConfig({
  zone: [
    "login.before",
    "order.list.before",
    "product.list.before",
    "customer.list.before",
    "inventory_item.list.before",
    "promotion.list.before",
    "price_list.list.before",
    "customer_group.list.before",
    "product_collection.list.before",
    "product_category.list.before",
    "campaign.list.before",
    "reservation.list.before",
    "user.list.before",
    "sales_channel.list.before",
    "region.list.before",
    "tax.list.before",
    "return_reason.list.before",
  ],
});

export default LangToggle;
