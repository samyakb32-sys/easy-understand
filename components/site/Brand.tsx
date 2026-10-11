import Link from "next/link";

export function Brand() {
  return <Link className="brand" href="/" aria-label="linewise home"><i aria-hidden="true">∠</i>linewise<em>.</em></Link>;
}
