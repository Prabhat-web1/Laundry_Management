import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata = {
    title: "Washday — Laundry, without the guesswork",
    description: "Track hostel laundry from pickup to handover, with clear ETAs and a proper way to resolve issues.",
};
export default function RootLayout({ children }) {
    return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
