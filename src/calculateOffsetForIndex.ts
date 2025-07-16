import { getId } from "./getId";
import { type StateContext, peek$ } from "./state";
import type { InternalState } from "./types";

export function calculateOffsetForIndex(ctx: StateContext, state: InternalState, index: number | undefined) {
    let position = 0;

    if (index !== undefined) {
        position = state?.positions.get(getId(state, index)) || 0;
    }

    const paddingTop = peek$(ctx, "stylePaddingTop");
    if (paddingTop) {
        position += paddingTop;
    }

    const headerSize = peek$(ctx, "headerSize");
    if (headerSize) {
        position += headerSize;
    }

    return position;
}
