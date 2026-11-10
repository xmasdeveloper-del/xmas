import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Tooltip } from "@medusajs/ui";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { mnOverrides } from "../lib/mn";

const STORAGE_KEY = "xmas_admin_lang";

// Flips the whole admin between Монгол and English. Medusa's dashboard already
// ships a complete `mn` locale, so switching languages translates the entire UI
// out of the box; on top of that we deep-merge a few X-MAS branding overrides
// (e.g. the login greeting). The choice is remembered in localStorage and
// re-applied on every mount, so the language sticks across navigation/reloads.
//
// Монгол is the default. Medusa's own default is English, so a shop in
// Ulaanbaatar opened the admin in English on every machine that had not been
// switched by hand — and the pages Medusa ships (Orders, Products, Price Lists)
// stayed English even though the custom ones were already Mongolian.
const applyOverrides = (i18n: any) => {
  i18n.addResourceBundle("mn", "translation", mnOverrides, true, true);
};

const LangToggle = () => {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<string>(i18n.language?.startsWith("mn") ? "mn" : "en");

  useEffect(() => {
    applyOverrides(i18n);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage may be unavailable */
    }
    // Nothing chosen on this machine yet → Монгол. Someone who switches to
    // English keeps it, because that choice is what gets saved.
    const want = saved || "mn";
    if (want !== i18n.language) {
      i18n.changeLanguage(want);
    }
    setLang(want.startsWith("mn") ? "mn" : "en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = i18n.language?.startsWith("mn") ? "en" : "mn";
    if (next === "mn") {
      applyOverrides(i18n);
    }
    i18n.changeLanguage(next);
    setLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
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
