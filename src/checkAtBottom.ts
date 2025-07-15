import { checkThreshold } from "./checkThreshold";
import { getContentSize } from "./state";
import type { StateContext } from "./state";
import type { InternalState } from "./types";

export function checkAtBottom(ctx: StateContext, state: InternalState) {
    if (!state) {
        return;
    }
    const {
        queuedInitialLayout,
        scrollLength,
        scroll,
        maintainingScrollAtEnd,
        props: { maintainScrollAtEndThreshold, onEndReachedThreshold },
    } = state;
    const contentSize = getContentSize(ctx);
    if (contentSize > 0 && queuedInitialLayout && !maintainingScrollAtEnd) {
        // Check if at end
        const distanceFromEnd = contentSize - scroll - scrollLength;
        const isContentLess = contentSize < scrollLength;
        state.isAtEnd = isContentLess || distanceFromEnd < scrollLength * maintainScrollAtEndThreshold!;

        state.isEndReached = checkThreshold(
            distanceFromEnd,
            isContentLess,
            onEndReachedThreshold! * scrollLength,
            state.isEndReached,
            state.endReachedBlockedByTimer,
            (distance) => state.props.onEndReached?.({ distanceFromEnd: distance }),
            (block) => {
                state.endReachedBlockedByTimer = block;
            },
        );
    }
}
