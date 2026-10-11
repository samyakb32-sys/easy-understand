import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="linewise home">
      <span className="mark" aria-hidden="true"><i>∠</i></span>linewise<em>.</em>
    </Link>
  );
}
