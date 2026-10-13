import type { Href, useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * router.back() throws "action GO_BACK was not handled" when there's no
 * history to pop — a direct URL load, a deep link, or a refreshed page all
 * leave the stack empty. Every back/cancel/close button in this app goes
 * through here instead, with an explicit fallback for exactly that case.
 */
export function goBack(router: Router, fallbackHref: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
