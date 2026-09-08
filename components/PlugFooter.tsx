/**
 * The cross-brand plug: humblebrag is the parody, resumarsh is the antidote.
 *
 * Rendered on the homepage, on every permalink, and — deliberately — inside
 * `/embed`, which runs in an iframe on other people's sites and is therefore
 * the only surface here that reaches an audience we didn't bring ourselves.
 *
 * `rel="noopener"` and NOT `noreferrer`: the Referer header is half of how the
 * funnel is attributed on the resumarsh side. `?ref=humblebrag` is the other
 * half, for the browsers that strip it.
 */
const RESUMARSH = "https://resumarsh.com/?ref=humblebrag";

export function PlugFooter({ variant = "plug" }: { variant?: "plug" | "permalink" }) {
  return <p className="plugFooter">
    {variant === "permalink"
      ? <>The non-fictional version of this lives at <a href={RESUMARSH} target="_blank" rel="noopener">resumarsh.com</a>.</>
      : <>humblebrag makes the fake one. <a href={RESUMARSH} target="_blank" rel="noopener">resumarsh</a> makes the real one.</>}
  </p>;
}
