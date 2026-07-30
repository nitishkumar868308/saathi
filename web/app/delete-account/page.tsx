import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo-server";
import DeleteAccountClient from "@/components/DeleteAccountClient";

export function generateMetadata(): Promise<Metadata> {
  // Meta DB (`seo_pages`) se aata hai — admin panel se badla ja sakta hai.
  // Row na ho to yahi defaults chalte hain.
  return pageMetadata("/delete-account", {
    title: "Delete your account",
    description:
      "Request deletion of your Apka Saathi account and data — what gets removed, what we must keep, and how long it takes.",
  });
}

export default function DeleteAccountPage() {
  return <DeleteAccountClient />;
}
