import { KB_FAQ, KB_START } from "@/lib/pages/knowledge-base";
import { ProductFaq, ProductStart } from "../closing";

/* The page's close: its questions, then the way in. */

export function KbFaq() {
  return <ProductFaq data={KB_FAQ} />;
}

export function KbStart() {
  return <ProductStart data={KB_START} />;
}
