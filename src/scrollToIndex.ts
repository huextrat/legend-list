import { calculateOffsetForIndex } from "src/calculateOffsetForIndex";
import { scrollTo } from "./scrollTo";
import type { StateContext } from "./state";
import type { InternalState, LegendListRef } from "./types";

export function scrollToIndex(
    ctx: StateContext,
    state: InternalState,
    { index, viewOffset = 0, animated = true, viewPosition }: Parameters<LegendListRef["scrollToIndex"]>[0],
) {
    if (index >= state.props.data.length) {
        index = state.props.data.length - 1;
    } else if (index < 0) {
        index = 0;
    }

    const firstIndexOffset = calculateOffsetForIndex(ctx, state, index);

    const isLast = index === state.props.data.length - 1;
    if (isLast && viewPosition === undefined) {
        viewPosition = 1;
    }
    const firstIndexScrollPostion = firstIndexOffset - viewOffset;

    state.scrollForNextCalculateItemsInView = undefined;

    scrollTo(state, {
        offset: firstIndexScrollPostion,
        animated,
        index,
        viewPosition: viewPosition ?? 0,
        viewOffset,
    });
}
