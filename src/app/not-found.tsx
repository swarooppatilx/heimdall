import Link from "next/link";
import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StatusPage code="404" message="nothing to watch here. the page moved or the listing expired.">
      <Button asChild>
        <Link href="/">back to fresh jobs</Link>
      </Button>
    </StatusPage>
  );
}
