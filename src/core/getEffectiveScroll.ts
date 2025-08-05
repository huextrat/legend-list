import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";

export function getEffectiveScroll(ctx: StateContext, state: InternalState) {
    const { scroll: scrollState, scrollLength } = state;
    const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "headerSize");
    const totalSize = peek$(ctx, "totalSize");

    let scroll = scrollState - topPad;
    if (scroll + scrollLength > totalSize) {
        scroll = Math.max(0, totalSize - scrollLength);
    }

    return scroll;
}
