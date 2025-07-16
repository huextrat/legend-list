import { setPaddingTop } from "./setPaddingTop";
import { type StateContext, getContentSize } from "./state";
import type { InternalState } from "./types";

export function updateAlignItemsPaddingTop(ctx: StateContext, state: InternalState) {
    const {
        scrollLength,
        props: { alignItemsAtEnd, data },
    } = state;
    if (alignItemsAtEnd) {
        let alignItemsPaddingTop = 0;
        if (data?.length > 0) {
            const contentSize = getContentSize(ctx);
            alignItemsPaddingTop = Math.max(0, Math.floor(scrollLength - contentSize));
        }
        setPaddingTop(ctx, { alignItemsPaddingTop });
    }
}
